import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import http from "node:http";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverPort: number | null = null;

function resourcesPath(): string {
  // In packaged builds Electron sets process.resourcesPath. In dev (electron .)
  // we look one level up from dist/.
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
        PORT: "0", // ask Express to pick a free port
        FRONTEND_DIR: webDir,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    serverProcess = child;

    let resolved = false;
    const onLine = (line: string) => {
      // The server prints "LISTENING_ON_PORT=<n>" once it's bound.
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
      // Mirror to console so users can debug from terminal
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

// ─── IPC: Steam login ────────────────────────────────────────────────────────
//
// Opens a separate BrowserWindow pointed at the Steamworks login page. The
// user authenticates normally (including 2FA). Once they reach a logged-in
// page we read the session cookies for both Steam domains and resolve.

ipcMain.handle("desktop:loginToSteam", async () => {
  return new Promise<{
    sessionid: string;
    steamLoginSecure: string;
    partnerSessionid: string;
    partnerSteamLoginSecure: string;
  } | { cancelled: true }>((resolve) => {
    const loginSession = session.fromPartition("persist:steam-login");

    const win = new BrowserWindow({
      width: 980,
      height: 760,
      title: "Sign in to Steamworks",
      backgroundColor: "#1b2838",
      modal: true,
      parent: mainWindow ?? undefined,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        partition: "persist:steam-login",
      },
    });

    let settled = false;
    const finishWith = async () => {
      if (settled) return;
      settled = true;
      try {
        const gamesCookies = await loginSession.cookies.get({ domain: "steamgames.com" });
        const poweredCookies = await loginSession.cookies.get({ domain: "steampowered.com" });
        const pick = (cookies: Electron.Cookie[], name: string) =>
          cookies.find((c) => c.name === name)?.value ?? "";

        resolve({
          sessionid: pick(gamesCookies, "sessionid"),
          steamLoginSecure: pick(gamesCookies, "steamLoginSecure"),
          partnerSessionid: pick(poweredCookies, "sessionid"),
          partnerSteamLoginSecure: pick(poweredCookies, "steamLoginSecure"),
        });
      } catch {
        resolve({ cancelled: true });
      } finally {
        if (!win.isDestroyed()) win.close();
      }
    };

    // Detect login completion by watching for a navigation away from the login page
    // to a partner.* URL where session cookies exist.
    win.webContents.on("did-navigate", (_e, url) => {
      if (
        (url.includes("partner.steamgames.com") || url.includes("partner.steampowered.com")) &&
        !url.includes("/login") &&
        !url.includes("login.steampowered.com")
      ) {
        // Give Steam a moment to finish setting cookies for both domains
        setTimeout(finishWith, 800);
      }
    });

    win.on("closed", () => {
      if (!settled) {
        settled = true;
        resolve({ cancelled: true });
      }
    });

    win.loadURL(
      "https://partner.steamgames.com/home"
    );
  });
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
