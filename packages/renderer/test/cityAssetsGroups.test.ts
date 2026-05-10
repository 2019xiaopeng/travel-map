import test from "node:test";
import assert from "node:assert/strict";

import { groupCityAssets } from "../src/components/drawer/cityAssetsGroups.ts";

test("groupCityAssets puts city inbox items before trip groups", () => {
  const grouped = groupCityAssets([
    {
      asset_id: "city-1",
      type: "file",
      original_filename: "攻略.pdf",
      mime: "application/pdf",
      size: 10,
      local_path: "assets/cities/370700/inbox/docs/攻略.pdf",
      created_at: 1,
      trip_id: null,
      trip_title: null,
      source_kind: "city_inbox",
    },
    {
      asset_id: "trip-1",
      type: "image",
      original_filename: "photo.jpg",
      mime: "image/jpeg",
      size: 20,
      local_path: "assets/cities/370700/trips/a/photo.jpg",
      created_at: 2,
      trip_id: "trip-a",
      trip_title: "潍坊周末",
      source_kind: "attachment",
    },
  ]);

  assert.equal(grouped.unclassified.length, 1);
  assert.equal(grouped.tripGroups.length, 1);
  assert.equal(grouped.tripGroups[0].tripTitle, "潍坊周末");
});
