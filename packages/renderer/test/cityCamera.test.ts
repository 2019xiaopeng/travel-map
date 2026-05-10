import test from "node:test";
import assert from "node:assert/strict";

import { getCityCameraTarget } from "../src/features/map/cityCamera.ts";

test("getCityCameraTarget shifts the visual center left when the drawer is open", () => {
  const target = getCityCameraTarget({
    bounds: { minLng: 119.8, maxLng: 120.6, minLat: 29.9, maxLat: 30.5 },
    visualCenter: [120.2, 30.2],
    viewport: { width: 1440, height: 900 },
    drawerOpen: true,
  });

  assert.ok(target.center[0] < 120.2);
});

test("getCityCameraTarget keeps drawer-closed targets closer to the original center", () => {
  const openTarget = getCityCameraTarget({
    bounds: { minLng: 121.0, maxLng: 121.8, minLat: 30.8, maxLat: 31.4 },
    visualCenter: [121.4, 31.1],
    viewport: { width: 1440, height: 900 },
    drawerOpen: true,
  });
  const closedTarget = getCityCameraTarget({
    bounds: { minLng: 121.0, maxLng: 121.8, minLat: 30.8, maxLat: 31.4 },
    visualCenter: [121.4, 31.1],
    viewport: { width: 1440, height: 900 },
    drawerOpen: false,
  });

  assert.ok(openTarget.center[0] < closedTarget.center[0]);
  assert.ok(openTarget.zoom > 0);
  assert.ok(closedTarget.zoom > 0);
});
