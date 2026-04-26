import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { SCHEMA_V1 } from './schema';
import fs from 'fs';

export class DBManager {
  private db: Database.Database;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = join(userDataPath, 'travel-map.sqlite');
    
    // Backup before migrate
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, `${dbPath}.bak`);
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.migrate();
  }

  private migrate() {
    const currentVersion = this.db.pragma('user_version', { simple: true }) as number;
    
    if (currentVersion < 1) {
      this.db.exec(SCHEMA_V1);
      this.db.pragma('user_version = 1');
    }
  }

  public getDb(): Database.Database {
    return this.db;
  }

  public close() {
    this.db.close();
  }
}

let dbManager: DBManager | null = null;

export function initDb() {
  dbManager = new DBManager();
  return dbManager;
}

export function getDb(): Database.Database {
  if (!dbManager) throw new Error("DB not initialized");
  return dbManager.getDb();
}
