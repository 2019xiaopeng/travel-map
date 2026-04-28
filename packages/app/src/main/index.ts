import { app, shell, BrowserWindow, protocol, net } from "electron";
import { join, normalize, resolve } from "path";
import { is } from "@electron-toolkit/utils";
import { initDb, getDb } from "./db";
import { setupIpc } from "./ipc";
import fs from "fs";

let mainWindow: BrowserWindow | null = null;

// Register custom protocol
protocol.registerSchemesAsPrivileged([
  { scheme: 'local', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    title: "旅行地图",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow!.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url);
      if (url.protocol === "https:") {
        shell.openExternal(url.toString());
      }
    } catch {}
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allow = url.startsWith("file://") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
    if (allow) return;
    event.preventDefault();
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:") {
        shell.openExternal(parsed.toString());
      }
    } catch {}
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  initDb();
  setupIpc();
  
  // Handle local:// protocol
  protocol.handle('local', async (request) => {
    try {
      const url = new URL(request.url);
      const hostPart = url.host ? `${url.host}/` : "";
      const pathPart = url.pathname.replace(/^\/+/, "");
      const relativePath = decodeURIComponent(`${hostPart}${pathPart}`);
      const userDataPath = app.getPath('userData');
      const absolutePath = resolve(join(userDataPath, relativePath));
      const assetsRoot = resolve(join(userDataPath, 'assets'));
      const sep = normalize('/');
      const assetsRootWithSep = assetsRoot.endsWith(sep) ? assetsRoot : `${assetsRoot}${sep}`;

      // Security check: prevent path traversal
      if (!absolutePath.startsWith(assetsRootWithSep)) {
        return new Response('Access Denied', { status: 403 });
      }

      if (fs.existsSync(absolutePath)) {
        return net.fetch(`file://${absolutePath}`);
      }

      // If file not found locally, try to find remote_url in DB
      const db = getDb();
      const asset = db.prepare(`SELECT remote_url FROM Asset WHERE local_path = ?`).get(relativePath) as any;
      
      if (asset && asset.remote_url) {
        const target = new URL(asset.remote_url);
        if (target.protocol !== 'https:') {
          return new Response('Invalid remote url', { status: 400 });
        }
        return Response.redirect(target.toString(), 302);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Protocol handle error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
