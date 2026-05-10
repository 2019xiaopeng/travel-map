import test from "node:test";
import assert from "node:assert/strict";

import { deriveCityHomeState } from "../src/components/drawer/cityHomeState.ts";

test("deriveCityHomeState returns empty for a newly created city record", () => {
  const state = deriveCityHomeState({
    loading: false,
    error: null,
    city: {
      city_id: "330100",
      province_id: "330000",
      name: "杭州市",
      tripCount: 0,
      poiCount: 0,
      totalCost: 0,
    },
  });

  assert.equal(state, "empty");
});

test("deriveCityHomeState returns error before evaluating city content", () => {
  const state = deriveCityHomeState({
    loading: false,
    error: "boom",
    city: null,
  });

  assert.equal(state, "error");
});

test("deriveCityHomeState returns ready when city already has content", () => {
  const state = deriveCityHomeState({
    loading: false,
    error: null,
    city: {
      city_id: "330100",
      province_id: "330000",
      name: "杭州市",
      summary: "西湖很好看",
      tripCount: 0,
      poiCount: 0,
      totalCost: 0,
    },
  });

  assert.equal(state, "ready");
});
