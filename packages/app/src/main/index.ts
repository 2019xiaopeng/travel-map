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
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow!.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
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
      const relativePath = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      const userDataPath = app.getPath('userData');
      const absolutePath = resolve(join(userDataPath, relativePath));

      // Security check: prevent path traversal
      if (!absolutePath.startsWith(resolve(userDataPath))) {
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
