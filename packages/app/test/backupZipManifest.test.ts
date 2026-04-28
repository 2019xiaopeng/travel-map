import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import yauzl from "yauzl";

import { createBackupZip } from "../src/main/backupZip.ts";

function readZipEntry(zipPath: string, entryName: string) {
  return new Promise<Buffer>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err);
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        if (entry.fileName !== entryName) {
          zipfile.readEntry();
          return;
        }
        zipfile.openReadStream(entry, (err2, rs) => {
          if (err2 || !rs) return reject(err2);
          const chunks: Buffer[] = [];
          rs.on("data", (c) => chunks.push(c));
          rs.on("end", () => resolve(Buffer.concat(chunks)));
          rs.on("error", reject);
        });
      });
      zipfile.on("error", reject);
    });
  });
}

test("createBackupZip writes manifest assets sha256/size matching exported files", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-backup-"));
  const userDataPath = path.join(tmp, "userData");
  const assetsRoot = path.join(userDataPath, "assets");
  await fs.promises.mkdir(path.join(assetsRoot, "cities/1"), { recursive: true });
  const assetAbs = path.join(assetsRoot, "cities/1/a.txt");
  await fs.promises.writeFile(assetAbs, "abc");

  const dbPath = path.join(tmp, "travel-map.sqlite");
  await fs.promises.writeFile(dbPath, "db");

  const zipPath = path.join(tmp, "backup.zip");
  await createBackupZip({
    zipPath,
    userDataPath,
    dbSnapshotPath: dbPath,
    appVersion: "0.0.0",
    exportedAt: 1,
    assets: [{ asset_id: "a1", sha256: "wrong", local_path: "assets/cities/1/a.txt", size: 999, remote_url: null }],
  });

  const manifestBuf = await readZipEntry(zipPath, "manifest.json");
  const manifest = JSON.parse(manifestBuf.toString("utf8"));
  const expectedSha = crypto.createHash("sha256").update(Buffer.from("abc")).digest("hex");
  assert.equal(manifest.assets[0].sha256, expectedSha);
  assert.equal(manifest.assets[0].size, 3);
  assert.equal(Array.isArray(manifest.warnings), true);
  assert.equal(manifest.warnings.length, 1);
});

