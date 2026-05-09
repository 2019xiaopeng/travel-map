import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCitySearchIndex,
  searchCityIndex,
} from "../src/features/map/citySearchIndex.ts";

test("searchCityIndex matches city and province names", () => {
  const index = buildCitySearchIndex([
    {
      cityId: "330100",
      cityName: "杭州",
      provinceId: "330000",
      provinceName: "浙江",
      center: [120.15, 30.28],
    },
    {
      cityId: "310000",
      cityName: "上海",
      provinceId: "310000",
      provinceName: "上海",
      center: [121.47, 31.23],
    },
  ]);

  assert.deepEqual(
    searchCityIndex(index, "杭").map((item) => item.cityId),
    ["330100"],
  );
  assert.deepEqual(
    searchCityIndex(index, "上海").map((item) => item.cityId),
    ["310000"],
  );
});
