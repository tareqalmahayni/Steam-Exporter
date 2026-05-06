import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import http from "node:http";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverPort: number | null = null;
// Held at module scope so the BrowserWindow + its WebContents are not
// garbage-collected mid-login. Set when the login flow opens, cleared when
// the window closes.
let loginWindow: BrowserWindow | null = null;

const STEAM_LOGIN_PARTITION = "persist:steamworks";

function logSteam(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log("[steam-login]", ...args);
}

function resourcesPath(): string {
  const isPackaged = (app as unknown as { isPackaged: boolean }).isPackaged;
  if (isPackaged) return process.resourcesPath;
  return path.resolve(__dirname, "..", "dist");
}

function startServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const serverDir = path.join(resourcesPath(), "server");
    const webDir = path.join(resourcesPath(), "web");
    const entry = path.join(serverDir, "index.mjs");

    const child = spawn(process.execPath, [entry], {
      env: {
        ...process.env,
        PORT: "0",
        FRONTEND_DIR: webDir,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    serverProcess = child;

    let resolved = false;
    const onLine = (line: string) => {
      const m = line.match(/LISTENING_ON_PORT=(\d+)/);
      if (m && !resolved) {
        resolved = true;
        resolve(Number(m[1]));
      }
    };

    let stdoutBuf = "";
    child.stdout?.on("data", (d) => {
      const s = d.toString();
      stdoutBuf += s;
      let i;
      while ((i = stdoutBuf.indexOf("\n")) >= 0) {
        onLine(stdoutBuf.slice(0, i));
        stdoutBuf = stdoutBuf.slice(i + 1);
      }
      process.stdout.write(s);
    });
    child.stderr?.on("data", (d) => process.stderr.write(d));

    child.on("exit", (code) => {
      if (!resolved) reject(new Error(`Server exited before listening (code ${code})`));
    });

    setTimeout(() => {
      if (!resolved) reject(new Error("Server did not report a port within 10s"));
    }, 10_000);
  });
}

function waitForReady(port: number): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/healthz`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else setTimeout(tick, 100);
      });
      req.on("error", () => setTimeout(tick, 100));
    };
    tick();
  });
}

async function createWindow(): Promise<void> {
  serverPort = await startServer();
  await waitForReady(serverPort);

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 720,
    minHeight: 560,
    title: "Steamworks Exporter",
    backgroundColor: "#0e1218",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── Steam-cookie helpers ────────────────────────────────────────────────────

type Credentials = {
  sessionid: string;
  steamLoginSecure: string;
  partnerSessionid: string;
  partnerSteamLoginSecure: string;
};

async function readSteamCookies(): Promise<Credentials | null> {
  const loginSession = session.fromPartition(STEAM_LOGIN_PARTITION);
  const gamesCookies = await loginSession.cookies.get({ domain: "steamgames.com" });
  const poweredCookies = await loginSession.cookies.get({ domain: "steampowered.com" });
  const pick = (cookies: Electron.Cookie[], name: string) =>
    cookies.find((c) => c.name === name)?.value ?? "";
  const creds: Credentials = {
    sessionid: pick(gamesCookies, "sessionid"),
    steamLoginSecure: pick(gamesCookies, "steamLoginSecure"),
    partnerSessionid: pick(poweredCookies, "sessionid"),
    partnerSteamLoginSecure: pick(poweredCookies, "steamLoginSecure"),
  };
  if (
    creds.sessionid &&
    creds.steamLoginSecure &&
    creds.partnerSessionid &&
    creds.partnerSteamLoginSecure
  ) {
    return creds;
  }
  return null;
}

async function clearSteamCookies(): Promise<void> {
  const loginSession = session.fromPartition(STEAM_LOGIN_PARTITION);
  await loginSession.clearStorageData({ storages: ["cookies", "localstorage", "indexdb", "websql"] });
}

// ─── IPC: Steam login ────────────────────────────────────────────────────────

ipcMain.handle("desktop:loginToSteam", async () => {
  // If a login window is already open (e.g. user double-clicked the button),
  // focus it instead of opening a second one.
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return { cancelled: true };
  }

  return new Promise<Credentials | { cancelled: true }>((resolve) => {
    const loginSession = session.fromPartition(STEAM_LOGIN_PARTITION);

    const win = new BrowserWindow({
      width: 1000,
      height: 800,
      minWidth: 720,
      minHeight: 560,
      title: "Sign in to Steamworks",
      backgroundColor: "#1b2838",
      // Note: not modal. Modal-on-Windows can cause the parent's focus
      // changes to interact badly with popup blockers; standalone window
      // behaves identically across platforms.
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        partition: STEAM_LOGIN_PARTITION,
      },
    });

    loginWindow = win;

    let settled = false;
    let finishing = false;

    const tryComplete = async (reason: string) => {
      if (settled || finishing) return;
      const creds = await readSteamCookies();
      if (!creds) return;
      finishing = true;
      logSteam("complete:", reason, "— required cookies present, closing window");
      settled = true;
      cleanup();
      resolve(creds);
      if (!win.isDestroyed()) win.close();
    };

    const onCookieChanged = (
      _event: Electron.Event,
      cookie: Electron.Cookie,
      _cause: string,
      removed: boolean
    ) => {
      if (removed) return;
      // Only react to the cookies we actually care about — avoids firing
      // tryComplete on every analytics/tracking cookie Steam sets.
      const interesting =
        (cookie.name === "sessionid" || cookie.name === "steamLoginSecure") &&
        (cookie.domain?.includes("steamgames.com") || cookie.domain?.includes("steampowered.com"));
      if (!interesting) return;
      logSteam("cookie set:", cookie.name, cookie.domain);
      void tryComplete(`cookie:${cookie.name}@${cookie.domain}`);
    };

    // Belt-and-braces poll. Some cookie writes happen via `Set-Cookie` on
    // navigations that the cookies-changed event coverage has occasionally
    // missed in the wild. Cheap to run.
    const pollHandle = setInterval(() => void tryComplete("poll"), 1500);

    const cleanup = () => {
      clearInterval(pollHandle);
      try {
        loginSession.cookies.removeListener("changed", onCookieChanged);
      } catch {
        // ignore
      }
    };

    loginSession.cookies.on("changed", onCookieChanged);

    // ── Logging: surface every navigation in the login window so packaged
    //    builds are diagnosable without a remote debugger.
    win.webContents.on("did-start-navigation", (_e, url, _isInPlace, isMainFrame) => {
      if (isMainFrame) logSteam("did-start-navigation →", url);
    });
    win.webContents.on("did-navigate", (_e, url) => {
      logSteam("did-navigate →", url);
      void tryComplete("did-navigate");
    });
    win.webContents.on("did-navigate-in-page", (_e, url, isMainFrame) => {
      if (isMainFrame) logSteam("did-navigate-in-page →", url);
    });
    win.webContents.on("did-redirect-navigation", (_e, url) => {
      logSteam("did-redirect-navigation →", url);
    });
    win.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
      if (!isMainFrame) return;
      // -3 (ABORTED) is normal when a navigation is superseded by a redirect.
      if (code === -3) return;
      logSteam("did-fail-load", { code, desc, url });
    });

    // Steam Guard 2FA, "Sign in with QR code", and OpenID flows occasionally
    // try to spawn popups. Keep them inside the same window so cookies stay
    // in the persistent partition and the user never loses context.
    win.webContents.setWindowOpenHandler(({ url }) => {
      logSteam("popup requested →", url, "(opening in same window)");
      void win.loadURL(url);
      return { action: "deny" };
    });

    win.on("closed", () => {
      cleanup();
      loginWindow = null;
      if (!settled) {
        logSteam("window closed by user before cookies were captured");
        settled = true;
        resolve({ cancelled: true });
      }
    });

    logSteam("opening login window → https://partner.steamgames.com/home");
    void win.loadURL("https://partner.steamgames.com/home");
  });
});

// Returns previously-saved cookies on launch so the user can skip the login
// screen between sessions. Returns null if no valid set is present.
ipcMain.handle("desktop:getStoredSteamCookies", async () => {
  try {
    return await readSteamCookies();
  } catch {
    return null;
  }
});

// Wipes the persisted Steam-login partition. Called from the renderer's
// "Sign out" button.
ipcMain.handle("desktop:clearStoredSteamCookies", async () => {
  try {
    await clearSteamCookies();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
});

ipcMain.handle("desktop:isDesktop", async () => true);

ipcMain.handle("desktop:openExternal", async (_e, url: string) => {
  if (typeof url === "string" && /^https?:/.test(url)) {
    await shell.openExternal(url);
  }
});

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // ignore
    }
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // ignore
    }
  }
});
