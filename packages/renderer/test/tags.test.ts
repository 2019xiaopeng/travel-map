import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTagInput, validateTagInput } from "../src/utils/tags.ts";

test("normalizeTagInput trims", () => {
  assert.equal(normalizeTagInput("  a  "), "a");
});

test("normalizeTagInput strips leading #", () => {
  assert.equal(normalizeTagInput("#a"), "a");
});

test("validateTagInput rejects whitespace", () => {
  const r = validateTagInput("a b");
  assert.equal(r.ok, false);
});

test("validateTagInput rejects overlong", () => {
  const r = validateTagInput("a".repeat(40));
  assert.equal(r.ok, false);
});

test("validateTagInput accepts normalized", () => {
  const r = validateTagInput(" #abc ");
  assert.deepEqual(r, { ok: true, value: "abc" });
});
