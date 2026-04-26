import { ipcMain, dialog } from 'electron';
import { getDb } from './db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';

export function setupIpc() {
  ipcMain.handle('db:query', (event, sql: string, params: any[] = []) => {
    try {
      const db = getDb();
      const stmt = db.prepare(sql);
      return stmt.all(params);
    } catch (e: any) {
      return { error: e.message };
    }
  });

  ipcMain.handle('db:get', (event, sql: string, params: any[] = []) => {
    try {
      const db = getDb();
      const stmt = db.prepare(sql);
      return stmt.get(params);
    } catch (e: any) {
      return { error: e.message };
    }
  });

  ipcMain.handle('db:run', (event, sql: string, params: any[] = []) => {
    try {
      const db = getDb();
      const stmt = db.prepare(sql);
      const info = stmt.run(params);
      return info;
    } catch (e: any) {
      return { error: e.message };
    }
  });

  ipcMain.handle('file:select', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp'] }]
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.handle('file:saveAsset', async (event, sourcePath: string, destRelativeDir: string) => {
    try {
      const assetId = crypto.randomUUID();
      const originalFilename = path.basename(sourcePath);
      const destFilename = `${assetId}__${originalFilename}`;
      const destRelativePath = path.join('assets', destRelativeDir, destFilename);
      
      const userDataPath = app.getPath('userData');
      const absoluteDestPath = path.join(userDataPath, destRelativePath);
      
      // Ensure directory exists
      fs.mkdirSync(path.dirname(absoluteDestPath), { recursive: true });
      
      // Copy file
      fs.copyFileSync(sourcePath, absoluteDestPath);
      
      // Get file info
      const stats = fs.statSync(absoluteDestPath);
      const ext = path.extname(originalFilename).toLowerCase();
      let mime = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
      else if (ext === '.png') mime = 'image/png';
      else if (ext === '.gif') mime = 'image/gif';
      else if (ext === '.webp') mime = 'image/webp';
      
      // Calculate sha256
      const fileBuffer = fs.readFileSync(absoluteDestPath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      const sha256 = hashSum.digest('hex');

      // Save to DB
      const db = getDb();
      const now = Date.now();
      db.prepare(`
        INSERT INTO Asset (asset_id, type, original_filename, mime, size, sha256, local_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(assetId, 'image', originalFilename, mime, stats.size, sha256, destRelativePath.replace(/\\/g, '/'), now);

      return {
        assetId,
        localUrl: `local:///${destRelativePath.replace(/\\/g, '/')}`
      };
    } catch (e: any) {
      console.error('Failed to save asset:', e);
      return { error: e.message };
    }
  });
}
