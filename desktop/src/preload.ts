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
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("desktop:openExternal", url),
};

contextBridge.exposeInMainWorld("desktop", api);
