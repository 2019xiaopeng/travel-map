import test from "node:test";
import assert from "node:assert/strict";

import { formatBackupWarningsGrouped } from "../src/utils/backupWarnings.ts";

test("formatBackupWarningsGrouped returns empty string for empty list", () => {
  assert.equal(formatBackupWarningsGrouped([]), "");
});

test("formatBackupWarningsGrouped prioritizes high-risk types and aggregates counts", () => {
  const s = formatBackupWarningsGrouped([
    { type: "import_missing_asset", asset_id: "a1", message: "assets/a" },
    { type: "import_missing_asset", asset_id: "a2", message: "assets/b" },
    { type: "import_asset_sha256_mismatch", asset_id: "a3", message: "assets/c" },
    { type: "import_asset_sha256_validation_partial", message: "200/999" },
    { type: "metadata_mismatch", asset_id: "a4", message: "assets/d" },
  ]);
  assert.equal(s.includes("高风险"), true);
  assert.equal(s.includes("import_missing_asset ×2"), true);
  assert.equal(s.includes("import_asset_sha256_mismatch ×1"), true);
  assert.equal(s.includes("示例"), true);
  assert.equal(s.includes("汇总"), true);
  assert.equal(s.includes("metadata_mismatch ×1"), true);
});
