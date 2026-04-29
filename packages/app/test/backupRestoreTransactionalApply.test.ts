import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { applyPendingRestoreIfPresent } from "../src/main/backupRestore.ts";

async function writePending(userDataPath: string, stagingPath: string) {
  await fs.promises.writeFile(path.join(userDataPath, "restore-pending.json"), JSON.stringify({ stagingPath }, null, 2), "utf8");
}

test("applyPendingRestoreIfPresent recovers when crash happens after db swapped but before assets swapped", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  const currentDb = path.join(userDataPath, "travel-map.sqlite");
  const currentAssets = path.join(userDataPath, "assets");
  await fs.promises.mkdir(path.join(currentAssets, "cities/old"), { recursive: true });
  await fs.promises.writeFile(currentDb, "old-db");
  await fs.promises.writeFile(path.join(currentAssets, "cities/old/a.txt"), "old");

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  const stagedDb = path.join(stagingPath, "travel-map.sqlite");
  const stagedAssets = path.join(stagingPath, "assets");
  await fs.promises.mkdir(path.join(stagedAssets, "cities/new"), { recursive: true });
  await fs.promises.writeFile(stagedDb, "new-db");
  await fs.promises.writeFile(path.join(stagedAssets, "cities/new/b.txt"), "new");

  await writePending(userDataPath, stagingPath);

  const now = 2;
  const dbBak = `${currentDb}.bak-${now}`;
  const assetsBak = path.join(userDataPath, `assets.bak-${now}`);

  await fs.promises.rename(currentDb, dbBak);
  await fs.promises.rename(currentAssets, assetsBak);
  await fs.promises.rename(stagedDb, currentDb);

  const txPath = path.join(userDataPath, "restore-transaction.json");
  await fs.promises.writeFile(
    txPath,
    JSON.stringify(
      {
        version: 1,
        now,
        stagingPath,
        phase: "db_swapped",
        paths: { currentDb, currentAssets, dbBak, assetsBak },
      },
      null,
      2,
    ),
    "utf8",
  );

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 3 });
  assert.equal(applied, true);

  assert.equal(await fs.promises.readFile(currentDb, "utf8"), "new-db");
  assert.equal(fs.existsSync(path.join(currentAssets, "cities/new/b.txt")), true);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-pending.json")), false);
  assert.equal(fs.existsSync(txPath), false);
});
