import test from "node:test";
import assert from "node:assert/strict";

import {
  isMunicipalityProvince,
  pickProvinceSubdivisionFeatures,
} from "../src/features/map/cityBoundaryScope.ts";
import type { GeoFeature } from "../src/features/map/geoTypes.ts";

function makeFeature(
  id: string,
  name: string,
  level: string,
  parentAdcode: string,
): GeoFeature {
  return {
    type: "Feature",
    properties: {
      id,
      name,
      center: [120, 30],
      level,
      parentAdcode,
    },
    geometry: {
      type: "Polygon",
      coordinates: [],
    },
  };
}

test("isMunicipalityProvince recognizes the four municipalities", () => {
  assert.equal(isMunicipalityProvince("110000"), true);
  assert.equal(isMunicipalityProvince("120000"), true);
  assert.equal(isMunicipalityProvince("310000"), true);
  assert.equal(isMunicipalityProvince("500000"), true);
  assert.equal(isMunicipalityProvince("330000"), false);
});

test("pickProvinceSubdivisionFeatures keeps city level for normal provinces", () => {
  const result = pickProvinceSubdivisionFeatures({
    provinceAdcode: "330000",
    features: [
      makeFeature("330100", "杭州", "city", "330000"),
      makeFeature("330106", "西湖区", "district", "330000"),
    ],
  });

  assert.deepEqual(
    result.map((item) => item.properties.id),
    ["330100"],
  );
});

test("pickProvinceSubdivisionFeatures falls back to district for municipalities", () => {
  const result = pickProvinceSubdivisionFeatures({
    provinceAdcode: "110000",
    features: [
      makeFeature("110101", "东城区", "district", "110000"),
      makeFeature("110102", "西城区", "district", "110000"),
    ],
  });

  assert.deepEqual(
    result.map((item) => item.properties.id),
    ["110101", "110102"],
  );
});
