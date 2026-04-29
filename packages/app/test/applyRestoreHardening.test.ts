import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { applyPendingRestoreIfPresent } from "../src/main/backupRestore.ts";

test("applyPendingRestoreIfPresent avoids bak name collision", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-apply-hardening-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(path.join(userDataPath, "assets/cities/old"), { recursive: true });
  await fs.promises.writeFile(path.join(userDataPath, "travel-map.sqlite"), "old-db");
  await fs.promises.writeFile(path.join(userDataPath, "assets/cities/old/a.txt"), "old");

  const now = 2;
  await fs.promises.mkdir(`${path.join(userDataPath, "travel-map.sqlite")}.bak-${now}`, { recursive: true });

  const stagingPath = path.join(userDataPath, "restore-staging-1");
  await fs.promises.mkdir(path.join(stagingPath, "assets/cities/new"), { recursive: true });
  await fs.promises.writeFile(path.join(stagingPath, "travel-map.sqlite"), "new-db");
  await fs.promises.writeFile(path.join(stagingPath, "assets/cities/new/b.txt"), "new");

  await fs.promises.writeFile(path.join(userDataPath, "restore-pending.json"), JSON.stringify({ stagingPath }, null, 2), "utf8");

  const applied = await applyPendingRestoreIfPresent({ userDataPath, now });
  assert.equal(applied, true);
  assert.equal(await fs.promises.readFile(path.join(userDataPath, "travel-map.sqlite"), "utf8"), "new-db");

  const files = await fs.promises.readdir(userDataPath);
  const hasBak = files.some((f) => f.startsWith("travel-map.sqlite.bak-2"));
  assert.equal(hasBak, true);
});

