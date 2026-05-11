import type Database from "better-sqlite3";
import crypto from "crypto";

export type CityIdentity = {
  provinceId: string;
  provinceName: string;
  cityId: string;
  cityName: string;
};

export function ensureProvinceExists(
  db: Database.Database,
  input: Pick<CityIdentity, "provinceId" | "provinceName">,
) {
  db.prepare(
    `INSERT INTO Province (province_id, name)
     VALUES (?, ?)
     ON CONFLICT(province_id) DO UPDATE SET name=excluded.name`,
  ).run(input.provinceId, input.provinceName);
}

export function ensureCityExists(db: Database.Database, input: CityIdentity) {
  ensureProvinceExists(db, input);
  db.prepare(
    `INSERT INTO City (city_id, province_id, name)
     VALUES (?, ?, ?)
     ON CONFLICT(city_id) DO UPDATE SET
       province_id=excluded.province_id,
       name=excluded.name`,
  ).run(input.cityId, input.provinceId, input.cityName);
}

export function updateCityVisitStateRecord(
  db: Database.Database,
  input: CityIdentity & {
    visitState: "unrecorded" | "wishlist" | "visited";
  },
) {
  ensureCityExists(db, input);
  db.prepare(`UPDATE City SET visit_state = ? WHERE city_id = ?`).run(
    input.visitState,
    input.cityId,
  );
  return { ok: true };
}

export function createTripRecord(
  db: Database.Database,
  payload: CityIdentity & {
    city_id?: string;
    title?: string;
    date_start?: string;
    date_end?: string;
    companions?: string;
    route?: string;
    cost_total?: number;
    cover_asset_id?: string | null;
    content?: string;
  },
) {
  const tripId = crypto.randomUUID();
  const now = Date.now();
  ensureCityExists(db, payload);
  db.prepare(`
    INSERT INTO Trip (trip_id, city_id, title, date_start, date_end, companions, route, cost_total, cover_asset_id, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tripId,
    payload.city_id ?? payload.cityId,
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
}
