import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeProvinceBoundaryEnvelope,
  shouldUseBoundaryCache,
} from "../src/features/map/provinceBoundarySource.ts";

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
