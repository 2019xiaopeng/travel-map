import test from "node:test";
import assert from "node:assert/strict";

import { getProvinceCameraTarget } from "../src/features/map/provinceCamera.ts";

test("getProvinceCameraTarget centers a province using window bounds", () => {
  const target = getProvinceCameraTarget({
    provinceId: "330000",
    bounds: { minLng: 120, maxLng: 130, minLat: 30, maxLat: 40 },
    visualCenter: [125, 35],
    viewport: { width: 1000, height: 800 },
  });

  assert.ok(target.center[0] > 125);
  assert.equal(target.center[1], 35);
  assert.ok(target.zoom > 4);
});

test("getProvinceCameraTarget shifts the province toward the left third of the window", () => {
  const target = getProvinceCameraTarget({
    provinceId: "330000",
    bounds: { minLng: 118, maxLng: 123, minLat: 27, maxLat: 31 },
    visualCenter: [120.15, 29.2],
    viewport: { width: 1440, height: 900 },
  });

  assert.ok(target.center[0] > 120.15);
});

test("getProvinceCameraTarget applies a positive zoom bias for normal provinces", () => {
  const target = getProvinceCameraTarget({
    provinceId: "330000",
    bounds: { minLng: 118, maxLng: 123, minLat: 27, maxLat: 31 },
    visualCenter: [120.15, 29.2],
    viewport: { width: 1200, height: 900 },
  });

  assert.ok(target.zoom > 6);
});

test("getProvinceCameraTarget keeps Taiwan under a tighter max zoom", () => {
  const target = getProvinceCameraTarget({
    provinceId: "710000",
    bounds: { minLng: 120.0, maxLng: 122.1, minLat: 21.8, maxLat: 25.4 },
    visualCenter: [121, 23.7],
    viewport: { width: 1200, height: 900 },
  });

  assert.ok(target.zoom <= 9);
});
