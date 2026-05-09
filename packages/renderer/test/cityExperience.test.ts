import test from "node:test";
import assert from "node:assert/strict";

import { useMapStore } from "../src/features/map/mapStore.ts";
import { openCityExperience } from "../src/features/map/cityExperience.ts";

function resetStore() {
  useMapStore.setState({
    level: "country",
    provinceId: null,
    provinceName: null,
    cityId: null,
    cityName: null,
    provinceCityFeatures: [],
    drawerOpen: false,
    selectedPoiId: null,
    selectedTripId: null,
    addingPoi: false,
    poiDraft: null,
  });
}

test("openCityExperience opens province and city detail in one flow", () => {
  resetStore();

  const map = {
    setZoomAndCenterCalled: false,
    setZoomAndCenter(_zoom: number, _center: [number, number]) {
      this.setZoomAndCenterCalled = true;
    },
  } as any;

  openCityExperience(map, {
    provinceId: "330000",
    provinceName: "浙江",
    cityId: "330100",
    cityName: "杭州",
    center: [120.15, 30.28],
  });

  const state = useMapStore.getState();
  assert.equal(state.level, "city");
  assert.equal(state.provinceId, "330000");
  assert.equal(state.cityId, "330100");
  assert.equal(state.drawerOpen, true);
  assert.equal(map.setZoomAndCenterCalled, true);
});
