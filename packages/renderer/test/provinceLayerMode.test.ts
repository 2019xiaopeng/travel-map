import test from "node:test";
import assert from "node:assert/strict";

import { getProvinceLayerModeConfig } from "../src/features/map/provinceLayerMode.ts";

test("getProvinceLayerModeConfig keeps a shared delayed clear for country mode", () => {
  const config = getProvinceLayerModeConfig("country");

  assert.equal(config.fitView, true);
  assert.equal(config.fillOpacity, 0.035);
  assert.equal(config.hoverClearDelayMs, 90);
  assert.ok(config.outlineZIndex < config.zIndex);
});

test("getProvinceLayerModeConfig keeps the same hover stability rules in overlay mode", () => {
  const config = getProvinceLayerModeConfig("overlay");

  assert.equal(config.fitView, false);
  assert.ok(config.fillOpacity < 0.02);
  assert.ok(config.zIndex < 60);
  assert.equal(config.hoverClearDelayMs, 90);
  assert.ok(config.outlineZIndex < config.zIndex);
});
