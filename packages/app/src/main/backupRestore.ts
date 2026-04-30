import fs from "fs";
import path from "path";
import yauzl from "yauzl";
import crypto from "crypto";
import { exportRestoreDiagnostic, logRestoreEvent } from "./diagnostics/restoreDiagnostics.ts";

const DEFAULT_RETENTION = {
  failed: {
    ttlMs: 7 * 24 * 3600_000,
    topK: 3,
    envTtl: "TRAVEL_MAP_RETENTION_FAILED_TTL_MS",
    envTopK: "TRAVEL_MAP_RETENTION_FAILED_TOPK",
  },
  dbBak: {
    ttlMs: 30 * 24 * 3600_000,
    topK: 5,
    envTtl: "TRAVEL_MAP_RETENTION_DB_BAK_TTL_MS",
    envTopK: "TRAVEL_MAP_RETENTION_DB_BAK_TOPK",
  },
  assetsBak: {
    ttlMs: 30 * 24 * 3600_000,
    topK: 3,
    envTtl: "TRAVEL_MAP_RETENTION_ASSETS_BAK_TTL_MS",
    envTopK: "TRAVEL_MAP_RETENTION_ASSETS_BAK_TOPK",
  },
} as const;

function envNumber(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function envNonEmptyString(name: string) {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed;
}

function envMsWithDefault(name: string, fallback: number) {
  const raw = envNonEmptyString(name);
  if (raw === null) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

function envIntWithDefault(name: string, fallback: number) {
  const raw = envNonEmptyString(name);
  if (raw === null) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) && Number.isInteger(v) && v >= 0 ? v : fallback;
}

function maxRelevantZipEntries() {
  return envNumber("TRAVEL_MAP_MAX_RELEVANT_ZIP_ENTRIES", 20000);
}

function maxRelevantZipTotalUncompressedBytes() {
  return envNumber("TRAVEL_MAP_MAX_RELEVANT_ZIP_TOTAL_UNCOMPRESSED_BYTES", 5 * 1024 * 1024 * 1024);
}

function maxDbSqliteUncompressedBytes() {
  return envNumber("TRAVEL_MAP_MAX_DB_SQLITE_UNCOMPRESSED_BYTES", 1024 * 1024 * 1024);
}

function maxManifestUncompressedBytes() {
  return envNumber("TRAVEL_MAP_MAX_MANIFEST_UNCOMPRESSED_BYTES", 5 * 1024 * 1024);
}

function maxAssetUncompressedBytes() {
  return envNumber("TRAVEL_MAP_MAX_ASSET_UNCOMPRESSED_BYTES", 200 * 1024 * 1024);
}

function ensureDir(absDir: string) {
  return fs.promises.mkdir(absDir, { recursive: true });
}

async function isSymlinkPath(p: string) {
  try {
    return (await fs.promises.lstat(p)).isSymbolicLink();
  } catch {
    return false;
  }
}

function safeJoin(baseDir: string, rel: string) {
  const normalized = rel.replace(/^\/+/, "");
  const abs = path.resolve(path.join(baseDir, normalized));
  const base = path.resolve(baseDir);
  if (!abs.startsWith(base + path.sep) && abs !== base) return null;
  return abs;
}

function isUnder(base: string, p: string) {
  const b = path.resolve(base);
  const r = path.resolve(p);
  return r === b || r.startsWith(b + path.sep);
}

async function isSymlink(p: string) {
  try {
    const stat = await fs.promises.lstat(p);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

async function validateBakPath(kind: "db" | "assets", userDataPath: string, p: string) {
  if (!p) return null;
  if (!isUnder(userDataPath, p)) return null;
  const base = path.basename(p);
  if (kind === "db" && !base.startsWith("travel-map.sqlite.bak-")) return null;
  if (kind === "assets" && !base.startsWith("assets.bak-")) return null;
  if (await isSymlink(p)) return null;
  return p;
}

async function writeJsonAtomic(filePath: string, value: any) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await fs.promises.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.promises.rename(tmp, filePath);
}

async function readJson(filePath: string) {
  return JSON.parse(await fs.promises.readFile(filePath, "utf8"));
}

function uniquePath(p: string) {
  if (!fs.existsSync(p)) return p;
  for (let i = 1; i < 1000; i++) {
    const next = `${p}-${i}`;
    if (!fs.existsSync(next)) return next;
  }
  return `${p}-${Date.now()}`;
}

async function writeZipEntry(zipfile: yauzl.ZipFile, entry: yauzl.Entry, absDest: string) {
  await ensureDir(path.dirname(absDest));
  await new Promise<void>((resolve, reject) => {
    zipfile.openReadStream(entry, (err, rs) => {
      if (err || !rs) return reject(err);
      const ws = fs.createWriteStream(absDest);
      rs.on("error", reject);
      ws.on("error", reject);
      ws.on("close", () => resolve());
      rs.pipe(ws);
    });
  });
}

async function sha256File(filePath: string) {
  const hash = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
}

export async function stageRestoreFromZip(input: { zipPath: string; userDataPath: string; now: number }) {
  const stagingPath = path.join(input.userDataPath, `restore-staging-${input.now}`);
  await ensureDir(stagingPath);

  const pendingPath = path.join(input.userDataPath, "restore-pending.json");
  const warnings: Array<{ type: string; asset_id?: string; message: string }> = [];

  try {
    await new Promise<void>((resolve, reject) => {
      yauzl.open(input.zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err);
        let relevantEntryCount = 0;
        let relevantTotalUncompressed = 0;
        let done = false;

        const finishOk = () => {
          if (done) return;
          done = true;
          try {
            zipfile.close();
          } catch {}
          resolve();
        };

        const finishErr = (e: any) => {
          if (done) return;
          done = true;
          try {
            zipfile.close();
          } catch {}
          reject(e);
        };

        zipfile.readEntry();
        zipfile.on("entry", (entry: yauzl.Entry) => {
          const name = entry.fileName.replace(/\\/g, "/");
          if (/\/$/.test(name)) {
            zipfile.readEntry();
            return;
          }

          let relDest: string | null = null;
          if (name === "db.sqlite") relDest = "travel-map.sqlite";
          else if (name === "manifest.json") relDest = "manifest.json";
          else if (name.startsWith("assets/")) relDest = name;

          if (!relDest) {
            zipfile.readEntry();
            return;
          }

          const uncompressed = Number(entry.uncompressedSize ?? 0);
          if (name === "db.sqlite" && uncompressed > maxDbSqliteUncompressedBytes()) {
            finishErr(new Error("db.sqlite too large"));
            return;
          }
          if (name === "manifest.json" && uncompressed > maxManifestUncompressedBytes()) {
            finishErr(new Error("manifest.json too large"));
            return;
          }
          if (name.startsWith("assets/") && uncompressed > maxAssetUncompressedBytes()) {
            finishErr(new Error("asset too large"));
            return;
          }

          const absDest = safeJoin(stagingPath, relDest);
          if (!absDest) {
            if (name.startsWith("assets/")) {
              finishErr(new Error("invalid asset path"));
              return;
            }
            zipfile.readEntry();
            return;
          }

          relevantEntryCount++;
          relevantTotalUncompressed += Number(entry.uncompressedSize ?? 0);
          if (
            relevantEntryCount > maxRelevantZipEntries() ||
            relevantTotalUncompressed > maxRelevantZipTotalUncompressedBytes()
          ) {
            finishErr(new Error("too many entries"));
            return;
          }

          writeZipEntry(zipfile, entry, absDest)
            .then(() => zipfile.readEntry())
            .catch((e) => finishErr(e));
        });
        zipfile.on("end", () => finishOk());
        zipfile.on("error", finishErr);
      });
    });

    const stagedDb = path.join(stagingPath, "travel-map.sqlite");
    if (!fs.existsSync(stagedDb)) {
      throw new Error("db.sqlite is required");
    }

    const stagedAssets = path.join(stagingPath, "assets");
    await ensureDir(stagedAssets);

    const manifestPath = path.join(stagingPath, "manifest.json");
    let manifest: any = null;
    const manifestExists = fs.existsSync(manifestPath);
    if (manifestExists) {
      try {
        manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
      } catch {
        throw new Error("invalid manifest.json");
      }
    }

    const expectedDbSha = typeof manifest?.db_sha256 === "string" ? manifest.db_sha256 : "";
    if (expectedDbSha) {
      const actualDbSha = await sha256File(stagedDb);
      if (actualDbSha !== expectedDbSha) {
        throw new Error("db_sha256 mismatch");
      }
    }

    if (Array.isArray(manifest?.warnings)) {
      for (const w of manifest.warnings) {
        if (w && typeof w.type === "string" && typeof w.message === "string") {
          warnings.push({
            type: w.type,
            asset_id: typeof w.asset_id === "string" ? w.asset_id : undefined,
            message: w.message,
          });
        }
      }
    }

    const assetsList = Array.isArray(manifest?.assets) ? manifest.assets : [];
    const maxValidate = 5000;
    const shaValidateLimit = 200;
    if (assetsList.length > maxValidate) {
      warnings.push({ type: "import_asset_validation_skipped", message: String(assetsList.length) });
    } else {
      if (assetsList.length > shaValidateLimit) {
        warnings.push({ type: "import_asset_sha256_validation_partial", message: `${shaValidateLimit}/${assetsList.length}` });
      }
      for (let i = 0; i < assetsList.length; i++) {
        const a = assetsList[i];
        const rel = typeof a?.relative_path === "string" ? a.relative_path : "";
        const assetId = typeof a?.asset_id === "string" ? a.asset_id : undefined;
        const expectedSize = typeof a?.size === "number" ? a.size : Number(a?.size);
        const expectedSha = typeof a?.sha256 === "string" ? a.sha256 : "";
        if (!rel || !rel.startsWith("assets/")) {
          warnings.push({ type: "import_invalid_asset_path", asset_id: assetId, message: rel || "<empty>" });
          continue;
        }
        const abs = safeJoin(stagingPath, rel);
        if (!abs) {
          warnings.push({ type: "import_invalid_asset_path", asset_id: assetId, message: rel });
          continue;
        }
        if (!fs.existsSync(abs)) {
          warnings.push({ type: "import_missing_asset", asset_id: assetId, message: rel });
          continue;
        }
        try {
          const stat = await fs.promises.stat(abs);
          if (Number.isFinite(expectedSize) && expectedSize >= 0 && stat.size !== expectedSize) {
            warnings.push({
              type: "import_asset_size_mismatch",
              asset_id: assetId,
              message: `${rel} expected=${expectedSize} actual=${stat.size}`,
            });
          }
          if (expectedSha && i < shaValidateLimit) {
            const actualSha = await sha256File(abs);
            if (actualSha !== expectedSha) {
              warnings.push({ type: "import_asset_sha256_mismatch", asset_id: assetId, message: rel });
            }
          }
        } catch {
          warnings.push({ type: "import_missing_asset", asset_id: assetId, message: rel });
        }
      }
    }

    if (await isSymlinkPath(pendingPath)) throw new Error("unsafe pending path");
    await fs.promises.writeFile(pendingPath, JSON.stringify({ stagingPath }, null, 2), "utf8");

    return { ok: true as const, stagingPath, warnings };
  } catch (e) {
    try {
      await fs.promises.rm(stagingPath, { recursive: true, force: true });
    } catch {}
    throw e;
  }
}

export async function applyPendingRestoreIfPresent(input: { userDataPath: string; now: number }) {
  const txPath = path.join(input.userDataPath, "restore-transaction.json");
  const pendingPath = path.join(input.userDataPath, "restore-pending.json");
  logRestoreEvent({
    level: "info",
    event: "restore.apply.check",
    meta: { has_transaction: fs.existsSync(txPath), has_pending: fs.existsSync(pendingPath) },
  });
  const txIsSymlink = await isSymlinkPath(txPath);
  const pendingIsSymlink = await isSymlinkPath(pendingPath);
  if (txIsSymlink || pendingIsSymlink) {
    if (txIsSymlink) {
      try {
        await fs.promises.unlink(txPath);
      } catch {}
    }
    if (pendingIsSymlink) {
      try {
        await fs.promises.unlink(pendingPath);
      } catch {}
    }
    return false;
  }
  if (fs.existsSync(txPath)) {
    return await applyRestoreTransaction({ userDataPath: input.userDataPath, txPath, pendingPath });
  }
  if (!fs.existsSync(pendingPath)) return false;

  let pending: any;
  try {
    pending = await readJson(pendingPath);
  } catch {
    await fs.promises.unlink(pendingPath);
    return false;
  }
  const stagingPath = String(pending?.stagingPath ?? "");
  if (!stagingPath) {
    await fs.promises.unlink(pendingPath);
    return false;
  }

  const resolvedUserData = path.resolve(input.userDataPath);
  const resolvedStaging = path.resolve(stagingPath);
  const stagingBase = path.basename(resolvedStaging);
  const inUserData = resolvedStaging === resolvedUserData || resolvedStaging.startsWith(resolvedUserData + path.sep);
  const isRestoreStaging = stagingBase.startsWith("restore-staging-");
  if (!inUserData || !isRestoreStaging) {
    await fs.promises.unlink(pendingPath);
    return false;
  }

  const stagedDb = path.join(stagingPath, "travel-map.sqlite");
  const stagedAssets = path.join(stagingPath, "assets");
  if (!fs.existsSync(stagedDb) || !fs.existsSync(stagedAssets)) {
    await fs.promises.unlink(pendingPath);
    try {
      await fs.promises.rm(stagingPath, { recursive: true, force: true });
    } catch {}
    return false;
  }

  const currentDb = path.join(input.userDataPath, "travel-map.sqlite");
  const currentAssets = path.join(input.userDataPath, "assets");

  const tx = {
    version: 1,
    now: input.now,
    stagingPath,
    phase: "init",
    paths: {
      currentDb,
      currentAssets,
      dbBak: uniquePath(`${currentDb}.bak-${input.now}`),
      assetsBak: uniquePath(path.join(input.userDataPath, `assets.bak-${input.now}`)),
    },
  };
  await writeJsonAtomic(txPath, tx);
  return await applyRestoreTransaction({ userDataPath: input.userDataPath, txPath, pendingPath });
}

async function applyRestoreTransaction(input: { userDataPath: string; txPath: string; pendingPath: string }) {
  logRestoreEvent({ level: "info", event: "restore.apply.start" });
  let tx: any;
  try {
    tx = await readJson(input.txPath);
  } catch {
    try {
      await fs.promises.unlink(input.txPath);
    } catch {}
    logRestoreEvent({ level: "warn", event: "restore.apply.invalid_tx", error_code: "tx_parse_failed" });
    return false;
  }

  const stagingPath = String(tx?.stagingPath ?? "");
  const phase = String(tx?.phase ?? "init");
  const allowedPhases = new Set(["init", "backed_up", "db_swapped", "assets_swapped", "committed", "cleaned"]);
  if (tx?.version !== 1 || !allowedPhases.has(phase)) {
    try {
      await fs.promises.unlink(input.txPath);
    } catch {}
    logRestoreEvent({ level: "warn", event: "restore.apply.invalid_tx", error_code: "tx_schema_invalid", phase });
    return false;
  }

  const resolvedUserData = path.resolve(input.userDataPath);
  const resolvedStaging = path.resolve(stagingPath);
  const stagingBase = path.basename(resolvedStaging);
  const inUserData = resolvedStaging === resolvedUserData || resolvedStaging.startsWith(resolvedUserData + path.sep);
  const isRestoreStaging = stagingBase.startsWith("restore-staging-");
  if (!stagingPath || !inUserData || !isRestoreStaging) {
    try {
      await fs.promises.unlink(input.txPath);
    } catch {}
    logRestoreEvent({ level: "warn", event: "restore.apply.invalid_tx", error_code: "staging_invalid", paths: [stagingPath] });
    return false;
  }

  const currentDb = path.join(input.userDataPath, "travel-map.sqlite");
  const currentAssets = path.join(input.userDataPath, "assets");
  const txNow = Number(tx?.now ?? Date.now());
  const candidateDbBak = String(tx?.paths?.dbBak ?? uniquePath(`${currentDb}.bak-${txNow}`));
  const candidateAssetsBak = String(tx?.paths?.assetsBak ?? uniquePath(path.join(input.userDataPath, `assets.bak-${txNow}`)));
  const dbBak = await validateBakPath("db", input.userDataPath, candidateDbBak);
  const assetsBak = await validateBakPath("assets", input.userDataPath, candidateAssetsBak);
  if (!dbBak || !assetsBak) {
    try {
      await fs.promises.unlink(input.pendingPath);
    } catch {}
    try {
      const st = await fs.promises.lstat(stagingPath);
      if (!st.isSymbolicLink()) {
        const failed = uniquePath(`${stagingPath}.failed`);
        await fs.promises.rename(stagingPath, failed);
      }
    } catch {}
    try {
      await fs.promises.unlink(input.txPath);
    } catch {}
    logRestoreEvent({ level: "warn", event: "restore.apply.invalid_tx", error_code: "bak_invalid", paths: [stagingPath] });
    return false;
  }


  const stagedDb = path.join(stagingPath, "travel-map.sqlite");
  const stagedAssets = path.join(stagingPath, "assets");

  try {
    if (phase === "init") {
      logRestoreEvent({ level: "info", event: "restore.apply.phase", phase: "init", paths: [stagingPath] });
      if (fs.existsSync(currentDb) && !fs.existsSync(dbBak)) await fs.promises.rename(currentDb, dbBak);
      if (fs.existsSync(currentAssets) && !fs.existsSync(assetsBak)) await fs.promises.rename(currentAssets, assetsBak);
      tx.phase = "backed_up";
      tx.paths = { currentDb, currentAssets, dbBak, assetsBak };
      await writeJsonAtomic(input.txPath, tx);
    }

    if (tx.phase === "backed_up") {
      logRestoreEvent({ level: "info", event: "restore.apply.phase", phase: "backed_up", paths: [stagingPath] });
      if (!fs.existsSync(currentDb) && !fs.existsSync(stagedDb) && fs.existsSync(dbBak)) {
        throw new Error("staged db missing");
      }
      if (fs.existsSync(stagedDb)) {
        if (fs.existsSync(currentDb)) {
          const nextBak = fs.existsSync(dbBak) ? uniquePath(dbBak) : dbBak;
          await fs.promises.rename(currentDb, nextBak);
        }
        await fs.promises.rename(stagedDb, currentDb);
      }
      if (!fs.existsSync(stagedDb) && fs.existsSync(currentDb)) tx.phase = "db_swapped";
      await writeJsonAtomic(input.txPath, tx);
    }

    if (tx.phase === "db_swapped") {
      logRestoreEvent({ level: "info", event: "restore.apply.phase", phase: "db_swapped", paths: [stagingPath] });
      if (!fs.existsSync(currentAssets) && !fs.existsSync(stagedAssets) && fs.existsSync(assetsBak)) {
        throw new Error("staged assets missing");
      }
      if (fs.existsSync(stagedAssets)) {
        if (fs.existsSync(currentAssets)) {
          const nextBak = fs.existsSync(assetsBak) ? uniquePath(assetsBak) : assetsBak;
          await fs.promises.rename(currentAssets, nextBak);
        }
        await fs.promises.rename(stagedAssets, currentAssets);
      }
      if (!fs.existsSync(stagedAssets) && fs.existsSync(currentAssets)) tx.phase = "assets_swapped";
      await writeJsonAtomic(input.txPath, tx);
    }

    if (tx.phase === "assets_swapped") {
      logRestoreEvent({ level: "info", event: "restore.apply.phase", phase: "assets_swapped", paths: [stagingPath] });
      try {
        await fs.promises.unlink(input.pendingPath);
      } catch {}
      tx.phase = "committed";
      await writeJsonAtomic(input.txPath, tx);
    }

    if (tx.phase === "committed") {
      logRestoreEvent({ level: "info", event: "restore.apply.phase", phase: "committed", paths: [stagingPath] });
      try {
        await fs.promises.rm(stagingPath, { recursive: true, force: true });
      } catch {}
      tx.phase = "cleaned";
      await writeJsonAtomic(input.txPath, tx);
    }

    if (tx.phase === "cleaned") {
      try {
        await fs.promises.unlink(input.txPath);
      } catch {}
      logRestoreEvent({ level: "info", event: "restore.apply.success", paths: [stagingPath] });
      return true;
    }

    return false;
  } catch (e) {
    logRestoreEvent({
      level: "error",
      event: "restore.apply.fail",
      error_code: "exception",
      message: String((e as any)?.message ?? "unknown"),
      paths: [stagingPath],
    });
    await exportRestoreDiagnostic({ reason: "restore.apply.fail" });
    try {
      if (fs.existsSync(dbBak) && !fs.existsSync(currentDb)) await fs.promises.rename(dbBak, currentDb);
    } catch {}
    try {
      if (fs.existsSync(assetsBak) && !fs.existsSync(currentAssets)) await fs.promises.rename(assetsBak, currentAssets);
    } catch {}
    try {
      await fs.promises.unlink(input.pendingPath);
    } catch {}
    try {
      const failed = uniquePath(`${stagingPath}.failed`);
      await fs.promises.rename(stagingPath, failed);
    } catch {}
    try {
      await fs.promises.unlink(input.txPath);
    } catch {}
    return false;
  }
}

export async function cleanupRestoreArtifacts(input: { userDataPath: string; now: number }) {
  const pendingPath = path.join(input.userDataPath, "restore-pending.json");
  const txPath = path.join(input.userDataPath, "restore-transaction.json");
  if (fs.existsSync(pendingPath) || fs.existsSync(txPath)) return;

  let entries: string[];
  try {
    entries = await fs.promises.readdir(input.userDataPath);
  } catch {
    return;
  }

  type RetentionGroup = keyof typeof DEFAULT_RETENTION;
  const cfg = {} as Record<RetentionGroup, { ttlMs: number; topK: number }>;
  for (const g of Object.keys(DEFAULT_RETENTION) as Array<RetentionGroup>) {
    const d = DEFAULT_RETENTION[g];
    cfg[g] = {
      ttlMs: envMsWithDefault(d.envTtl, d.ttlMs),
      topK: envIntWithDefault(d.envTopK, d.topK),
    };
  }
  logRestoreEvent({ level: "info", event: "restore.cleanup.start", meta: { cfg } });

  const groups: Record<RetentionGroup, Array<{ abs: string; mtimeMs: number }>> = {
    failed: [],
    dbBak: [],
    assetsBak: [],
  };

  for (const name of entries) {
    let group: keyof typeof groups | null = null;
    if (name.startsWith("restore-staging-") && name.includes(".failed")) group = "failed";
    else if (name.startsWith("travel-map.sqlite.bak-")) group = "dbBak";
    else if (name.startsWith("assets.bak-")) group = "assetsBak";
    if (!group) continue;

    const abs = path.join(input.userDataPath, name);
    let stat: fs.Stats;
    try {
      stat = await fs.promises.lstat(abs);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;
    if ((group === "failed" || group === "assetsBak") && !stat.isDirectory()) continue;
    if (group === "dbBak" && !stat.isFile()) continue;

    groups[group].push({ abs, mtimeMs: stat.mtimeMs });
  }

  for (const g of Object.keys(groups) as Array<keyof typeof groups>) {
    groups[g].sort((a, b) => b.mtimeMs - a.mtimeMs);
    const { ttlMs, topK } = cfg[g];
    let removed = 0;
    for (let i = 0; i < groups[g].length; i++) {
      const item = groups[g][i];
      const ageMs = input.now - item.mtimeMs;
      if (i >= topK && ageMs > ttlMs) {
        try {
          await fs.promises.rm(item.abs, { recursive: true, force: true });
          removed++;
        } catch {}
      }
    }
    if (removed) logRestoreEvent({ level: "info", event: "restore.cleanup.removed", meta: { group: g, removed } });
  }
  logRestoreEvent({ level: "info", event: "restore.cleanup.done" });
}
