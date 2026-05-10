import test from "node:test";
import assert from "node:assert/strict";

import { getCityWorkbenchCopy } from "../src/components/drawer/cityWorkbenchCopy.ts";

test("getCityWorkbenchCopy favors action-first copy for unrecorded cities", () => {
  const copy = getCityWorkbenchCopy("unrecorded", 0);

  assert.equal(copy.badge, "未记录");
  assert.match(copy.title, /开始/);
  assert.match(copy.description, /先记一次旅行|导入/);
});

test("getCityWorkbenchCopy keeps wishlist wording for cities not yet visited", () => {
  const copy = getCityWorkbenchCopy("wishlist", 0);

  assert.equal(copy.badge, "想去");
  assert.match(copy.description, /导入图片、PDF 和文档/);
});

test("getCityWorkbenchCopy upgrades cities with trips to visited wording", () => {
  const copy = getCityWorkbenchCopy("unrecorded", 2);

  assert.equal(copy.visitState, "visited");
  assert.equal(copy.badge, "去过");
  assert.match(copy.title, /继续补充/);
});
