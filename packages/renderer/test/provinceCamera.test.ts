import test from "node:test";
import assert from "node:assert/strict";

import { getProvinceCameraTarget } from "../src/features/map/provinceCamera.ts";

test("getProvinceCameraTarget centers a province using window bounds", () => {
  const target = getProvinceCameraTarget({
    bounds: { minLng: 120, maxLng: 130, minLat: 30, maxLat: 40 },
    visualCenter: [125, 35],
    viewport: { width: 1000, height: 800 },
  });

  assert.deepEqual(target.center, [125, 35]);
  assert.ok(target.zoom > 4);
});
