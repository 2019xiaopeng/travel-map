import test from "node:test";
import assert from "node:assert/strict";

import {
  getProvinceDetailCard,
  getProvinceCapitalPlaceholder,
} from "../src/features/map/provinceDetailData.ts";
import { getProvinceCityNames } from "../src/features/map/provinceCityList.ts";

test("getProvinceDetailCard returns Zhejiang capital metadata", () => {
  const detail = getProvinceDetailCard("330000");

  assert.equal(detail.capitalName, "杭州");
  assert.equal(detail.imageSrc, "/images/capitals/capital-placeholder.svg");
});

test("getProvinceCapitalPlaceholder falls back for unknown province", () => {
  const fallback = getProvinceCapitalPlaceholder("990000");

  assert.equal(fallback.capitalName, "暂无省会图片");
});

test("getProvinceCityNames deduplicates and sorts city labels", () => {
  const names = getProvinceCityNames([
    {
      type: "Feature",
      properties: { id: "330100", name: "杭州", center: [120.15, 30.28] },
      geometry: { type: "Polygon", coordinates: [] },
    } as any,
    {
      type: "Feature",
      properties: { id: "330700", name: "金华", center: [119.65, 29.08] },
      geometry: { type: "Polygon", coordinates: [] },
    } as any,
    {
      type: "Feature",
      properties: { id: "330100", name: "杭州", center: [120.15, 30.28] },
      geometry: { type: "Polygon", coordinates: [] },
    } as any,
  ]);

  assert.deepEqual(names, ["杭州", "金华"]);
});
