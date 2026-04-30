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

const DEFAULT_RETENTION = {
  failed: { ttlMs: 7 * 24 * 3600_000, topK: 3, envTtl: "TRAVEL_MAP_RETENTION_FAILED_TTL_MS", envTopK: "TRAVEL_MAP_RETENTION_FAILED_TOPK" },
  dbBak: { ttlMs: 30 * 24 * 3600_000, topK: 5, envTtl: "TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS", envTopK: "TRAVEL_MAP_RETENTION_DB_BAK_TOPK" },
  assetsBak: { ttlMs: 30 * 24 * 3600_000, topK: 3, envTtl: "TRAVEL_MAP_RETENTION_ASSETS_BAK_TTL_MS", envTopK: "TRAVEL_MAP_RETENTION_ASSETS_BAK_TOPK" },
} as const;

export function initRestoreDiagnostics(input: { userDataPath: string; appVersion: string }) {
  userDataPath = input.userDataPath;
  appVersion = input.appVersion;
  ring = [];
  writeChain = Promise.resolve();
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

async function isSymlink(absPath: string) {
  try {
    return (await fs.promises.lstat(absPath)).isSymbolicLink();
  } catch {
    return false;
  }
}

async function ensureSafeDir(absDir: string) {
  try {
    const st = await fs.promises.lstat(absDir);
    if (st.isSymbolicLink()) throw new Error("unsafe_dir");
    if (!st.isDirectory()) throw new Error("unsafe_dir");
    return;
  } catch (e: any) {
    if (e?.code !== "ENOENT") throw e;
  }
  await fs.promises.mkdir(absDir, { recursive: true });
  const st = await fs.promises.lstat(absDir);
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error("unsafe_dir");
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
  const absLogsDir = path.dirname(absLogPath);
  if (await isSymlink(absLogsDir)) throw new Error("unsafe_logs_dir");
  await ensureSafeDir(absLogsDir);
  if (await isSymlink(absLogPath)) throw new Error("unsafe_log_path");
  await rotateIfNeeded(absLogPath, Buffer.byteLength(line, "utf8"));
  await fs.promises.appendFile(absLogPath, line, "utf8");
}

function sanitizeMessage(message: string | undefined) {
  if (!message) return message;
  if (/[\\/]/.test(message)) return "<redacted>";
  return message;
}

function sanitizeMeta(value: any, depth = 0): any {
  if (value == null) return value;
  if (depth > 4) return "<redacted>";
  if (typeof value === "string") return /[\\/]/.test(value) ? "<redacted>" : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitizeMeta(v, depth + 1));
  if (typeof value === "object") {
    const out: any = {};
    const keys = Object.keys(value).slice(0, 50);
    for (const k of keys) out[k] = sanitizeMeta((value as any)[k], depth + 1);
    return out;
  }
  return "<redacted>";
}

function envMs(name: string, fallback: number) {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const v = Number(raw);
  return Number.isFinite(v) && Number.isInteger(v) && v >= 0 ? v : fallback;
}

function getRetentionSnapshot() {
  return {
    failed: { ttlMs: envMs(DEFAULT_RETENTION.failed.envTtl, DEFAULT_RETENTION.failed.ttlMs), topK: envInt(DEFAULT_RETENTION.failed.envTopK, DEFAULT_RETENTION.failed.topK) },
    dbBak: { ttlMs: envMs(DEFAULT_RETENTION.dbBak.envTtl, DEFAULT_RETENTION.dbBak.ttlMs), topK: envInt(DEFAULT_RETENTION.dbBak.envTopK, DEFAULT_RETENTION.dbBak.topK) },
    assetsBak: { ttlMs: envMs(DEFAULT_RETENTION.assetsBak.envTtl, DEFAULT_RETENTION.assetsBak.ttlMs), topK: envInt(DEFAULT_RETENTION.assetsBak.envTopK, DEFAULT_RETENTION.assetsBak.topK) },
  };
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
    message: sanitizeMessage(input.message),
    paths: input.paths?.map((p) => sanitizePath(p)),
    meta: sanitizeMeta(input.meta),
  };

  ring = [...ring, e].slice(-ringMax);
  const line = `${JSON.stringify(e)}\n`;
  writeChain = writeChain.then(() => appendLine(line)).catch(() => {});
}

async function writeJsonAtomic(absPath: string, value: any) {
  await ensureSafeDir(path.dirname(absPath));
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
  if (await isSymlink(path.dirname(abs))) return { ok: false as const, error: "unsafe_path" as const };

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
    retention: getRetentionSnapshot(),
    recent_events: ring.slice(-ringMax),
  };

  try {
    await writeJsonAtomic(abs, payload);
    return { ok: true as const, relativePath };
  } catch {
    return { ok: false as const, error: "write_failed" as const };
  }
}
