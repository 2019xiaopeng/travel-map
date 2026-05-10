import test from "node:test";
import assert from "node:assert/strict";

import { getCityAssets } from "../src/main/cityAssetsQuery.ts";

function createDbMock(rows: any[]) {
  return {
    prepare() {
      return {
        all(cityId: string) {
          assert.equal(cityId, "330100");
          return rows;
        },
      };
    },
  };
}

test("getCityAssets merges trip attachments and inline assets, deduping by asset id", () => {
  const db = createDbMock([
    {
      asset_id: "asset-1",
      type: "image",
      original_filename: "west-lake.jpg",
      mime: "image/jpeg",
      size: 10,
      local_path: "assets/cities/330100/trips/trip-a/photos/asset-1__west-lake.jpg",
      created_at: 300,
      trip_id: "trip-a",
      trip_title: "春游杭州",
      source_kind: "attachment",
      source_priority: 0,
      updated_at: 200,
    },
    {
      asset_id: "asset-1",
      type: "image",
      original_filename: "west-lake.jpg",
      mime: "image/jpeg",
      size: 10,
      local_path: "assets/cities/330100/trips/trip-a/photos/asset-1__west-lake.jpg",
      created_at: 300,
      trip_id: "trip-a",
      trip_title: "春游杭州",
      source_kind: "inline",
      source_priority: 1,
      updated_at: 200,
    },
    {
      asset_id: "asset-2",
      type: "file",
      original_filename: "plan.pdf",
      mime: "application/pdf",
      size: 20,
      local_path: "assets/cities/330100/trips/trip-a/docs/asset-2__plan.pdf",
      created_at: 250,
      trip_id: "trip-a",
      trip_title: "春游杭州",
      source_kind: "attachment",
      source_priority: 0,
      updated_at: 200,
    },
  ]) as any;

  const rows = getCityAssets(db, "330100");

  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => ({
      asset_id: row.asset_id,
      source_kind: row.source_kind,
      trip_title: row.trip_title,
    })),
    [
      { asset_id: "asset-1", source_kind: "attachment", trip_title: "春游杭州" },
      { asset_id: "asset-2", source_kind: "attachment", trip_title: "春游杭州" },
    ],
  );
});
