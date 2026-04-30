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

test("cleanupRestoreArtifacts deletes old db bak beyond topK and TTL", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const now = Date.now();
  const mkFile = async (name: string, ageDays: number) => {
    const p = path.join(userDataPath, name);
    await fs.promises.writeFile(p, "x", "utf8");
    const t = new Date(now - ageDays * 24 * 3600_000);
    await fs.promises.utimes(p, t, t);
  };

  for (let i = 1; i <= 7; i++) {
    await mkFile(`travel-map.sqlite.bak-${i}`, 40 + (7 - i));
  }

  await cleanupRestoreArtifacts({ userDataPath, now });

  const names = new Set(await fs.promises.readdir(userDataPath));
  assert.equal(names.has("travel-map.sqlite.bak-7"), true);
  assert.equal(names.has("travel-map.sqlite.bak-6"), true);
  assert.equal(names.has("travel-map.sqlite.bak-5"), true);
  assert.equal(names.has("travel-map.sqlite.bak-4"), true);
  assert.equal(names.has("travel-map.sqlite.bak-3"), true);
  assert.equal(names.has("travel-map.sqlite.bak-2"), false);
  assert.equal(names.has("travel-map.sqlite.bak-1"), false);
});

test("cleanupRestoreArtifacts deletes old assets bak beyond topK and TTL", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const now = Date.now();
  const mkDir = async (name: string, ageDays: number) => {
    const p = path.join(userDataPath, name);
    await fs.promises.mkdir(p, { recursive: true });
    await fs.promises.writeFile(path.join(p, "x.txt"), "x", "utf8");
    const t = new Date(now - ageDays * 24 * 3600_000);
    await fs.promises.utimes(p, t, t);
  };

  for (let i = 1; i <= 5; i++) {
    await mkDir(`assets.bak-${i}`, 40 + (5 - i));
  }

  await cleanupRestoreArtifacts({ userDataPath, now });

  const names = new Set(await fs.promises.readdir(userDataPath));
  assert.equal(names.has("assets.bak-5"), true);
  assert.equal(names.has("assets.bak-4"), true);
  assert.equal(names.has("assets.bak-3"), true);
  assert.equal(names.has("assets.bak-2"), false);
  assert.equal(names.has("assets.bak-1"), false);
});

test("cleanupRestoreArtifacts does not delete bak when within TTL even if beyond topK", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const now = Date.now();
  for (let i = 1; i <= 8; i++) {
    const p = path.join(userDataPath, `travel-map.sqlite.bak-${i}`);
    await fs.promises.writeFile(p, "x", "utf8");
    const t = new Date(now - 10 * 24 * 3600_000);
    await fs.promises.utimes(p, t, t);
  }

  await cleanupRestoreArtifacts({ userDataPath, now });

  const names = new Set(await fs.promises.readdir(userDataPath));
  assert.equal(names.size, 8);
});

test("cleanupRestoreArtifacts skips symlink and does not delete external target", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-cleanup-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const outside = path.join(tmp, "outside.txt");
  await fs.promises.writeFile(outside, "DO-NOT-TOUCH", "utf8");

  const link = path.join(userDataPath, "travel-map.sqlite.bak-999");
  await fs.promises.symlink(outside, link);

  await cleanupRestoreArtifacts({ userDataPath, now: Date.now() });

  assert.equal(await fs.promises.readFile(outside, "utf8"), "DO-NOT-TOUCH");
  const st = await fs.promises.lstat(link);
  assert.equal(st.isSymbolicLink(), true);
});
