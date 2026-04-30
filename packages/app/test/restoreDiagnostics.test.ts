import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import {
  exportRestoreDiagnostic,
  flushRestoreDiagnosticsForTest,
  getRestoreLogRelativePath,
  initRestoreDiagnostics,
  logRestoreEvent,
  setRestoreLogMaxBytesForTest,
} from "../src/main/diagnostics/restoreDiagnostics.ts";

test("restoreDiagnostics writes JSONL and never writes absolute paths", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-diag-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  initRestoreDiagnostics({ userDataPath, appVersion: "0-test" });

  const abs = path.join(userDataPath, "restore-staging-1.failed");
  logRestoreEvent({ level: "info", event: "test", paths: [abs] });
  await flushRestoreDiagnosticsForTest();

  const logPath = path.join(userDataPath, getRestoreLogRelativePath());
  const content = await fs.promises.readFile(logPath, "utf8");
  assert.equal(content.includes(userDataPath), false);
  const line = content.trim().split("\n").slice(-1)[0];
  const parsed = JSON.parse(line);
  assert.deepEqual(parsed.paths, ["restore-staging-1.failed"]);
});

test("restoreDiagnostics rotates restore.log when exceeding size limit", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-diag-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  initRestoreDiagnostics({ userDataPath, appVersion: "0-test" });
  setRestoreLogMaxBytesForTest(200);

  for (let i = 0; i < 50; i++) logRestoreEvent({ level: "info", event: "spam", meta: { i } });
  await flushRestoreDiagnosticsForTest();

  const rotated = path.join(userDataPath, "logs/restore.log.1");
  assert.equal(fs.existsSync(rotated), true);
});

test("exportRestoreDiagnostic writes json with recent_events", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-diag-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  initRestoreDiagnostics({ userDataPath, appVersion: "0-test" });
  logRestoreEvent({ level: "info", event: "e1" });
  await flushRestoreDiagnosticsForTest();

  const r = await exportRestoreDiagnostic({ reason: "test" });
  assert.equal(r.ok, true);
  assert.equal(Boolean(r.relativePath), true);

  const abs = path.join(userDataPath, r.relativePath!);
  const json = JSON.parse(await fs.promises.readFile(abs, "utf8"));
  assert.equal(Array.isArray(json.recent_events), true);
  assert.equal(json.recent_events.some((x: any) => x.event === "e1"), true);
});

test("restoreDiagnostics redacts messages that may contain paths", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-diag-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  initRestoreDiagnostics({ userDataPath, appVersion: "0-test" });
  logRestoreEvent({ level: "error", event: "test", message: `ENOENT: no such file or directory, open '${path.join(userDataPath, "a.txt")}'` });
  await flushRestoreDiagnosticsForTest();

  const logPath = path.join(userDataPath, getRestoreLogRelativePath());
  const content = await fs.promises.readFile(logPath, "utf8");
  const line = content.trim().split("\n").slice(-1)[0];
  const parsed = JSON.parse(line);
  assert.equal(parsed.message, "<redacted>");
});

test("restoreDiagnostics refuses to write when logs directory is a symlink", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-diag-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const outsideLogs = path.join(tmp, "outside-logs");
  await fs.promises.mkdir(outsideLogs, { recursive: true });
  await fs.promises.symlink(outsideLogs, path.join(userDataPath, "logs"));

  initRestoreDiagnostics({ userDataPath, appVersion: "0-test" });
  logRestoreEvent({ level: "info", event: "test" });
  await flushRestoreDiagnosticsForTest();

  assert.equal(fs.existsSync(path.join(outsideLogs, "restore.log")), false);
});

test("exportRestoreDiagnostic fails when diagnostics directory is a symlink", async () => {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "travel-map-restore-diag-"));
  const userDataPath = path.join(tmp, "userData");
  await fs.promises.mkdir(userDataPath, { recursive: true });

  const outside = path.join(tmp, "outside-diag");
  await fs.promises.mkdir(outside, { recursive: true });
  await fs.promises.symlink(outside, path.join(userDataPath, "diagnostics"));

  initRestoreDiagnostics({ userDataPath, appVersion: "0-test" });
  const r = await exportRestoreDiagnostic({ reason: "test" });
  assert.equal(r.ok, false);
});
