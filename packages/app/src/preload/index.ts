import { contextBridge } from "electron";
import { is } from "@electron-toolkit/utils";

const api = {
  isDev: is.dev,
  // 后续在这里暴露 SQLite / 文件系统 / R2 等 IPC 方法
};

contextBridge.exposeInMainWorld("travelMap", api);
