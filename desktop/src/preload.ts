import { contextBridge, ipcRenderer } from "electron";

type Credentials = {
  sessionid: string;
  steamLoginSecure: string;
  partnerSessionid: string;
  partnerSteamLoginSecure: string;
};

const api = {
  isDesktop: true,
  loginToSteam: (): Promise<Credentials | { cancelled: true }> =>
    ipcRenderer.invoke("desktop:loginToSteam"),
  getStoredSteamCookies: (): Promise<Credentials | null> =>
    ipcRenderer.invoke("desktop:getStoredSteamCookies"),
  validateSteamSession: (): Promise<{
    ok: boolean;
    checks: {
      sessionidPresent: boolean;
      steamLoginSecurePresent: boolean;
      dashboardHtmlAuthenticated: boolean;
      dashboardReachable: boolean;
      dashboardStatus?: number;
      dashboardFinalUrl?: string;
    };
    cookieMeta: Array<{
      name: string;
      domain: string;
      path: string;
      secure: boolean;
      httpOnly: boolean;
      sameSite?: string;
    }>;
    publisherName?: string;
    credentials: Credentials | null;
  }> => ipcRenderer.invoke("desktop:validateSteamSession"),
  clearStoredSteamCookies: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("desktop:clearStoredSteamCookies"),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("desktop:openExternal", url),
  // Browser-fallback flow: opens Steamworks in the user's default browser
  // and accepts a manual paste of the four cookie values.
  openSteamLoginInBrowser: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("desktop:openSteamLoginInBrowser"),
  saveSteamCookies: (
    creds: Credentials
  ): Promise<{ ok: boolean; credentials?: Credentials; error?: string }> =>
    ipcRenderer.invoke("desktop:saveSteamCookies", creds),
  // M7 main flow: pull the traffic breakdown for one game using the persisted
  // Steamworks session held in the Electron main process. Cookies never cross
  // the IPC boundary into the renderer.
  pullSteamworksTraffic: (
    appid: string,
    startIso: string,
    endIso: string
  ): Promise<
    | { ok: true; fileName: string; text: string; rowCount: number }
    | { ok: false; status: string; error: string }
  > => ipcRenderer.invoke("desktop:pullSteamworksTraffic", appid, startIso, endIso),
};

contextBridge.exposeInMainWorld("desktop", api);
