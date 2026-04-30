import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { applyPendingRestoreIfPresent } from "../src/main/backupRestore.ts";

async function writeJson(p: string, v: any) {
  await fs.promises.writeFile(p, JSON.stringify(v, null, 2), "utf8");
}

async function writePending(userDataPath: string, stagingPath: string) {
  await writeJson(path.join(userDataPath, "restore-pending.json"), { stagingPath });
}

async function writeTx(userDataPath: string, tx: any) {
  await writeJson(path.join(userDataPath, "restore-transaction.json"), tx);
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
  await writeTx(userDataPath, { version: 1, now, stagingPath, phase: "db_swapped", paths: { currentDb, currentAssets, dbBak, assetsBak } });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 3 });
  assert.equal(applied, true);

  assert.equal(await fs.promises.readFile(currentDb, "utf8"), "new-db");
  assert.equal(fs.existsSync(path.join(currentAssets, "cities/new/b.txt")), true);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-pending.json")), false);
  assert.equal(fs.existsSync(txPath), false);
});

test("applyPendingRestoreIfPresent recovers from phase=backed_up and completes swap", async () => {
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

  const now = 2;
  const dbBak = `${currentDb}.bak-${now}`;
  const assetsBak = path.join(userDataPath, `assets.bak-${now}`);
  await fs.promises.rename(currentDb, dbBak);
  await fs.promises.rename(currentAssets, assetsBak);

  await writePending(userDataPath, stagingPath);
  await writeTx(userDataPath, { version: 1, now, stagingPath, phase: "backed_up", paths: { currentDb, currentAssets, dbBak, assetsBak } });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 3 });
  assert.equal(applied, true);
  assert.equal(await fs.promises.readFile(currentDb, "utf8"), "new-db");
  assert.equal(fs.existsSync(path.join(currentAssets, "cities/new/b.txt")), true);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-pending.json")), false);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-transaction.json")), false);
});

test("applyPendingRestoreIfPresent recovers from phase=assets_swapped and commits/cleans", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  const currentDb = path.join(userDataPath, "travel-map.sqlite");
  const currentAssets = path.join(userDataPath, "assets");
  await fs.promises.mkdir(path.join(currentAssets, "cities/new"), { recursive: true });
  await fs.promises.writeFile(currentDb, "new-db");
  await fs.promises.writeFile(path.join(currentAssets, "cities/new/b.txt"), "new");

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  await fs.promises.mkdir(path.join(stagingPath, "assets"), { recursive: true });

  await writePending(userDataPath, stagingPath);
  await writeTx(userDataPath, {
    version: 1,
    now: 2,
    stagingPath,
    phase: "assets_swapped",
    paths: { currentDb, currentAssets, dbBak: `${currentDb}.bak-2`, assetsBak: path.join(userDataPath, "assets.bak-2") },
  });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 3 });
  assert.equal(applied, true);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-pending.json")), false);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-transaction.json")), false);
});

test("applyPendingRestoreIfPresent clears invalid restore-transaction.json and does not crash", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });
  const txPath = path.join(userDataPath, "restore-transaction.json");
  await fs.promises.writeFile(txPath, "{", "utf8");

  const res = await applyPendingRestoreIfPresent({ userDataPath, now: 1 });
  assert.equal(res, false);
  assert.equal(fs.existsSync(txPath), false);
});

test("applyPendingRestoreIfPresent swaps staged assets even if currentAssets already exists (prevents db/assets mismatch)", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  const stagingPath = path.join(userDataPath, "restore-staging-1");
  const currentDb = path.join(userDataPath, "travel-map.sqlite");
  const currentAssets = path.join(userDataPath, "assets");
  const stagedAssets = path.join(stagingPath, "assets");

  await fs.promises.mkdir(path.join(currentAssets, "cities/old"), { recursive: true });
  await fs.promises.writeFile(path.join(currentAssets, "cities/old/a.txt"), "old");
  await fs.promises.writeFile(currentDb, "new-db");

  await fs.promises.mkdir(path.join(stagedAssets, "cities/new"), { recursive: true });
  await fs.promises.writeFile(path.join(stagedAssets, "cities/new/b.txt"), "new");

  await writePending(userDataPath, stagingPath);
  await writeTx(userDataPath, {
    version: 1,
    now: 1,
    stagingPath,
    phase: "db_swapped",
    paths: { currentDb, currentAssets, dbBak: `${currentDb}.bak-1`, assetsBak: path.join(userDataPath, "assets.bak-1") },
  });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 2 });
  assert.equal(applied, true);
  assert.equal(fs.existsSync(path.join(currentAssets, "cities/new/b.txt")), true);
  assert.equal(fs.existsSync(path.join(currentAssets, "cities/old/a.txt")), false);
});

test("applyPendingRestoreIfPresent rejects tx paths outside userData and does not touch external files", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const outsideDir = path.join(tmp, "outside");
  await fs.promises.mkdir(outsideDir, { recursive: true });
  const outsideFile = path.join(outsideDir, "outside.sqlite");
  await fs.promises.writeFile(outsideFile, "DO-NOT-TOUCH", "utf8");

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  await fs.promises.mkdir(path.join(stagingPath, "assets"), { recursive: true });
  await fs.promises.writeFile(path.join(stagingPath, "travel-map.sqlite"), "new-db", "utf8");

  await writeJson(path.join(userDataPath, "restore-pending.json"), { stagingPath });
  await writeJson(path.join(userDataPath, "restore-transaction.json"), {
    version: 1,
    now: 1,
    stagingPath,
    phase: "db_swapped",
    paths: {
      currentDb: outsideFile,
      currentAssets: path.join(tmp, "outside-assets"),
      dbBak: path.join(tmp, "outside-bak"),
      assetsBak: path.join(tmp, "outside-assets-bak"),
    },
  });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 2 });
  assert.equal(applied, false);
  assert.equal(await fs.promises.readFile(outsideFile, "utf8"), "DO-NOT-TOUCH");
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-transaction.json")), false);
});

test("applyPendingRestoreIfPresent clears tx/pending when those files are symlinks", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const outside = path.join(tmp, "outside.txt");
  await fs.promises.writeFile(outside, "DO-NOT-TOUCH", "utf8");

  await fs.promises.symlink(outside, path.join(userDataPath, "restore-transaction.json"));
  await fs.promises.symlink(outside, path.join(userDataPath, "restore-pending.json"));

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 1 });
  assert.equal(applied, false);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-transaction.json")), false);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-pending.json")), false);
  assert.equal(await fs.promises.readFile(outside, "utf8"), "DO-NOT-TOUCH");
});

test("applyPendingRestoreIfPresent preserves staging as .failed when tx paths are invalid", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  await fs.promises.mkdir(path.join(stagingPath, "assets"), { recursive: true });
  await fs.promises.writeFile(path.join(stagingPath, "travel-map.sqlite"), "db", "utf8");

  await writeJson(path.join(userDataPath, "restore-pending.json"), { stagingPath });
  await writeJson(path.join(userDataPath, "restore-transaction.json"), {
    version: 1,
    now: 1,
    stagingPath,
    phase: "db_swapped",
    paths: {
      currentDb: path.join(tmp, "outside.sqlite"),
      currentAssets: path.join(tmp, "outside-assets"),
      dbBak: path.join(tmp, "outside-bak"),
      assetsBak: path.join(tmp, "outside-assets-bak"),
    },
  });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 2 });
  assert.equal(applied, false);
  assert.equal(fs.existsSync(stagingPath), false);
  const names = await fs.promises.readdir(userDataPath);
  assert.equal(names.some((n) => n.startsWith("restore-staging-1.failed")), true);
});

test("applyPendingRestoreIfPresent clears tx when phase is invalid", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-tx-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  await fs.promises.mkdir(path.join(stagingPath, "assets"), { recursive: true });
  await fs.promises.writeFile(path.join(stagingPath, "travel-map.sqlite"), "db", "utf8");

  await writeJson(path.join(userDataPath, "restore-pending.json"), { stagingPath });
  await writeJson(path.join(userDataPath, "restore-transaction.json"), {
    version: 1,
    now: 1,
    stagingPath,
    phase: "unknown",
  });

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 2 });
  assert.equal(applied, false);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-transaction.json")), false);
});
