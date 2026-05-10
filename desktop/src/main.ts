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

// Cookie domains we care about. partner.steamgames.com is the primary login
// domain. partner.steampowered.com is where the actual stats URLs live and
// gets its cookies minted via a JWT-refresh hop the FIRST time you navigate
// there. steamcommunity.com and store.steampowered.com hold the master Steam
// session that the JWT-refresh endpoint uses to mint the partner cookies.
const COOKIE_DOMAINS = [
  "steamgames.com",
  "steampowered.com",
  "steamcommunity.com",
] as const;

function pickCookie(cookies: Electron.Cookie[], domain: string, name: string): string {
  // Tier 1: exact-host match (e.g. cookie.domain === "partner.steamgames.com").
  const exact = cookies.find(
    (c) => c.name === name && (c.domain === domain || c.domain === `.${domain}`)
  );
  if (exact) return exact.value;

  // Tier 2: parent-domain match. Steam sometimes scopes the partner cookies
  // to ".steamgames.com" / ".steampowered.com" (broader than partner.*) — those
  // are still valid for partner.* requests, the strict equality above would
  // miss them, and we'd incorrectly conclude "not signed in".
  const parents: string[] = [];
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    parents.push(parts.slice(i).join("."));
  }
  for (const parent of parents) {
    const wider = cookies.find(
      (c) => c.name === name && (c.domain === parent || c.domain === `.${parent}`)
    );
    if (wider) return wider.value;
  }

  // Tier 3: any cookie with the right name in the partition. Last resort.
  return cookies.find((c) => c.name === name)?.value ?? "";
}

/**
 * Read all Steamworks-related cookies from the persistent partition.
 *
 * `requireFull = true` (default for stored-creds path) means we only return
 * non-null when both the steamgames *and* steampowered cookie pairs are
 * present. `requireFull = false` (login-window completion path) returns
 * non-null as soon as the steamgames pair exists — the steampowered cookies
 * are minted later via a priming navigation.
 */
async function readSteamCookies(
  opts: { requireFull?: boolean } = {}
): Promise<Credentials | null> {
  const { requireFull = true } = opts;
  const loginSession = session.fromPartition(STEAM_LOGIN_PARTITION);

  const allCookies: Electron.Cookie[] = [];
  for (const domain of COOKIE_DOMAINS) {
    const cookies = await loginSession.cookies.get({ domain });
    allCookies.push(...cookies);
  }

  const creds: Credentials = {
    sessionid: pickCookie(allCookies, "partner.steamgames.com", "sessionid"),
    steamLoginSecure: pickCookie(allCookies, "partner.steamgames.com", "steamLoginSecure"),
    partnerSessionid: pickCookie(allCookies, "partner.steampowered.com", "sessionid"),
    partnerSteamLoginSecure: pickCookie(allCookies, "partner.steampowered.com", "steamLoginSecure"),
  };

  // Diagnostic: where each cookie was found.
  logSteam("readSteamCookies snapshot:", {
    steamgames_sessionid: !!creds.sessionid,
    steamgames_steamLoginSecure: !!creds.steamLoginSecure,
    steampowered_sessionid: !!creds.partnerSessionid,
    steampowered_steamLoginSecure: !!creds.partnerSteamLoginSecure,
    steamcommunity_steamLoginSecure: !!pickCookie(
      allCookies,
      "steamcommunity.com",
      "steamLoginSecure"
    ),
  });

  // Primary login domain is non-negotiable: without these the user has not
  // signed into Steamworks at all.
  if (!creds.sessionid || !creds.steamLoginSecure) return null;

  // Partner-side cookies are mintable on demand via JWT refresh, so they
  // are optional for the login-completion path.
  if (requireFull && (!creds.partnerSessionid || !creds.partnerSteamLoginSecure)) {
    return null;
  }
  return creds;
}

/**
 * After the user successfully signs in at partner.steamgames.com we trigger
 * a one-shot navigation to partner.steampowered.com so Steam's JWT-refresh
 * flow runs and Set-Cookies the steampowered.com cookie pair into our
 * partition. Without this, `requireFull=true` reads in the auto-login path
 * would always return null and the renderer would forever show "Waiting for
 * sign-in…".
 */
async function primePartnerCookies(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed()) return;
  logSteam("priming partner.steampowered.com cookies via in-window navigation…");
  try {
    await win.loadURL("https://partner.steampowered.com/home");
    // Tiny grace period for any post-load Set-Cookies to settle.
    await new Promise((r) => setTimeout(r, 1200));
    logSteam("priming nav complete");
  } catch (e) {
    logSteam("priming nav failed (non-fatal):", (e as Error).message);
  }
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
    let lastUrl = "";

    /**
     * URL is "past login" if it points at any Steamworks dashboard / app
     * page rather than a login form or OpenID/JWT bounce. We use this as
     * the primary positive signal — combined with cookies-present — that
     * the user has actually finished signing in.
     */
    const isPastLogin = (url: string): boolean => {
      if (!url) return false;
      if (/\/login(\?|\/|$)/.test(url)) return false;
      if (url.includes("openid")) return false;
      if (url.includes("login.steampowered.com")) return false;
      // Steam's federated login bounces through several auth domains before
      // landing back on partner.*. Any of these (with cookies present) is a
      // strong "user is signed in" signal — gating on partner.* alone caused
      // the "Waiting for sign-in…" hang reported in the field.
      return (
        url.includes("partner.steamgames.com") ||
        url.includes("partner.steampowered.com") ||
        url.includes("steamcommunity.com") ||
        url.includes("store.steampowered.com") ||
        url.includes("checkout.steampowered.com") ||
        url.includes("help.steampowered.com")
      );
    };

    const tryComplete = async (reason: string) => {
      if (settled || finishing) return;

      // Need EITHER (cookies present + past-login URL) OR (cookies present
      // and we've polled enough times). Pure cookie-presence is not enough
      // because Steam may set sessionid before the user actually signs in
      // (CSRF tokens are sometimes minted at the login screen too).
      const creds = await readSteamCookies({ requireFull: false });
      if (!creds) return;
      if (!isPastLogin(lastUrl) && reason.startsWith("cookie:")) {
        logSteam("cookie present but URL still on login page —", lastUrl, "— deferring");
        return;
      }

      finishing = true;
      logSteam(
        "primary login detected:",
        reason,
        "— priming partner.steampowered.com cookies before resolving"
      );

      // Mint partner.steampowered.com cookies via a same-window nav. After
      // this, readSteamCookies({requireFull:true}) typically returns the
      // full quad; if not, we still resolve with what we have because the
      // backend's fetchPartnerHtml replicates the JWT-refresh hop itself.
      await primePartnerCookies(win);

      const finalCreds =
        (await readSteamCookies({ requireFull: true })) ??
        (await readSteamCookies({ requireFull: false })) ??
        creds;

      logSteam("resolving login:", {
        steamgames: !!finalCreds.steamLoginSecure,
        steampowered: !!finalCreds.partnerSteamLoginSecure,
      });

      settled = true;
      cleanup();
      resolve(finalCreds);
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
        (cookie.domain?.includes("steamgames.com") ||
          cookie.domain?.includes("steampowered.com") ||
          cookie.domain?.includes("steamcommunity.com"));
      if (!interesting) return;
      logSteam("cookie set:", cookie.name, "@", cookie.domain);
      void tryComplete(`cookie:${cookie.name}@${cookie.domain}`);
    };

    // Belt-and-braces poll. Some cookie writes happen via `Set-Cookie` on
    // navigations that the cookies-changed event coverage has occasionally
    // missed in the wild. Cheap to run.
    const pollHandle = setInterval(() => void tryComplete("poll"), 750);

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
      if (isMainFrame) {
        lastUrl = url;
        logSteam("did-start-navigation →", url);
      }
    });
    win.webContents.on("did-navigate", (_e, url) => {
      lastUrl = url;
      logSteam("did-navigate →", url, "(pastLogin=", isPastLogin(url), ")");
      void tryComplete("did-navigate");
    });
    win.webContents.on("did-navigate-in-page", (_e, url, isMainFrame) => {
      if (isMainFrame) {
        lastUrl = url;
        logSteam("did-navigate-in-page →", url);
        void tryComplete("did-navigate-in-page");
      }
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
// screen between sessions. Accepts partial creds (only steamgames pair
// required) — backend will re-mint steampowered cookies via JWT refresh.
ipcMain.handle("desktop:getStoredSteamCookies", async () => {
  try {
    return await readSteamCookies({ requireFull: false });
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

// ─── IPC: Steamworks traffic pull ────────────────────────────────────────────
// Reads the persisted Steamworks cookies from the main process partition
// (renderer never sees them) and forwards them to the local API server's
// /api/combined/pull-traffic-csv endpoint. Returns the synthesized CSV
// (text + filename) or a structured error with one of the documented
// status tokens (STEAMWORKS_LOGIN_REQUIRED / TRAFFIC_PAGE_ACCESS_DENIED /
// TRAFFIC_DOWNLOAD_FAILED).
type PullTrafficResult =
  | { ok: true; fileName: string; text: string; rowCount: number }
  | { ok: false; status: string; error: string };

ipcMain.handle(
  "desktop:pullSteamworksTraffic",
  async (_e, appid: string, startIso: string, endIso: string): Promise<PullTrafficResult> => {
    try {
      if (!serverPort) {
        return { ok: false, status: "TRAFFIC_DOWNLOAD_FAILED", error: "Local API server not ready." };
      }
      // requireFull=false: partner.steampowered.com cookies will be re-minted
      // server-side via JWT refresh if the steamgames pair is present.
      const creds = await readSteamCookies({ requireFull: false });
      if (!creds) {
        return {
          ok: false,
          status: "STEAMWORKS_LOGIN_REQUIRED",
          error: "No Steamworks cookies found. Please sign in to Steamworks first.",
        };
      }

      const payload = JSON.stringify({
        appid,
        startIso,
        endIso,
        cookies: {
          sessionid: creds.sessionid,
          steamLoginSecure: creds.steamLoginSecure,
          partnerSessionid: creds.partnerSessionid,
          partnerSteamLoginSecure: creds.partnerSteamLoginSecure,
        },
      });

      return await new Promise<PullTrafficResult>((resolve) => {
        const req = http.request(
          {
            host: "127.0.0.1",
            port: serverPort!,
            path: "/api/combined/pull-traffic-csv",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c) => chunks.push(c as Buffer));
            res.on("end", () => {
              const body = Buffer.concat(chunks).toString("utf8");
              try {
                const parsed = JSON.parse(body) as PullTrafficResult;
                resolve(parsed);
              } catch {
                resolve({ ok: false, status: "TRAFFIC_DOWNLOAD_FAILED", error: `Bad JSON from local server (HTTP ${res.statusCode}).` });
              }
            });
          },
        );
        req.on("error", (err) => {
          resolve({ ok: false, status: "TRAFFIC_DOWNLOAD_FAILED", error: `Local server request failed: ${err.message}` });
        });
        req.write(payload);
        req.end();
      });
    } catch (err) {
      return { ok: false, status: "TRAFFIC_DOWNLOAD_FAILED", error: (err as Error).message };
    }
  },
);

ipcMain.handle("desktop:openExternal", async (_e, url: string) => {
  if (typeof url === "string" && /^https?:/.test(url)) {
    await shell.openExternal(url);
  }
});

// ─── Browser-fallback login flow ─────────────────────────────────────────────
// If the embedded Electron window misbehaves on a particular Windows install
// (rare, but possible — antivirus, Group Policy, weird display drivers), the
// renderer can fall back to: (a) open Steamworks in the user's default
// browser, (b) sign in there, (c) paste the four cookie values into a form,
// (d) we save them into the persistent partition so auto-login still works
// across launches.

ipcMain.handle("desktop:openSteamLoginInBrowser", async () => {
  await shell.openExternal("https://partner.steamgames.com/home");
  return { ok: true };
});

ipcMain.handle("desktop:saveSteamCookies", async (_e, creds: Credentials) => {
  if (
    !creds ||
    typeof creds.sessionid !== "string" ||
    typeof creds.steamLoginSecure !== "string" ||
    typeof creds.partnerSessionid !== "string" ||
    typeof creds.partnerSteamLoginSecure !== "string"
  ) {
    return { ok: false, error: "missing_fields" };
  }
  const trimmed: Credentials = {
    sessionid: creds.sessionid.trim(),
    steamLoginSecure: creds.steamLoginSecure.trim(),
    partnerSessionid: creds.partnerSessionid.trim(),
    partnerSteamLoginSecure: creds.partnerSteamLoginSecure.trim(),
  };
  if (
    !trimmed.sessionid ||
    !trimmed.steamLoginSecure ||
    !trimmed.partnerSessionid ||
    !trimmed.partnerSteamLoginSecure
  ) {
    return { ok: false, error: "empty_fields" };
  }

  const loginSession = session.fromPartition(STEAM_LOGIN_PARTITION);
  const writes: Array<{ url: string; name: string; value: string; domain: string }> = [
    { url: "https://partner.steamgames.com", name: "sessionid", value: trimmed.sessionid, domain: "partner.steamgames.com" },
    { url: "https://partner.steamgames.com", name: "steamLoginSecure", value: trimmed.steamLoginSecure, domain: "partner.steamgames.com" },
    { url: "https://partner.steampowered.com", name: "sessionid", value: trimmed.partnerSessionid, domain: "partner.steampowered.com" },
    { url: "https://partner.steampowered.com", name: "steamLoginSecure", value: trimmed.partnerSteamLoginSecure, domain: "partner.steampowered.com" },
  ];
  try {
    for (const c of writes) {
      await loginSession.cookies.set({
        url: c.url,
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: "/",
        secure: true,
        httpOnly: false,
      });
    }
    return { ok: true, credentials: trimmed };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
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
