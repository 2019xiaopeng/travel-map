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

test("stageRestoreFromZip rejects when manifest db_sha256 mismatches db.sqlite", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const dbBytes = Buffer.from("db");
  const goodSha = crypto.createHash("sha256").update(dbBytes).digest("hex");

  const zipPath = path.join(tmp, "backup.zip");
  await createZip(zipPath, [
    {
      name: "manifest.json",
      content: Buffer.from(
        JSON.stringify({
          exported_at: 1,
          app_version: "0",
          db_sha256: goodSha.replace(/^./, "0"),
          assets: [],
          warnings: [],
        }),
      ),
    },
    { name: "db.sqlite", content: dbBytes },
  ]);

  await assert.rejects(
    () => stageRestoreFromZip({ zipPath, userDataPath, now: 1 }),
    /db_sha256 mismatch/i,
  );
});

