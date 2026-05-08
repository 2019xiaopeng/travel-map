import test from "node:test";
import assert from "node:assert/strict";

import {
  featureCenter,
  getDrawerFitPadding,
  geometryBounds,
} from "../src/features/map/geoUtils.ts";

test("getDrawerFitPadding tracks drawer visibility", () => {
  assert.deepEqual(getDrawerFitPadding({ drawerOpen: true }), [80, 560, 80, 80]);
  assert.deepEqual(getDrawerFitPadding({ drawerOpen: false }), [80, 80, 80, 80]);
});

test("featureCenter uses geometry bounds midpoint", () => {
  const center = featureCenter({
    type: "Polygon",
    coordinates: [[[120, 30], [124, 30], [124, 34], [120, 34], [120, 30]]],
  });

  assert.deepEqual(center, [122, 32]);
});

test("geometryBounds works for multipolygon coordinates", () => {
  const bounds = geometryBounds({
    type: "MultiPolygon",
    coordinates: [
      [[[118, 28], [119, 28], [119, 29], [118, 29], [118, 28]]],
      [[[121, 31], [123, 31], [123, 33], [121, 33], [121, 31]]],
    ],
  });

  assert.deepEqual(bounds, {
    minLng: 118,
    maxLng: 123,
    minLat: 28,
    maxLat: 33,
  });
});
