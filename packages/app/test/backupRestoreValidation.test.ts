import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import yazl from "yazl";

import { stageRestoreFromZip } from "../src/main/backupRestore.ts";

async function createZip(zipPath: string, entries: Array<{ name: string; content: Buffer }>) {
  await fs.promises.mkdir(path.dirname(zipPath), { recursive: true });
  const zip = new yazl.ZipFile();
  for (const e of entries) zip.addBuffer(e.content, e.name);
  const out = fs.createWriteStream(zipPath);
  await new Promise<void>((resolve, reject) => {
    out.on("close", () => resolve());
    out.on("error", reject);
    zip.outputStream.pipe(out);
    zip.end();
  });
}

test("stageRestoreFromZip fails when db.sqlite missing and does not write pending", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const zipPath = path.join(tmp, "backup.zip");
  await createZip(zipPath, [
    { name: "manifest.json", content: Buffer.from(`{\"exported_at\":1,\"app_version\":\"0\",\"db_sha256\":\"x\",\"assets\":[],\"warnings\":[]}`) },
    { name: "assets/cities/1/a.txt", content: Buffer.from("a") },
  ]);

  await assert.rejects(
    () => stageRestoreFromZip({ zipPath, userDataPath, now: 1 }),
    /db\.sqlite is required/i,
  );

  assert.equal(fs.existsSync(path.join(userDataPath, "restore-pending.json")), false);
});
