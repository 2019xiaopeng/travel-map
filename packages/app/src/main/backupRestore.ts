import fs from "fs";
import path from "path";
import yauzl from "yauzl";
import crypto from "crypto";

function envNumber(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
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

function safeJoin(baseDir: string, rel: string) {
  const normalized = rel.replace(/^\/+/, "");
  const abs = path.resolve(path.join(baseDir, normalized));
  const base = path.resolve(baseDir);
  if (!abs.startsWith(base + path.sep) && abs !== base) return null;
  return abs;
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
  const pendingPath = path.join(input.userDataPath, "restore-pending.json");
  if (!fs.existsSync(pendingPath)) return false;

  let pending: any;
  try {
    pending = JSON.parse(await fs.promises.readFile(pendingPath, "utf8"));
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

  const uniquePath = (p: string) => {
    if (!fs.existsSync(p)) return p;
    for (let i = 1; i < 1000; i++) {
      const next = `${p}-${i}`;
      if (!fs.existsSync(next)) return next;
    }
    return `${p}-${Date.now()}`;
  };

  const dbBak = uniquePath(`${currentDb}.bak-${input.now}`);
  const assetsBak = uniquePath(path.join(input.userDataPath, `assets.bak-${input.now}`));

  let movedCurrentDb = false;
  let movedCurrentAssets = false;
  let movedStagedDb = false;
  let movedStagedAssets = false;

  try {
    if (fs.existsSync(currentDb)) {
      await fs.promises.rename(currentDb, dbBak);
      movedCurrentDb = true;
    }
    if (fs.existsSync(currentAssets)) {
      await fs.promises.rename(currentAssets, assetsBak);
      movedCurrentAssets = true;
    }

    await fs.promises.rename(stagedDb, currentDb);
    movedStagedDb = true;
    await fs.promises.rename(stagedAssets, currentAssets);
    movedStagedAssets = true;

    await fs.promises.unlink(pendingPath);
    try {
      await fs.promises.rm(stagingPath, { recursive: true, force: true });
    } catch {}
    return true;
  } catch {
    try {
      if (movedStagedAssets && movedCurrentAssets && fs.existsSync(currentAssets) && fs.existsSync(assetsBak)) {
        const failed = uniquePath(path.join(input.userDataPath, `assets.failed-${input.now}`));
        await fs.promises.rename(currentAssets, failed);
        await fs.promises.rename(assetsBak, currentAssets);
      } else if (movedCurrentAssets && fs.existsSync(assetsBak) && !fs.existsSync(currentAssets)) {
        await fs.promises.rename(assetsBak, currentAssets);
      }
    } catch {}

    try {
      if (movedStagedDb && movedCurrentDb && fs.existsSync(currentDb) && fs.existsSync(dbBak)) {
        const failed = uniquePath(`${currentDb}.failed-${input.now}`);
        await fs.promises.rename(currentDb, failed);
        await fs.promises.rename(dbBak, currentDb);
      } else if (movedCurrentDb && fs.existsSync(dbBak) && !fs.existsSync(currentDb)) {
        await fs.promises.rename(dbBak, currentDb);
      }
    } catch {}

    try {
      await fs.promises.unlink(pendingPath);
    } catch {}

    try {
      const failed = uniquePath(`${stagingPath}.failed`);
      await fs.promises.rename(stagingPath, failed);
    } catch {}

    return false;
  }
}
