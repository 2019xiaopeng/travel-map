import test from "node:test";
import assert from "node:assert/strict";

import { formatBackupWarnings } from "../src/utils/backupWarnings.ts";

test("formatBackupWarnings returns empty string for empty warnings", () => {
  assert.equal(formatBackupWarnings([]), "");
});

test("formatBackupWarnings summarizes warnings count and first items", () => {
  const s = formatBackupWarnings([
    { type: "missing_file", asset_id: "a1", message: "assets/x" },
    { type: "metadata_mismatch", asset_id: "a2", message: "assets/y" },
  ]);
  assert.equal(s.includes("发现 2 条异常"), true);
  assert.equal(s.includes("missing_file"), true);
  assert.equal(s.includes("metadata_mismatch"), true);
});

