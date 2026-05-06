// Type declarations for the bridge exposed by the Electron preload script.
// `window.desktop` is undefined in plain web mode.

export {};

declare global {
  interface Window {
    desktop?: {
      isDesktop: true;
      loginToSteam: () => Promise<
        | {
            sessionid: string;
            steamLoginSecure: string;
            partnerSessionid: string;
            partnerSteamLoginSecure: string;
          }
        | { cancelled: true }
      >;
      openExternal: (url: string) => Promise<void>;
    };
  }
}
