import { contextBridge, ipcRenderer } from "electron";
import { is } from "@electron-toolkit/utils";

const api = {
  isDev: is.dev,
  db: {
    query: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params),
    get: (sql: string, params?: any[]) => ipcRenderer.invoke('db:get', sql, params),
    run: (sql: string, params?: any[]) => ipcRenderer.invoke('db:run', sql, params),
  },
  file: {
    select: () => ipcRenderer.invoke('file:select'),
    saveAsset: (sourcePath: string, destRelativeDir: string) => ipcRenderer.invoke('file:saveAsset', sourcePath, destRelativeDir),
  }
};

contextBridge.exposeInMainWorld("travelMap", api);
