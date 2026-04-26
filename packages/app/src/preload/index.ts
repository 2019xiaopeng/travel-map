import { contextBridge, ipcRenderer } from "electron";
import { is } from "@electron-toolkit/utils";

const api = {
  isDev: is.dev,
  db: {
    query: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params),
    get: (sql: string, params?: any[]) => ipcRenderer.invoke('db:get', sql, params),
    run: (sql: string, params?: any[]) => ipcRenderer.invoke('db:run', sql, params),
  }
};

contextBridge.exposeInMainWorld("travelMap", api);
