import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCountryBoundaryUrl,
  buildProvinceBoundaryUrl,
} from "../src/features/map/provinceBoundaryUrl.ts";

test("buildCountryBoundaryUrl uses geojson.cn china topo endpoint", () => {
  assert.equal(
    buildCountryBoundaryUrl(),
    "https://geojson.cn/api/china/1.6.3/china.topo.json",
  );
});

test("buildProvinceBoundaryUrl swaps china with a 6-digit adcode", () => {
  assert.equal(
    buildProvinceBoundaryUrl("330000"),
    "https://geojson.cn/api/tiandi/100000/330000.json",
  );
});

test("buildProvinceBoundaryUrl uses the dedicated Taiwan endpoint", () => {
  assert.equal(
    buildProvinceBoundaryUrl("710000"),
    "https://geojson.cn/api/china/1.6.3/710000.topo.json",
  );
});

test("buildProvinceBoundaryUrl uses the dedicated Hong Kong endpoint", () => {
  assert.equal(
    buildProvinceBoundaryUrl("810000"),
    "https://geojson.cn/api/china/1.6.3/810000.topo.json",
  );
});

test("buildProvinceBoundaryUrl uses the dedicated Macau endpoint", () => {
  assert.equal(
    buildProvinceBoundaryUrl("820000"),
    "https://geojson.cn/api/china/1.6.3/820000.topo.json",
  );
});
