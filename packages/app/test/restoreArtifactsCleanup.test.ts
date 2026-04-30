import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { cleanupRestoreArtifacts } from "../src/main/backupRestore.ts";

test("cleanupRestoreArtifacts keeps only latest failed dirs", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const now = Date.now();
  const mk = async (name: string, ageMs: number) => {
    const p = path.join(userDataPath, name);
    await fs.promises.mkdir(p, { recursive: true });
    const t = new Date(now - ageMs);
    await fs.promises.utimes(p, t, t);
  };
  await mk("restore-staging-1.failed", 10 * 24 * 3600_000);
  await mk("restore-staging-2.failed", 9 * 24 * 3600_000);
  await mk("restore-staging-3.failed", 8 * 24 * 3600_000);
  await mk("restore-staging-4.failed", 7 * 24 * 3600_000);

  await cleanupRestoreArtifacts({ userDataPath, now });

  const names = new Set(await fs.promises.readdir(userDataPath));
  assert.equal(names.has("restore-staging-4.failed"), true);
  assert.equal(names.has("restore-staging-3.failed"), true);
  assert.equal(names.has("restore-staging-2.failed"), true);
  assert.equal(names.has("restore-staging-1.failed"), false);
});

