import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCitySearchIndex,
  getSearchMatchParts,
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

test("searchCityIndex prefers prefix matches before contains matches", () => {
  const index = buildCitySearchIndex([
    {
      cityId: "110000",
      cityName: "北京",
      provinceId: "110000",
      provinceName: "北京",
      center: [116.4, 39.9],
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
    searchCityIndex(index, "北").map((item) => item.cityId),
    ["110000"],
  );
  assert.deepEqual(
    searchCityIndex(index, "海").map((item) => item.cityId),
    ["310000"],
  );
});

test("getSearchMatchParts splits the matched keyword span", () => {
  assert.deepEqual(getSearchMatchParts("北京", "北"), [
    { text: "北", matched: true },
    { text: "京", matched: false },
  ]);
});
