import test from "node:test";
import assert from "node:assert/strict";

import { getSearchBoxMotionState } from "../src/features/map/searchBoxMotion.ts";

test("getSearchBoxMotionState keeps the search shell mounted while closing", () => {
  const state = getSearchBoxMotionState(false);

  assert.equal(state.containerClass.includes("w-0"), true);
  assert.equal(state.innerClass.includes("pointer-events-none"), true);
  assert.equal(state.innerClass.includes("translate-x-2"), true);
});

test("getSearchBoxMotionState exposes interactive open-state classes", () => {
  const state = getSearchBoxMotionState(true);

  assert.equal(state.containerClass.includes("w-72"), true);
  assert.equal(state.innerClass.includes("pointer-events-auto"), true);
  assert.equal(state.panelClass.includes("opacity-100"), true);
});
