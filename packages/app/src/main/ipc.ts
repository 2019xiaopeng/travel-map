import { ipcMain } from 'electron';
import { getDb } from './db';

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
}
