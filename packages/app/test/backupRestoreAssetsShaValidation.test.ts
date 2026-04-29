import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
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

test("stageRestoreFromZip warns when asset sha256 mismatches manifest", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const assetBytes = Buffer.from("abc");
  const goodSha = crypto.createHash("sha256").update(assetBytes).digest("hex");

  const zipPath = path.join(tmp, "backup.zip");
  await createZip(zipPath, [
    {
      name: "manifest.json",
      content: Buffer.from(
        JSON.stringify({
          exported_at: 1,
          app_version: "0",
          db_sha256: "",
          assets: [
            {
              asset_id: "a1",
              sha256: goodSha.replace(/^./, "0"),
              relative_path: "assets/cities/1/a.txt",
              size: 3,
              remote_url: null,
            },
          ],
          warnings: [],
        }),
      ),
    },
    { name: "db.sqlite", content: Buffer.from("db") },
    { name: "assets/cities/1/a.txt", content: assetBytes },
  ]);

  const res: any = await stageRestoreFromZip({ zipPath, userDataPath, now: 1 });
  const mismatch = (res.warnings ?? []).find((w: any) => w.type === "import_asset_sha256_mismatch");
  assert.equal(Boolean(mismatch), true);
  assert.equal(mismatch.asset_id, "a1");
  assert.equal(mismatch.message, "assets/cities/1/a.txt");
});

