import fs from "fs";
import path from "path";
import yauzl from "yauzl";

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

export async function stageRestoreFromZip(input: { zipPath: string; userDataPath: string; now: number }) {
  const stagingPath = path.join(input.userDataPath, `restore-staging-${input.now}`);
  await ensureDir(stagingPath);

  const pendingPath = path.join(input.userDataPath, "restore-pending.json");

  await new Promise<void>((resolve, reject) => {
    yauzl.open(input.zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err);
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

        const absDest = safeJoin(stagingPath, relDest);
        if (!absDest) {
          zipfile.readEntry();
          return;
        }

        writeZipEntry(zipfile, entry, absDest)
          .then(() => zipfile.readEntry())
          .catch((e) => reject(e));
      });
      zipfile.on("end", () => resolve());
      zipfile.on("error", reject);
    });
  });

  await fs.promises.writeFile(pendingPath, JSON.stringify({ stagingPath }, null, 2), "utf8");

  return { ok: true as const, stagingPath };
}

export async function applyPendingRestoreIfPresent(input: { userDataPath: string; now: number }) {
  const pendingPath = path.join(input.userDataPath, "restore-pending.json");
  if (!fs.existsSync(pendingPath)) return false;

  const pending = JSON.parse(await fs.promises.readFile(pendingPath, "utf8"));
  const stagingPath = String(pending?.stagingPath ?? "");
  if (!stagingPath) return false;

  const stagedDb = path.join(stagingPath, "travel-map.sqlite");
  const stagedAssets = path.join(stagingPath, "assets");

  if (!fs.existsSync(stagedDb) || !fs.existsSync(stagedAssets)) return false;

  const currentDb = path.join(input.userDataPath, "travel-map.sqlite");
  const currentAssets = path.join(input.userDataPath, "assets");

  const dbBak = `${currentDb}.bak-${input.now}`;
  const assetsBak = path.join(input.userDataPath, `assets.bak-${input.now}`);

  if (fs.existsSync(currentDb)) {
    await fs.promises.rename(currentDb, dbBak);
  }
  if (fs.existsSync(currentAssets)) {
    await fs.promises.rename(currentAssets, assetsBak);
  }

  await fs.promises.rename(stagedDb, currentDb);
  await fs.promises.rename(stagedAssets, currentAssets);

  await fs.promises.unlink(pendingPath);
  try {
    await fs.promises.rm(stagingPath, { recursive: true, force: true });
  } catch {}

  return true;
}
