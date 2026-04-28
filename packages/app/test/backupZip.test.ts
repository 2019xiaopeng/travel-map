import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import yauzl from "yauzl";

import { createBackupZip } from "../src/main/backupZip.ts";

function openZipEntries(zipPath: string) {
  return new Promise<string[]>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err);
      const names: string[] = [];
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        names.push(entry.fileName);
        zipfile.readEntry();
      });
      zipfile.on("end", () => resolve(names.sort()));
      zipfile.on("error", reject);
    });
  });
}

test("createBackupZip writes manifest, db, and assets into zip", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-backup-"));
  const userDataPath = path.join(tmp, "userData");
  const assetsRoot = path.join(userDataPath, "assets");
  await fs.promises.mkdir(path.join(assetsRoot, "cities/1"), { recursive: true });
  await fs.promises.writeFile(path.join(assetsRoot, "cities/1/a.txt"), "a");

  const dbPath = path.join(tmp, "travel-map.sqlite");
  await fs.promises.writeFile(dbPath, "db");

  const zipPath = path.join(tmp, "backup.zip");
  await createBackupZip({
    zipPath,
    userDataPath,
    dbSnapshotPath: dbPath,
    appVersion: "0.0.0",
    exportedAt: 1,
    assets: [{ asset_id: "a1", sha256: "s", local_path: "assets/cities/1/a.txt", size: 1, remote_url: null }],
  });

  const entries = await openZipEntries(zipPath);
  assert.equal(entries.includes("manifest.json"), true);
  assert.equal(entries.includes("db.sqlite"), true);
  assert.equal(entries.includes("assets/cities/1/a.txt"), true);
});

