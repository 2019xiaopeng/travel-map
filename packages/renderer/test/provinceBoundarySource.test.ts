import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeProvinceBoundaryEnvelope,
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

test("normalizeProvinceBoundaryEnvelope preserves generated metadata", () => {
  const normalized = normalizeProvinceBoundaryEnvelope([
    {
      type: "Feature",
      properties: {
        id: "230000",
        name: "黑龙江",
        center: [126.6, 45.7],
        labelAnchor: [127.8, 47.2],
        visualCenter: [126.6, 45.7],
        bounds: { minLng: 121, maxLng: 135, minLat: 43, maxLat: 53 },
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[126, 45], [127, 45], [127, 46], [126, 46], [126, 45]]],
      },
    } as any,
  ]);

  assert.deepEqual(normalized[0].properties.labelAnchor, [127.8, 47.2]);
  assert.deepEqual(normalized[0].properties.visualCenter, [126.6, 45.7]);
  assert.deepEqual(normalized[0].properties.bounds, {
    minLng: 121,
    maxLng: 135,
    minLat: 43,
    maxLat: 53,
  });
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
