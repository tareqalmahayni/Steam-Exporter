// Type declarations for the bridge exposed by the Electron preload script.
// `window.desktop` is undefined in plain web mode.

export {};

type Credentials = {
  sessionid: string;
  steamLoginSecure: string;
  partnerSessionid: string;
  partnerSteamLoginSecure: string;
};

declare global {
  interface Window {
    desktop?: {
      isDesktop: true;
      loginToSteam: () => Promise<Credentials | { cancelled: true }>;
      getStoredSteamCookies: () => Promise<Credentials | null>;
      clearStoredSteamCookies: () => Promise<{ ok: boolean; error?: string }>;
      openExternal: (url: string) => Promise<void>;
      openSteamLoginInBrowser: () => Promise<{ ok: boolean }>;
      saveSteamCookies: (
        creds: Credentials
      ) => Promise<{ ok: boolean; credentials?: Credentials; error?: string }>;
      pullSteamworksTraffic: (
        appid: string,
        startIso: string,
        endIso: string
      ) => Promise<
        | { ok: true; fileName: string; text: string; rowCount: number }
        | { ok: false; status: string; error: string }
      >;
    };
  }
}
