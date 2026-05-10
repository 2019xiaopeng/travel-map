import test from "node:test";
import assert from "node:assert/strict";

import { getProvinceLayerModeConfig } from "../src/features/map/provinceLayerMode.ts";

test("getProvinceLayerModeConfig keeps fitView on for country mode", () => {
  const config = getProvinceLayerModeConfig("country");

  assert.equal(config.fitView, true);
  assert.equal(config.fillOpacity, 0.035);
});

test("getProvinceLayerModeConfig disables fitView and weakens overlay mode", () => {
  const config = getProvinceLayerModeConfig("overlay");

  assert.equal(config.fitView, false);
  assert.ok(config.fillOpacity < 0.02);
  assert.ok(config.zIndex < 60);
});
