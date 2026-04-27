import { ipcMain, dialog } from "electron";
import { getDb } from "./db";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { app } from "electron";

export function setupIpc() {
  const assertSender = (event: Electron.IpcMainInvokeEvent) => {
    const url = event.senderFrame?.url ?? "";
    if (url.startsWith("file://")) return;
    if (url.startsWith("http://localhost")) return;
    if (url.startsWith("http://127.0.0.1")) return;
    throw new Error("Unauthorized sender");
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
    return { ok: true };
  });

  ipcMain.handle("db:deleteTrip", (event, payload: { tripId: string }) => {
    assertSender(event);
    const db = getDb();
    db.prepare(`DELETE FROM Trip WHERE trip_id = ?`).run(payload.tripId);
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
    db.prepare(`
      INSERT INTO CostBreakdown (trip_id, category, amount)
      VALUES (?, ?, ?)
      ON CONFLICT(trip_id, category) DO UPDATE SET amount=excluded.amount
    `).run(payload.tripId, payload.category, payload.amount);

    const res = db.prepare(`SELECT SUM(amount) as total FROM CostBreakdown WHERE trip_id = ?`).get(payload.tripId) as any;
    const total = res?.total || 0;
    db.prepare(`UPDATE Trip SET cost_total = ? WHERE trip_id = ?`).run(total, payload.tripId);
    return total;
  });

  ipcMain.handle("db:deleteTripCost", (event, payload: { tripId: string; category: string }) => {
    assertSender(event);
    const db = getDb();
    db.prepare(`DELETE FROM CostBreakdown WHERE trip_id = ? AND category = ?`).run(payload.tripId, payload.category);

    const res = db.prepare(`SELECT SUM(amount) as total FROM CostBreakdown WHERE trip_id = ?`).get(payload.tripId) as any;
    const total = res?.total || 0;
    db.prepare(`UPDATE Trip SET cost_total = ? WHERE trip_id = ?`).run(total, payload.tripId);
    return total;
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

  ipcMain.handle("db:updateCitySummary", (event, payload: { cityId: string; summary: string }) => {
    assertSender(event);
    const db = getDb();
    db.prepare(`UPDATE City SET summary = ? WHERE city_id = ?`).run(payload.summary, payload.cityId);
    return { ok: true };
  });

  ipcMain.handle("db:updateCityCover", (event, payload: { cityId: string; assetId: string }) => {
    assertSender(event);
    const db = getDb();
    db.prepare(`UPDATE City SET cover_asset_id = ? WHERE city_id = ?`).run(payload.assetId, payload.cityId);
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
    db.prepare(`
      INSERT INTO POI (poi_id, city_id, name, lng, lat, gcj02_lng, gcj02_lat, category, summary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      poiId,
      payload.city_id,
      payload.name,
      payload.lng,
      payload.lat,
      payload.gcj02_lng,
      payload.gcj02_lat,
      payload.category || "other",
      payload.summary || "",
      now,
      now,
    );
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
    db.prepare(`DELETE FROM POI WHERE poi_id = ?`).run(payload.poiId);
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
      SELECT p.*, tp.sort_order
      FROM POI p
      JOIN Trip_POI tp ON p.poi_id = tp.poi_id
      WHERE tp.trip_id = ?
      ORDER BY tp.sort_order ASC
    `).all(payload.tripId);
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
      const absoluteDestPath = path.resolve(path.join(assetsRoot, normalizedDestDir, destFilename));

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
      db.prepare(`
        INSERT INTO Asset (asset_id, type, original_filename, mime, size, sha256, local_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(assetId, mime.startsWith("image/") ? "image" : "file", originalFilename, mime, stats.size, sha256, destRelativePath, now);

      return {
        assetId,
        localUrl: `local:///${destRelativePath}`
      };
    } catch (e: any) {
      console.error("Failed to save asset:", e);
      return { error: e.message };
    }
  });
}
