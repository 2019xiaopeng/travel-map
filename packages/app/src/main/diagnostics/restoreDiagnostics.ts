import fs from "fs";
import os from "os";
import path from "path";

type LogLevel = "info" | "warn" | "error";

type RestoreLogEvent = {
  ts: string;
  level: LogLevel;
  event: string;
  phase?: string;
  error_code?: string;
  message?: string;
  paths?: string[];
  meta?: any;
};

let userDataPath: string | null = null;
let appVersion: string | null = null;
let ring: RestoreLogEvent[] = [];
let ringMax = 200;
let writeChain: Promise<void> = Promise.resolve();

let logMaxBytes = 1024 * 1024;
const logKeepCount = 3;

export function initRestoreDiagnostics(input: { userDataPath: string; appVersion: string }) {
  userDataPath = input.userDataPath;
  appVersion = input.appVersion;
}

export function getRestoreLogRelativePath() {
  return path.join("logs", "restore.log");
}

export function setRestoreLogMaxBytesForTest(v: number) {
  logMaxBytes = v;
}

export async function flushRestoreDiagnosticsForTest() {
  await writeChain;
}

function ensureInitialized() {
  if (!userDataPath) throw new Error("restoreDiagnostics not initialized");
}

function sanitizePath(p: string) {
  ensureInitialized();
  if (!p) return p;
  const base = path.resolve(userDataPath!);
  const abs = path.resolve(p);
  if (abs === base) return ".";
  if (!abs.startsWith(base + path.sep)) return "<outside>";
  const rel = path.relative(base, abs).replace(/\\/g, "/");
  return rel || ".";
}

async function ensureDir(absDir: string) {
  await fs.promises.mkdir(absDir, { recursive: true });
}

async function rotateIfNeeded(absLogPath: string, incomingBytes: number) {
  let size = 0;
  try {
    size = (await fs.promises.stat(absLogPath)).size;
  } catch {}

  if (size + incomingBytes <= logMaxBytes) return;

  for (let i = logKeepCount; i >= 1; i--) {
    const from = `${absLogPath}.${i}`;
    const to = `${absLogPath}.${i + 1}`;
    try {
      if (i === logKeepCount) await fs.promises.rm(from, { force: true });
      else await fs.promises.rename(from, to);
    } catch {}
  }

  try {
    await fs.promises.rename(absLogPath, `${absLogPath}.1`);
  } catch {}
}

async function appendLine(line: string) {
  ensureInitialized();
  const absLogPath = path.join(userDataPath!, getRestoreLogRelativePath());
  await ensureDir(path.dirname(absLogPath));
  await rotateIfNeeded(absLogPath, Buffer.byteLength(line, "utf8"));
  await fs.promises.appendFile(absLogPath, line, "utf8");
}

export function logRestoreEvent(input: {
  level: LogLevel;
  event: string;
  phase?: string;
  error_code?: string;
  message?: string;
  paths?: string[];
  meta?: any;
}) {
  if (!userDataPath) return;
  const e: RestoreLogEvent = {
    ts: new Date().toISOString(),
    level: input.level,
    event: input.event,
    phase: input.phase,
    error_code: input.error_code,
    message: input.message,
    paths: input.paths?.map((p) => sanitizePath(p)),
    meta: input.meta,
  };

  ring = [...ring, e].slice(-ringMax);
  const line = `${JSON.stringify(e)}\n`;
  writeChain = writeChain.then(() => appendLine(line)).catch(() => {});
}

async function writeJsonAtomic(absPath: string, value: any) {
  await ensureDir(path.dirname(absPath));
  const tmp = `${absPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await fs.promises.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.promises.rename(tmp, absPath);
}

async function readJsonIfExists(absPath: string) {
  try {
    return JSON.parse(await fs.promises.readFile(absPath, "utf8"));
  } catch {
    return null;
  }
}

export async function exportRestoreDiagnostic(input: { reason: string }) {
  if (!userDataPath) return { ok: false as const, error: "not_initialized" as const };
  const now = Date.now();
  const relativePath = path.join("diagnostics", `restore-diagnostic-${now}.json`).replace(/\\/g, "/");
  const abs = path.join(userDataPath, relativePath);

  const pendingPath = path.join(userDataPath, "restore-pending.json");
  const txPath = path.join(userDataPath, "restore-transaction.json");
  const pending = await readJsonIfExists(pendingPath);
  const tx = await readJsonIfExists(txPath);

  const pendingStaging = pending?.stagingPath ? sanitizePath(String(pending.stagingPath)) : null;
  const txStaging = tx?.stagingPath ? sanitizePath(String(tx.stagingPath)) : null;

  const payload = {
    generated_at: new Date(now).toISOString(),
    reason: input.reason,
    versions: {
      app_version: appVersion,
      node: process.versions.node,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      platform: process.platform,
      arch: process.arch,
      os_release: os.release(),
    },
    restore_state: {
      has_pending: fs.existsSync(pendingPath),
      has_transaction: fs.existsSync(txPath),
      pending: pending ? { stagingPath: pendingStaging } : null,
      transaction: tx ? { version: tx.version, phase: tx.phase, stagingPath: txStaging } : null,
    },
    recent_events: ring.slice(-ringMax),
  };

  try {
    await writeJsonAtomic(abs, payload);
    return { ok: true as const, relativePath };
  } catch {
    return { ok: false as const, error: "write_failed" as const };
  }
}

