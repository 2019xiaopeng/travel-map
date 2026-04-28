import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { createBackupZip } from "../src/main/backupZip.ts";

test("createBackupZip returns warnings so IPC can surface them", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-backup-"));
  const userDataPath = path.join(tmp, "userData");
  const assetsRoot = path.join(userDataPath, "assets");
  await fs.promises.mkdir(path.join(assetsRoot, "cities/1"), { recursive: true });
  await fs.promises.writeFile(path.join(assetsRoot, "cities/1/a.txt"), "abc");

  const dbPath = path.join(tmp, "travel-map.sqlite");
  await fs.promises.writeFile(dbPath, "db");

  const zipPath = path.join(tmp, "backup.zip");
  const res: any = await createBackupZip({
    zipPath,
    userDataPath,
    dbSnapshotPath: dbPath,
    appVersion: "0.0.0",
    exportedAt: 1,
    assets: [{ asset_id: "a1", sha256: "wrong", local_path: "assets/cities/1/a.txt", size: 999, remote_url: null }],
  });

  assert.equal(Array.isArray(res.warnings), true);
  assert.equal(res.warnings.length, 1);
  assert.equal(res.warnings[0].type, "metadata_mismatch");
});

