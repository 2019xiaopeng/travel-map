import test from "node:test";
import assert from "node:assert/strict";

import { useMapStore } from "../src/features/map/mapStore.ts";

function resetStore() {
  useMapStore.setState({
    level: "country",
    provinceId: null,
    provinceName: null,
    cityId: null,
    cityName: null,
    drawerOpen: false,
    selectedPoiId: null,
    selectedTripId: null,
    addingPoi: false,
    poiDraft: null,
  });
}

test("enterProvince opens province context", () => {
  resetStore();
  useMapStore.getState().enterProvince("330000", "浙江");
  const state = useMapStore.getState();

  assert.equal(state.level, "province");
  assert.equal(state.provinceName, "浙江");
  assert.equal(state.drawerOpen, true);
});

test("closing drawer preserves selected city context", () => {
  resetStore();
  useMapStore.getState().enterProvince("330000", "浙江");
  useMapStore.getState().enterCity("330100", "杭州");
  useMapStore.getState().setDrawerOpen(false);
  const state = useMapStore.getState();

  assert.equal(state.level, "city");
  assert.equal(state.cityName, "杭州");
  assert.equal(state.drawerOpen, false);
});

test("backToProvince keeps province overview open", () => {
  resetStore();
  useMapStore.getState().enterProvince("330000", "浙江");
  useMapStore.getState().enterCity("330100", "杭州");
  useMapStore.getState().backToProvince();
  const state = useMapStore.getState();

  assert.equal(state.level, "province");
  assert.equal(state.provinceName, "浙江");
  assert.equal(state.cityId, null);
  assert.equal(state.drawerOpen, true);
});
