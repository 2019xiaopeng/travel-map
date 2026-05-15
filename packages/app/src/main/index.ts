import { app, shell, BrowserWindow, protocol, net } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
import { initDb, getDb } from "./db";
import { setupIpc } from "./ipc";
import { resolveLocalAssetRequest } from "./localProtocol";
import { applyPendingRestoreIfPresent, cleanupRestoreArtifacts } from "./backupRestore";
import { exportRestoreDiagnostic, initRestoreDiagnostics, logRestoreEvent } from "./diagnostics/restoreDiagnostics.ts";
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
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow!.show();
  });

  mainWindow.webContents.on("preload-error", (_event, _preloadPath, error) => {
    console.error("Preload script failed to load:", error);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow!.webContents.executeJavaScript('typeof window.travelMap')
      .then((result: any) => {
        if (result !== "object") {
          console.error("window.travelMap is not available after page load:", result);
        }
      })
      .catch((err: any) => console.error("Failed to check window.travelMap:", err));
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

app.whenReady().then(async () => {
  const userDataPath = app.getPath("userData");
  initRestoreDiagnostics({ userDataPath, appVersion: app.getVersion() });
  try {
    await applyPendingRestoreIfPresent({ userDataPath, now: Date.now() });
  } catch (e) {
    console.error("Apply pending restore failed:", e);
    logRestoreEvent({ level: "error", event: "restore.apply.fail", error_code: "exception", message: String((e as any)?.message ?? "unknown") });
    await exportRestoreDiagnostic({ reason: "restore.apply.fail" });
  }

  try {
    await cleanupRestoreArtifacts({ userDataPath, now: Date.now() });
  } catch (e) {
    console.error("Cleanup restore artifacts failed:", e);
    logRestoreEvent({ level: "error", event: "restore.cleanup.fail", error_code: "exception", message: String((e as any)?.message ?? "unknown") });
    await exportRestoreDiagnostic({ reason: "restore.cleanup.fail" });
  }

  initDb();
  setupIpc();
  
  // Handle local:// protocol
  protocol.handle('local', async (request) => {
    try {
      const userDataPath = app.getPath('userData');
      const resolved = resolveLocalAssetRequest({ requestUrl: request.url, userDataPath });

      // Security check: prevent path traversal
      if (!resolved.allowed) {
        return new Response('Access Denied', { status: 403 });
      }

      if (fs.existsSync(resolved.absolutePath)) {
        return net.fetch(`file://${resolved.absolutePath}`);
      }

      // If file not found locally, try to find remote_url in DB
      const db = getDb();
      const asset = db.prepare(`SELECT remote_url FROM Asset WHERE local_path = ?`).get(resolved.relativePath) as any;
      
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
