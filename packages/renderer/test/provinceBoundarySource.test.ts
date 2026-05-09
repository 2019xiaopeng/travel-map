import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeProvinceBoundaryEnvelope,
  shouldUseBoundaryCache,
} from "../src/features/map/provinceBoundarySource.ts";
import {
  clearProvinceHover,
  nextProvinceHoverState,
} from "../src/features/map/provinceHoverState.ts";

test("normalizeProvinceBoundaryEnvelope rewrites 2-digit ids to 6-digit adcodes", () => {
  const normalized = normalizeProvinceBoundaryEnvelope([
    {
      type: "Feature",
      properties: { id: "33", name: "浙江", center: [120.15, 30.28] },
      geometry: {
        type: "Polygon",
        coordinates: [[[120, 30], [121, 30], [121, 31], [120, 31], [120, 30]]],
      },
    } as any,
  ]);

  assert.equal(normalized[0].properties.id, "330000");
});

test("shouldUseBoundaryCache accepts only matching cache version", () => {
  assert.equal(shouldUseBoundaryCache(null), false);
  assert.equal(shouldUseBoundaryCache({ version: 0, features: [] } as any), false);
  assert.equal(
    shouldUseBoundaryCache({
      version: 1,
      writtenAt: Date.now(),
      source: "amap",
      features: [],
    } as any),
    true,
  );
});

test("nextProvinceHoverState stores hovered province and pixel position", () => {
  const state = nextProvinceHoverState(null, {
    provinceId: "330000",
    provinceName: "浙江",
    x: 240,
    y: 120,
  });

  assert.equal(state?.provinceId, "330000");
  assert.equal(state?.x, 240);
});

test("clearProvinceHover always removes tooltip state", () => {
  assert.equal(
    clearProvinceHover({
      provinceId: "330000",
      provinceName: "浙江",
      x: 1,
      y: 2,
    }),
    null,
  );
});
