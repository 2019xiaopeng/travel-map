import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { resolveDiagnosticsRevealAbsolutePath } from "../src/main/diagnostics/diagnosticsPaths.ts";

test("resolveDiagnosticsRevealAbsolutePath accepts diagnostics relative path", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-diag-paths-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(path.join(userDataPath, "diagnostics"), { recursive: true });

  const r = await resolveDiagnosticsRevealAbsolutePath({ userDataPath, relativePath: "diagnostics/a.json" });
  assert.equal(r.ok, true);
  assert.equal(r.abs, path.resolve(path.join(userDataPath, "diagnostics/a.json")));
});

test("resolveDiagnosticsRevealAbsolutePath rejects absolute and traversal paths", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-diag-paths-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const r1 = await resolveDiagnosticsRevealAbsolutePath({ userDataPath, relativePath: "/etc/passwd" });
  assert.equal(r1.ok, false);

  const r2 = await resolveDiagnosticsRevealAbsolutePath({ userDataPath, relativePath: "../x" });
  assert.equal(r2.ok, false);
});

test("resolveDiagnosticsRevealAbsolutePath rejects when diagnostics dir is a symlink", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-diag-paths-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const outside = path.join(tmp, "outside-diag");
  await fs.promises.mkdir(outside, { recursive: true });
  await fs.promises.symlink(outside, path.join(userDataPath, "diagnostics"));

  const r = await resolveDiagnosticsRevealAbsolutePath({ userDataPath, relativePath: "diagnostics/a.json" });
  assert.equal(r.ok, false);
});

