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

test("stageRestoreFromZip returns manifest warnings when present", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const zipPath = path.join(tmp, "backup.zip");
  await createZip(zipPath, [
    {
      name: "manifest.json",
      content: Buffer.from(
        JSON.stringify({
          exported_at: 1,
          app_version: "0",
          db_sha256: "",
          assets: [],
          warnings: [{ type: "missing_file", message: "assets/x" }],
        }),
      ),
    },
    { name: "db.sqlite", content: Buffer.from("db") },
    { name: "assets/cities/1/a.txt", content: Buffer.from("a") },
  ]);

  const res: any = await stageRestoreFromZip({ zipPath, userDataPath, now: 1 });
  assert.equal(res.ok, true);
  assert.equal(Array.isArray(res.warnings), true);
  assert.equal(res.warnings.length, 1);
  assert.equal(res.warnings[0].type, "missing_file");
});
