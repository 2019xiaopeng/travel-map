import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import yazl from "yazl";

import { applyPendingRestoreIfPresent, stageRestoreFromZip } from "../src/main/backupRestore.ts";

async function createZip(zipPath: string, entries: Array<{ name: string; content: Buffer }>) {
  await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });
  const zip = new yazl.ZipFile();
  for (const e of entries) zip.addBuffer(e.content, e.name);
  const out = fs.createWriteStream(zipPath);
  await new Promise<void>((resolve, reject) => {
    out.on("close", () => resolve());
    out.on("error", reject);
    zip.outputStream.on("error", reject);
    zip.outputStream.pipe(out);
    zip.end();
  });
}

test("applyPendingRestoreIfPresent clears pending when stagingPath outside userData", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-hardening-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(path.join(userDataPath, "assets"), { recursive: true });
  await fs.promises.writeFile(path.join(userDataPath, "travel-map.sqlite"), "old-db");

  const badStagingPath = path.join(tmp, "not-userdata-staging");
  await fs.promises.mkdir(path.join(badStagingPath, "assets"), { recursive: true });
  await fs.promises.writeFile(path.join(badStagingPath, "travel-map.sqlite"), "new-db");

  const pendingPath = path.join(userDataPath, "restore-pending.json");
  await fs.promises.writeFile(pendingPath, JSON.stringify({ stagingPath: badStagingPath }, null, 2), "utf8");

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 1 });
  assert.equal(applied, false);
  assert.equal(fs.existsSync(pendingPath), false);
  assert.equal(await fs.promises.readFile(path.join(userDataPath, "travel-map.sqlite"), "utf8"), "old-db");
});

test("applyPendingRestoreIfPresent clears pending when staging missing required files", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-hardening-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(path.join(userDataPath, "assets"), { recursive: true });
  await fs.promises.writeFile(path.join(userDataPath, "travel-map.sqlite"), "old-db");

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  await fs.promises.mkdir(stagingPath, { recursive: true });

  const pendingPath = path.join(userDataPath, "restore-pending.json");
  await fs.promises.writeFile(pendingPath, JSON.stringify({ stagingPath }, null, 2), "utf8");

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now: 1 });
  assert.equal(applied, false);
  assert.equal(fs.existsSync(pendingPath), false);
});

test("stageRestoreFromZip rejects when manifest.json exists but is invalid JSON", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-hardening-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const zipPath = path.join(tmp, "backup.zip");
  await createZip(zipPath, [
    { name: "manifest.json", content: Buffer.from("{") },
    { name: "db.sqlite", content: Buffer.from("db") },
  ]);

  await assert.rejects(() => stageRestoreFromZip({ zipPath, userDataPath, now: 1 }), /invalid manifest\.json/i);
  assert.equal(fs.existsSync(path.join(userDataPath, "restore-pending.json")), false);
});

test("stageRestoreFromZip rejects zip with too many relevant entries", { timeout: 20000 }, async () => {
  const prev = process.env.TRAVEL_MAP_MAX_RELEVANT_ZIP_ENTRIES;
  process.env.TRAVEL_MAP_MAX_RELEVANT_ZIP_ENTRIES = "3";
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-hardening-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const zipPath = path.join(tmp, "backup.zip");
  const entries: Array<{ name: string; content: Buffer }> = [
    { name: "manifest.json", content: Buffer.from(`{\"exported_at\":1,\"app_version\":\"0\",\"db_sha256\":\"\",\"assets\":[],\"warnings\":[]}`) },
    { name: "db.sqlite", content: Buffer.from("db") },
  ];
  entries.push({ name: "assets/x/1.txt", content: Buffer.from("a") });
  entries.push({ name: "assets/x/2.txt", content: Buffer.from("a") });
  await createZip(zipPath, entries);
  try {
    await assert.rejects(() => stageRestoreFromZip({ zipPath, userDataPath, now: 1 }), /too many entries/i);
    assert.equal(fs.existsSync(path.join(userDataPath, "restore-pending.json")), false);
  } finally {
    if (prev === undefined) delete process.env.TRAVEL_MAP_MAX_RELEVANT_ZIP_ENTRIES;
    else process.env.TRAVEL_MAP_MAX_RELEVANT_ZIP_ENTRIES = prev;
  }
});
