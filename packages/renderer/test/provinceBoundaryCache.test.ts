import test from "node:test";
import assert from "node:assert/strict";

import {
  BOUNDARY_CACHE_VERSION,
  createBoundaryCachePayload,
  isBoundaryCachePayload,
} from "../src/features/map/provinceBoundaryCache.ts";

test("createBoundaryCachePayload stamps the current version", () => {
  const payload = createBoundaryCachePayload([
    {
      type: "Feature",
      properties: {
        id: "330000",
        name: "浙江",
        center: [120.15, 30.28],
      },
      geometry: {
        type: "Polygon",
        coordinates: [],
      },
    } as any,
  ]);

  assert.equal(payload.version, BOUNDARY_CACHE_VERSION);
  assert.equal(Array.isArray(payload.features), true);
});

test("isBoundaryCachePayload rejects stale or malformed payloads", () => {
  assert.equal(isBoundaryCachePayload(null), false);
  assert.equal(isBoundaryCachePayload({ version: 0, features: [] }), false);
  assert.equal(
    isBoundaryCachePayload({
      version: BOUNDARY_CACHE_VERSION,
      writtenAt: Date.now(),
      source: "amap",
      features: [],
    }),
    true,
  );
});
