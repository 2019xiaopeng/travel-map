import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { readLocalText } from "../src/main/readLocalText.ts";

test("readLocalText reads markdown inside assets and blocks traversal", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "travel-map-read-local-"));
  const assetsDir = path.join(root, "assets", "notes");
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(assetsDir, "guide.md"), "# Guide\n\nHello", "utf8");

  const ok = await readLocalText({
    userDataPath: root,
    localPath: "assets/notes/guide.md",
    maxBytes: 1024,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.match(ok.text, /Guide/);
  }

  const denied = await readLocalText({
    userDataPath: root,
    localPath: "../secret.txt",
    maxBytes: 1024,
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) {
    assert.match(denied.error, /Access Denied/);
  }
});

test("readLocalText rejects oversized files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "travel-map-read-local-size-"));
  const assetsDir = path.join(root, "assets", "notes");
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(assetsDir, "large.txt"), "1234567890", "utf8");

  const res = await readLocalText({
    userDataPath: root,
    localPath: "assets/notes/large.txt",
    maxBytes: 4,
  });

  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.error, /File too large/);
  }
});
