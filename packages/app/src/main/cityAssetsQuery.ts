import type Database from "better-sqlite3";

export interface CityAssetRow {
  asset_id: string;
  type: string;
  original_filename: string;
  mime: string;
  size: number;
  local_path: string;
  created_at: number;
  trip_id: string | null;
  trip_title: string | null;
  source_kind: "city_inbox" | "attachment" | "inline";
}

export function getCityAssets(db: Database.Database, cityId: string): CityAssetRow[] {
  const rows = db
    .prepare(
      `
      SELECT
        a.asset_id,
        a.type,
        a.original_filename,
        a.mime,
        a.size,
        a.local_path,
        a.created_at,
        t.trip_id,
        t.title AS trip_title,
        CASE
          WHEN tag.entity_type = 'city_asset' THEN 'city_inbox'
          WHEN tag.entity_type = 'trip_attachment' THEN 'attachment'
          ELSE 'inline'
        END AS source_kind,
        CASE
          WHEN tag.entity_type = 'city_asset' THEN 0
          WHEN tag.entity_type = 'trip_attachment' THEN 1
          ELSE 2
        END AS source_priority,
        COALESCE(t.updated_at, a.created_at) AS updated_at
      FROM Tag tag
      JOIN Asset a
        ON a.asset_id = tag.name
      LEFT JOIN Trip t
        ON tag.entity_id = t.trip_id
       AND tag.entity_type IN ('trip_attachment', 'trip_inline_asset')
      WHERE (
          tag.entity_type = 'city_asset'
          AND tag.entity_id = ?
        ) OR (
          tag.entity_type IN ('trip_attachment', 'trip_inline_asset')
          AND t.city_id = ?
        )
      ORDER BY t.updated_at DESC, a.created_at DESC, source_priority ASC
    `,
    )
    .all(cityId, cityId) as Array<CityAssetRow & { source_priority: number; updated_at: number }>;

  const deduped = new Map<string, CityAssetRow>();
  for (const row of rows) {
    if (deduped.has(row.asset_id)) continue;
    deduped.set(row.asset_id, {
      asset_id: row.asset_id,
      type: row.type,
      original_filename: row.original_filename,
      mime: row.mime,
      size: row.size,
      local_path: row.local_path,
      created_at: row.created_at,
      trip_id: row.trip_id,
      trip_title: row.trip_title,
      source_kind: row.source_kind,
    });
  }

  return Array.from(deduped.values());
}
