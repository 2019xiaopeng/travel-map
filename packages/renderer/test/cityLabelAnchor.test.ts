import test from "node:test";
import assert from "node:assert/strict";

import {
  pickLabelAnchor,
  normalizeFeatureLabelProps,
} from "../src/features/map/cityLabelAnchor.ts";
import type { GeoFeature } from "../src/features/map/geoTypes.ts";

const polygonFeature: GeoFeature = {
  type: "Feature",
  properties: {
    id: "330100",
    name: "杭州",
    center: [120.15, 30.28],
  },
  geometry: {
    type: "Polygon",
    coordinates: [[[120, 30], [121, 30], [121, 31], [120, 31], [120, 30]]],
  },
};

test("pickLabelAnchor respects labelAnchor over other candidates", () => {
  const anchor = pickLabelAnchor({
    labelAnchor: [120.3, 30.4],
    visualCenter: [120.2, 30.3],
    centroid: [120.1, 30.2],
    center: [120.0, 30.1],
    geometry: polygonFeature.geometry,
  });

  assert.deepEqual(anchor, [120.3, 30.4]);
});

test("normalizeFeatureLabelProps fills visualCenter and labelAnchor", () => {
  const normalized = normalizeFeatureLabelProps(polygonFeature, {
    centroid: [120.4, 30.5],
  });

  assert.deepEqual(normalized.properties.visualCenter, [120.4, 30.5]);
  assert.deepEqual(normalized.properties.labelAnchor, [120.4, 30.5]);
});
