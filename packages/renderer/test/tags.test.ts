import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTagInput } from "../src/utils/tags.ts";

test("normalizeTagInput trims", () => {
  assert.equal(normalizeTagInput("  a  "), "a");
});

test("normalizeTagInput strips leading #", () => {
  assert.equal(normalizeTagInput("#a"), "a");
});

