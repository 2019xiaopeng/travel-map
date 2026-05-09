import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeProvinceBoundaryRecord,
  shouldAlwaysShowProvinceLabel,
} from "../src/features/map/provinceBoundaryDataset.ts";

test("normalizeProvinceBoundaryRecord preserves 6-digit id and label anchor", () => {
  const record = normalizeProvinceBoundaryRecord({
    id: "230000",
    name: "黑龙江",
    fullname: "黑龙江省",
    center: [126.661998, 45.742253],
    geometry: {
      type: "Polygon",
      coordinates: [[[126, 45], [127, 45], [127, 46], [126, 46], [126, 45]]],
    },
  });

  assert.equal(record.id, "230000");
  assert.deepEqual(record.labelAnchor, [126.661998, 45.742253]);
  assert.ok(record.bounds.maxLng > record.bounds.minLng);
});

test("shouldAlwaysShowProvinceLabel keeps special provinces visible", () => {
  assert.equal(shouldAlwaysShowProvinceLabel("230000"), true);
  assert.equal(shouldAlwaysShowProvinceLabel("150000"), true);
  assert.equal(shouldAlwaysShowProvinceLabel("330000"), false);
});
