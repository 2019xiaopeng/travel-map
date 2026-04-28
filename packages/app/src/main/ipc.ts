import { ipcMain, dialog, shell } from "electron";
import { getDb } from "./db";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { app } from "electron";
import { saveAssetBytesCore } from "./saveAssetBytesCore";
import { createBackupZip } from "./backupZip";

export function setupIpc() {
  const assertSender = (event: Electron.IpcMainInvokeEvent) => {
    const url = event.senderFrame?.url ?? "";
    if (url.startsWith("file://")) return;
    if (url.startsWith("http://localhost")) return;
    if (url.startsWith("http://127.0.0.1")) return;
    throw new Error("Unauthorized sender");
  };

  const safeAssetAbsolutePath = (localPath: string) => {
    const userDataPath = app.getPath("userData");
    const assetsRoot = path.resolve(path.join(userDataPath, "assets"));
    const absolutePath = path.resolve(path.join(userDataPath, localPath));
    if (!absolutePath.startsWith(assetsRoot + path.sep)) return null;
    return absolutePath;
  };

  const deleteAssetIfUnreferenced = (assetId: string) => {
    const db = getDb();
    const tagRefs = db.prepare(`
      SELECT COUNT(*) as cnt
      FROM Tag
      WHERE name = ?
        AND entity_type IN ('trip_attachment', 'trip_inline_asset')
    `).get(assetId) as any;

    const tripCoverRefs = db.prepare(`SELECT COUNT(*) as cnt FROM Trip WHERE cover_asset_id = ?`).get(assetId) as any;
    const cityCoverRefs = db.prepare(`SELECT COUNT(*) as cnt FROM City WHERE cover_asset_id = ?`).get(assetId) as any;

    const totalRefs = (tagRefs?.cnt || 0) + (tripCoverRefs?.cnt || 0) + (cityCoverRefs?.cnt || 0);
    if (totalRefs > 0) return;

    const row = db.prepare(`SELECT local_path FROM Asset WHERE asset_id = ?`).get(assetId) as any;
    db.prepare(`DELETE FROM Asset WHERE asset_id = ?`).run(assetId);

    const absolutePath = row?.local_path ? safeAssetAbsolutePath(row.local_path) : null;
    if (!absolutePath) return;

    fs.unlink(absolutePath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.error(`Failed to delete asset file: ${absolutePath}`, err);
      }
    });
  };

  ipcMain.handle("db:getCity", (event, payload: { cityId: string; provinceId: string; cityName: string; provinceName: string }) => {
    assertSender(event);
    const db = getDb();
    db.prepare(
      `INSERT INTO Province (province_id, name) VALUES (?, ?) ON CONFLICT(province_id) DO UPDATE SET name=excluded.name`,
    ).run(payload.provinceId, payload.provinceName);
    db.prepare(
      `INSERT INTO City (city_id, province_id, name) VALUES (?, ?, ?) ON CONFLICT(city_id) DO UPDATE SET name=excluded.name`,
    ).run(payload.cityId, payload.provinceId, payload.cityName);

    const city = db.prepare(`
      SELECT City.*, Asset.local_path as cover_path, Asset.remote_url as cover_remote
      FROM City
      LEFT JOIN Asset ON City.cover_asset_id = Asset.asset_id
      WHERE City.city_id = ?
    `).get(payload.cityId) as any;

    const trips = db.prepare(`SELECT COUNT(*) as count, SUM(cost_total) as totalCost FROM Trip WHERE city_id = ?`).get(payload.cityId) as any;
    const pois = db.prepare(`SELECT COUNT(*) as count FROM POI WHERE city_id = ?`).get(payload.cityId) as any;

    return {
      ...city,
      tripCount: trips?.count || 0,
      totalCost: trips?.totalCost || 0,
      poiCount: pois?.count || 0,
    };
  });

  ipcMain.handle("db:getTrips", (event, payload: { cityId: string }) => {
    assertSender(event);
    const db = getDb();
    return db.prepare(`
      SELECT Trip.*, Asset.local_path as cover_path, Asset.remote_url as cover_remote
      FROM Trip
      LEFT JOIN Asset ON Trip.cover_asset_id = Asset.asset_id
      WHERE Trip.city_id = ?
      ORDER BY Trip.date_start DESC
    `).all(payload.cityId);
  });

  ipcMain.handle("db:createTrip", (event, payload: any) => {
    assertSender(event);
    const db = getDb();
    const tripId = crypto.randomUUID();
    const now = Date.now();
    db.prepare(`
      INSERT INTO Trip (trip_id, city_id, title, date_start, date_end, companions, route, cost_total, cover_asset_id, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tripId,
      payload.city_id,
      payload.title || "新旅行",
      payload.date_start || "",
      payload.date_end || "",
      payload.companions || "[]",
      payload.route || "",
      payload.cost_total || 0,
      payload.cover_asset_id || null,
      payload.content || "",
      now,
      now,
    );
    return tripId;
  });

  ipcMain.handle("db:updateTrip", (event, payload: any) => {
    assertSender(event);
    const db = getDb();
    const now = Date.now();
    const prev = db.prepare(`SELECT cover_asset_id FROM Trip WHERE trip_id = ?`).get(payload.trip_id) as any;
    db.prepare(
      `UPDATE Trip SET title=?, date_start=?, date_end=?, companions=?, route=?, cost_total=?, cover_asset_id=?, content=?, updated_at=? WHERE trip_id=?`,
    ).run(
      payload.title,
      payload.date_start,
      payload.date_end,
      payload.companions,
      payload.route,
      payload.cost_total,
      payload.cover_asset_id,
      payload.content,
      now,
      payload.trip_id,
    );
    const previousCoverId = String(prev?.cover_asset_id ?? "").trim();
    const nextCoverId = String(payload.cover_asset_id ?? "").trim();
    if (previousCoverId && previousCoverId !== nextCoverId) {
      deleteAssetIfUnreferenced(previousCoverId);
    }
    return { ok: true };
  });

  ipcMain.handle("db:deleteTrip", (event, payload: { tripId: string }) => {
    assertSender(event);
    const db = getDb();

    const assets = db.prepare(`SELECT local_path FROM Asset WHERE local_path LIKE '%/trips/' || ? || '/%'`).all(payload.tripId) as any[];

    db.transaction(() => {
      db.prepare(`DELETE FROM Tag WHERE entity_type IN ('trip', 'trip_attachment', 'trip_inline_asset') AND entity_id = ?`).run(payload.tripId);
      db.prepare(`DELETE FROM Asset WHERE local_path LIKE '%/trips/' || ? || '/%'`).run(payload.tripId);
      db.prepare(`DELETE FROM Trip WHERE trip_id = ?`).run(payload.tripId);
    })();

    for (const asset of assets) {
      if (asset.local_path) {
        const absolutePath = safeAssetAbsolutePath(asset.local_path);
        if (!absolutePath) continue;
        fs.unlink(absolutePath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.error(`Failed to delete asset file: ${absolutePath}`, err);
          }
        });
      }
    }

    const anyLocal = assets.find((a) => typeof a?.local_path === "string")?.local_path as string | undefined;
    if (anyLocal) {
      const idx = anyLocal.indexOf(`/trips/${payload.tripId}`);
      if (idx !== -1) {
        const tripRootLocal = anyLocal.slice(0, idx + `/trips/${payload.tripId}`.length);
        const tripRootAbs = safeAssetAbsolutePath(tripRootLocal);
        if (tripRootAbs) {
          fs.rm(tripRootAbs, { recursive: true, force: true }, () => {});
        }
      }
    }

    return { ok: true };
  });

  ipcMain.handle("db:getTrip", (event, payload: { tripId: string }) => {
    assertSender(event);
    const db = getDb();
    return db.prepare(`
      SELECT Trip.*, Asset.local_path as cover_path, Asset.remote_url as cover_remote
      FROM Trip
      LEFT JOIN Asset ON Trip.cover_asset_id = Asset.asset_id
      WHERE Trip.trip_id = ?
    `).get(payload.tripId);
  });

  ipcMain.handle("db:getTripCosts", (event, payload: { tripId: string }) => {
    assertSender(event);
    const db = getDb();
    return db.prepare(`SELECT * FROM CostBreakdown WHERE trip_id = ?`).all(payload.tripId);
  });

  ipcMain.handle("db:updateTripCost", (event, payload: { tripId: string; category: string; amount: number }) => {
    assertSender(event);
    const db = getDb();
    return db.transaction(() => {
      db.prepare(`
        INSERT INTO CostBreakdown (trip_id, category, amount)
        VALUES (?, ?, ?)
        ON CONFLICT(trip_id, category) DO UPDATE SET amount=excluded.amount
      `).run(payload.tripId, payload.category, payload.amount);

      const res = db.prepare(`SELECT SUM(amount) as total FROM CostBreakdown WHERE trip_id = ?`).get(payload.tripId) as any;
      const total = res?.total || 0;
      db.prepare(`UPDATE Trip SET cost_total = ? WHERE trip_id = ?`).run(total, payload.tripId);
      return total;
    })();
  });

  ipcMain.handle("db:deleteTripCost", (event, payload: { tripId: string; category: string }) => {
    assertSender(event);
    const db = getDb();
    return db.transaction(() => {
      db.prepare(`DELETE FROM CostBreakdown WHERE trip_id = ? AND category = ?`).run(payload.tripId, payload.category);

      const res = db.prepare(`SELECT SUM(amount) as total FROM CostBreakdown WHERE trip_id = ?`).get(payload.tripId) as any;
      const total = res?.total || 0;
      db.prepare(`UPDATE Trip SET cost_total = ? WHERE trip_id = ?`).run(total, payload.tripId);
      return total;
    })();
  });

  ipcMain.handle("db:getTripAttachments", (event, payload: { tripId: string }) => {
    assertSender(event);
    const db = getDb();
    return db.prepare(`
      SELECT a.* FROM Asset a
      JOIN Tag t ON t.name = a.asset_id
      WHERE t.entity_type = 'trip_attachment' AND t.entity_id = ?
    `).all(payload.tripId);
  });

  ipcMain.handle("db:removeTripAttachment", (event, payload: { tripId: string; assetId: string }) => {
    assertSender(event);
    const db = getDb();
    db.prepare(`DELETE FROM Tag WHERE entity_type = 'trip_attachment' AND entity_id = ? AND name = ?`).run(payload.tripId, payload.assetId);
    deleteAssetIfUnreferenced(payload.assetId);
    return { ok: true };
  });

  ipcMain.handle("db:setTripInlineAssets", (event, payload: { tripId: string; assetIds: string[] }) => {
    assertSender(event);
    const db = getDb();
    const next = Array.from(new Set(payload.assetIds ?? [])).filter(Boolean);
    const previous = db.prepare(`SELECT name FROM Tag WHERE entity_type = 'trip_inline_asset' AND entity_id = ?`).all(payload.tripId) as any[];
    const previousIds = previous.map((r) => r.name);
    const removed = previousIds.filter((id) => !next.includes(id));

    db.transaction(() => {
      db.prepare(`DELETE FROM Tag WHERE entity_type = 'trip_inline_asset' AND entity_id = ?`).run(payload.tripId);
      const stmt = db.prepare(`INSERT OR IGNORE INTO Tag (entity_type, entity_id, name) VALUES ('trip_inline_asset', ?, ?)`);
      for (const assetId of next) stmt.run(payload.tripId, assetId);
    })();

    for (const assetId of removed) {
      deleteAssetIfUnreferenced(assetId);
    }

    return { ok: true };
  });

  ipcMain.handle("db:updateCitySummary", (event, payload: { cityId: string; summary: string }) => {
    assertSender(event);
    const db = getDb();
    db.prepare(`UPDATE City SET summary = ? WHERE city_id = ?`).run(payload.summary, payload.cityId);
    return { ok: true };
  });

  ipcMain.handle("db:updateCityCover", (event, payload: { cityId: string; assetId: string }) => {
    assertSender(event);
    const db = getDb();
    const prev = db.prepare(`SELECT cover_asset_id FROM City WHERE city_id = ?`).get(payload.cityId) as any;
    db.prepare(`UPDATE City SET cover_asset_id = ? WHERE city_id = ?`).run(payload.assetId, payload.cityId);
    const previousCoverId = String(prev?.cover_asset_id ?? "").trim();
    const nextCoverId = String(payload.assetId ?? "").trim();
    if (previousCoverId && previousCoverId !== nextCoverId) {
      deleteAssetIfUnreferenced(previousCoverId);
    }
    return { ok: true };
  });

  ipcMain.handle("db:getPois", (event, payload: { cityId: string }) => {
    assertSender(event);
    const db = getDb();
    return db.prepare(`SELECT * FROM POI WHERE city_id = ?`).all(payload.cityId);
  });

  ipcMain.handle("db:createPoi", (event, payload: any) => {
    assertSender(event);
    const db = getDb();
    const poiId = crypto.randomUUID();
    const now = Date.now();
    
    db.transaction(() => {
      db.prepare(`
        INSERT INTO POI (poi_id, city_id, name, lng, lat, gcj02_lng, gcj02_lat, category, summary, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        poiId,
        payload.city_id,
        payload.name || "未命名地点",
        payload.lng,
        payload.lat,
        payload.gcj02_lng,
        payload.gcj02_lat,
        payload.category || "",
        payload.summary || "",
        now,
        now
      );

      if (payload.trip_id) {
        const res = db.prepare(`SELECT MAX(sort_order) as max_sort FROM Trip_POI WHERE trip_id = ?`).get(payload.trip_id) as any;
        const sortOrder = (res?.max_sort || 0) + 1;
        db.prepare(`
          INSERT INTO Trip_POI (trip_id, poi_id, sort_order) VALUES (?, ?, ?)
        `).run(payload.trip_id, poiId, sortOrder);
      }
    })();
    
    return poiId;
  });

  ipcMain.handle("db:updatePoi", (event, payload: any) => {
    assertSender(event);
    const db = getDb();
    const now = Date.now();
    db.prepare(
      `UPDATE POI SET name=?, lng=?, lat=?, gcj02_lng=?, gcj02_lat=?, category=?, summary=?, updated_at=? WHERE poi_id=?`,
    ).run(
      payload.name,
      payload.lng,
      payload.lat,
      payload.gcj02_lng,
      payload.gcj02_lat,
      payload.category,
      payload.summary,
      now,
      payload.poi_id,
    );
    return { ok: true };
  });

  ipcMain.handle("db:deletePoi", (event, payload: { poiId: string }) => {
    assertSender(event);
    const db = getDb();
    db.transaction(() => {
      db.prepare(`DELETE FROM Tag WHERE entity_type = 'poi' AND entity_id = ?`).run(payload.poiId);
      db.prepare(`DELETE FROM POI WHERE poi_id = ?`).run(payload.poiId);
    })();
    return { ok: true };
  });

  ipcMain.handle("db:getPoi", (event, payload: { poiId: string }) => {
    assertSender(event);
    const db = getDb();
    return db.prepare(`SELECT * FROM POI WHERE poi_id = ?`).get(payload.poiId);
  });

  ipcMain.handle("db:getPoisForTrip", (event, payload: { tripId: string }) => {
    assertSender(event);
    const db = getDb();
    return db.prepare(`
      SELECT POI.*, Trip_POI.sort_order
      FROM POI
      JOIN Trip_POI ON POI.poi_id = Trip_POI.poi_id
      WHERE Trip_POI.trip_id = ?
      ORDER BY Trip_POI.sort_order ASC
    `).all(payload.tripId);
  });

  ipcMain.handle("db:addPoiToTrip", (event, payload: { tripId: string; poiId: string }) => {
    assertSender(event);
    const db = getDb();
    db.transaction(() => {
      const res = db.prepare(`SELECT MAX(sort_order) as max_sort FROM Trip_POI WHERE trip_id = ?`).get(payload.tripId) as any;
      const sortOrder = (res?.max_sort || 0) + 1;
      db.prepare(`
        INSERT OR IGNORE INTO Trip_POI (trip_id, poi_id, sort_order) VALUES (?, ?, ?)
      `).run(payload.tripId, payload.poiId, sortOrder);
    })();
    return { ok: true };
  });

  ipcMain.handle("db:removePoiFromTrip", (event, payload: { tripId: string; poiId: string }) => {
    assertSender(event);
    const db = getDb();
    db.prepare(`DELETE FROM Trip_POI WHERE trip_id = ? AND poi_id = ?`).run(payload.tripId, payload.poiId);
    return { ok: true };
  });

  ipcMain.handle("db:getTripsForPoi", (event, payload: { poiId: string }) => {
    assertSender(event);
    const db = getDb();
    return db.prepare(`
      SELECT t.*
      FROM Trip t
      JOIN Trip_POI tp ON t.trip_id = tp.trip_id
      WHERE tp.poi_id = ?
    `).all(payload.poiId);
  });

  ipcMain.handle("db:getTags", (event, payload: { entityType: string; entityId: string }) => {
    assertSender(event);
    const db = getDb();
    return db.prepare(`SELECT name FROM Tag WHERE entity_type = ? AND entity_id = ?`).all(payload.entityType, payload.entityId);
  });

  ipcMain.handle("db:addTag", (event, payload: { entityType: string; entityId: string; name: string }) => {
    assertSender(event);
    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO Tag (entity_type, entity_id, name) VALUES (?, ?, ?)`).run(payload.entityType, payload.entityId, payload.name);
    return { ok: true };
  });

  ipcMain.handle("db:removeTag", (event, payload: { entityType: string; entityId: string; name: string }) => {
    assertSender(event);
    const db = getDb();
    db.prepare(`DELETE FROM Tag WHERE entity_type = ? AND entity_id = ? AND name = ?`).run(payload.entityType, payload.entityId, payload.name);
    return { ok: true };
  });

  ipcMain.handle("file:select", async (event) => {
    assertSender(event);
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "png", "gif", "webp"] }],
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.handle("file:saveAsset", async (event, payload: { sourcePath: string; destRelativeDir: string }) => {
    assertSender(event);
    let absoluteDestPath = "";
    try {
      const sourcePath = payload.sourcePath;
      const destRelativeDir = payload.destRelativeDir;

      const sourceStat = fs.lstatSync(sourcePath);
      if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
        return { error: "Invalid source file" };
      }

      const assetId = crypto.randomUUID();
      const originalFilename = path.basename(sourcePath);
      const destFilename = `${assetId}__${originalFilename}`;

      const normalizedDestDir = path.normalize(destRelativeDir).replace(/^(?:\.\.(?:\/|\\|$))+/, "");
      if (!/^[a-zA-Z0-9/_-]*$/.test(normalizedDestDir)) {
        return { error: "Invalid destination directory" };
      }

      const userDataPath = app.getPath("userData");
      const assetsRoot = path.resolve(path.join(userDataPath, "assets"));
      absoluteDestPath = path.resolve(path.join(assetsRoot, normalizedDestDir, destFilename));

      if (!absoluteDestPath.startsWith(assetsRoot + path.sep)) {
        return { error: "Invalid destination path" };
      }

      fs.mkdirSync(path.dirname(absoluteDestPath), { recursive: true });
      fs.copyFileSync(sourcePath, absoluteDestPath);

      const stats = fs.statSync(absoluteDestPath);
      const ext = path.extname(originalFilename).toLowerCase();
      let mime = "application/octet-stream";
      if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
      else if (ext === ".png") mime = "image/png";
      else if (ext === ".gif") mime = "image/gif";
      else if (ext === ".webp") mime = "image/webp";

      const sha256 = await new Promise<string>((resolve, reject) => {
        const hashSum = crypto.createHash("sha256");
        const stream = fs.createReadStream(absoluteDestPath);
        stream.on("error", reject);
        stream.on("data", (chunk) => hashSum.update(chunk));
        stream.on("end", () => resolve(hashSum.digest("hex")));
      });

      const destRelativePath = path
        .relative(userDataPath, absoluteDestPath)
        .split(path.sep)
        .join("/");

      const db = getDb();
      const now = Date.now();
      try {
        db.prepare(`
          INSERT INTO Asset (asset_id, type, original_filename, mime, size, sha256, local_path, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(assetId, mime.startsWith("image/") ? "image" : "file", originalFilename, mime, stats.size, sha256, destRelativePath, now);
      } catch (e: any) {
        const message = String(e?.message ?? "");
        if (message.includes("UNIQUE") && message.toLowerCase().includes("sha256")) {
          const existing = db.prepare(`SELECT asset_id, local_path FROM Asset WHERE sha256 = ?`).get(sha256) as any;
          if (absoluteDestPath) {
            try {
              fs.unlinkSync(absoluteDestPath);
            } catch (err: any) {
              if (err?.code !== "ENOENT") {
                console.error(`Failed to cleanup duplicated asset file: ${absoluteDestPath}`, err);
              }
            }
          }
          if (existing?.asset_id && existing?.local_path) {
            const suffix = existing.local_path.startsWith("assets/") ? existing.local_path.slice("assets/".length) : existing.local_path;
            return { assetId: existing.asset_id, localUrl: `local://assets/${suffix}` };
          }
        }
        throw e;
      }

      const suffix = destRelativePath.startsWith("assets/") ? destRelativePath.slice("assets/".length) : destRelativePath;
      return {
        assetId,
        localUrl: `local://assets/${suffix}`
      };
    } catch (e: any) {
      if (absoluteDestPath) {
        try {
          fs.unlinkSync(absoluteDestPath);
        } catch (err: any) {
          if (err?.code !== "ENOENT") {
            console.error(`Failed to cleanup asset file: ${absoluteDestPath}`, err);
          }
        }
      }
      console.error("Failed to save asset:", e);
      return { error: e.message };
    }
  });

  ipcMain.handle(
    "file:saveAssetBytes",
    async (
      event,
      payload: { bytes: ArrayBuffer; originalFilename: string; mime: string; destRelativeDir: string },
    ) => {
      assertSender(event);
      const userDataPath = app.getPath("userData");
      const db = getDb();
      try {
        const bytes = new Uint8Array(payload.bytes);
        const now = Date.now();
        const res = await saveAssetBytesCore({
          userDataPath,
          destRelativeDir: payload.destRelativeDir,
          originalFilename: payload.originalFilename,
          bytes,
          mime: payload.mime || "application/octet-stream",
          now,
          makeId: () => crypto.randomUUID(),
          store: {
            getBySha256: async (sha256) => {
              const row = db.prepare(`SELECT asset_id, local_path FROM Asset WHERE sha256 = ?`).get(sha256) as any;
              if (!row?.asset_id || !row?.local_path) return null;
              return { assetId: row.asset_id, localPath: row.local_path };
            },
            insert: async (record) => {
              db.prepare(`
                INSERT INTO Asset (asset_id, type, original_filename, mime, size, sha256, local_path, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                record.assetId,
                record.type,
                record.originalFilename,
                record.mime,
                record.size,
                record.sha256,
                record.localPath,
                record.createdAt,
              );
              return record.assetId;
            },
          },
          fs: {
            mkdirp: async (absDir) => {
              await fs.promises.mkdir(absDir, { recursive: true });
            },
            writeFile: async (absPath, nextBytes) => {
              await fs.promises.writeFile(absPath, nextBytes);
            },
            unlink: async (absPath) => {
              try {
                await fs.promises.unlink(absPath);
              } catch (err: any) {
                if (err?.code !== "ENOENT") throw err;
              }
            },
          },
        });

        return res;
      } catch (e: any) {
        console.error("Failed to save asset bytes:", e);
        return { error: e.message };
      }
    },
  );

  ipcMain.handle("file:exportBackupZip", async (event) => {
    assertSender(event);
    const userDataPath = app.getPath("userData");
    const db = getDb();

    const now = Date.now();
    const defaultName = `travel-map-backup-${now}.zip`;
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "导出备份（zip）",
      defaultPath: path.join(userDataPath, defaultName),
      filters: [{ name: "Zip", extensions: ["zip"] }],
    });
    if (canceled || !filePath) return { canceled: true };

    const snapshotPath = path.join(userDataPath, `travel-map.sqlite.export-${now}`);
    try {
      const backupFn = (db as any).backup?.bind(db);
      if (typeof backupFn !== "function") {
        return { error: "DB backup not supported" };
      }
      await backupFn(snapshotPath);

      const assets = db
        .prepare(`SELECT asset_id, sha256, local_path, size, remote_url FROM Asset`)
        .all() as any[];

      await createBackupZip({
        zipPath: filePath,
        userDataPath,
        dbSnapshotPath: snapshotPath,
        appVersion: app.getVersion(),
        exportedAt: now,
        assets: assets.map((a) => ({
          asset_id: String(a.asset_id),
          sha256: String(a.sha256),
          local_path: String(a.local_path),
          size: Number(a.size),
          remote_url: a.remote_url ? String(a.remote_url) : null,
        })),
      });

      return { ok: true, path: filePath };
    } catch (e: any) {
      console.error("Export backup failed:", e);
      return { error: e.message };
    } finally {
      try {
        await fs.promises.unlink(snapshotPath);
      } catch (err: any) {
        if (err?.code !== "ENOENT") console.error("Cleanup snapshot failed:", err);
      }
    }
  });

  ipcMain.handle("file:openLocal", async (event, payload: { localPath: string }) => {
    assertSender(event);
    try {
      const userDataPath = app.getPath("userData");
      const assetsRoot = path.resolve(path.join(userDataPath, "assets"));
      const absolutePath = path.resolve(path.join(userDataPath, payload.localPath));
      if (!absolutePath.startsWith(assetsRoot + path.sep)) {
        return { error: "Access Denied" };
      }
      const err = await shell.openPath(absolutePath);
      if (err) return { error: err };
      return { ok: true };
    } catch (e: any) {
      return { error: e.message };
    }
  });
}
