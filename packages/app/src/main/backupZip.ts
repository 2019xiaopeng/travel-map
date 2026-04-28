import crypto from "crypto";
import fs from "fs";
import path from "path";
import yazl from "yazl";

export type BackupAssetRow = {
  asset_id: string;
  sha256: string;
  local_path: string;
  size: number;
  remote_url: string | null;
};

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

async function fileInfo(filePath: string) {
  const stat = await fs.promises.stat(filePath);
  const sha256 = await sha256File(filePath);
  return { sha256, size: stat.size };
}

async function listFilesRecursively(rootDir: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(abs);
      } else if (e.isFile()) {
        out.push(abs);
      }
    }
  }

  if (fs.existsSync(rootDir)) {
    await walk(rootDir);
  }

  return out;
}

export async function createBackupZip(input: {
  zipPath: string;
  userDataPath: string;
  dbSnapshotPath: string;
  appVersion: string;
  exportedAt: number;
  assets: BackupAssetRow[];
}) {
  const assetsRoot = path.resolve(path.join(input.userDataPath, "assets"));
  const dbSha256 = await sha256File(input.dbSnapshotPath);

  const warnings: Array<{ type: string; asset_id?: string; message: string }> = [];

  const normalizedAssets = await Promise.all(
    input.assets.map(async (a) => {
      const localPath = String(a.local_path ?? "");
      if (!localPath.startsWith("assets/")) {
        warnings.push({ type: "invalid_local_path", asset_id: a.asset_id, message: localPath });
        return {
          asset_id: a.asset_id,
          sha256: a.sha256,
          relative_path: localPath,
          size: a.size,
          remote_url: a.remote_url ?? null,
        };
      }

      const abs = path.resolve(path.join(input.userDataPath, localPath));
      if (!abs.startsWith(assetsRoot + path.sep)) {
        warnings.push({ type: "path_outside_assets", asset_id: a.asset_id, message: localPath });
        return {
          asset_id: a.asset_id,
          sha256: a.sha256,
          relative_path: localPath,
          size: a.size,
          remote_url: a.remote_url ?? null,
        };
      }

      if (!fs.existsSync(abs)) {
        warnings.push({ type: "missing_file", asset_id: a.asset_id, message: localPath });
        return {
          asset_id: a.asset_id,
          sha256: a.sha256,
          relative_path: localPath,
          size: a.size,
          remote_url: a.remote_url ?? null,
        };
      }

      const info = await fileInfo(abs);
      if (String(a.sha256) !== info.sha256 || Number(a.size) !== info.size) {
        warnings.push({ type: "metadata_mismatch", asset_id: a.asset_id, message: localPath });
      }

      return {
        asset_id: a.asset_id,
        sha256: info.sha256,
        relative_path: localPath,
        size: info.size,
        remote_url: a.remote_url ?? null,
      };
    }),
  );

  const manifest = {
    exported_at: input.exportedAt,
    app_version: input.appVersion,
    db_sha256: dbSha256,
    assets: normalizedAssets,
    warnings,
  };

  await fs.promises.mkdir(path.dirname(input.zipPath), { recursive: true });

  const zip = new yazl.ZipFile();

  zip.addBuffer(Buffer.from(JSON.stringify(manifest, null, 2), "utf8"), "manifest.json");
  zip.addFile(input.dbSnapshotPath, "db.sqlite");

  const assetFiles = await listFilesRecursively(assetsRoot);
  for (const abs of assetFiles) {
    const relUnderAssets = path.relative(assetsRoot, abs).split(path.sep).join("/");
    const entryName = `assets/${relUnderAssets}`;
    zip.addFile(abs, entryName);
  }

  const outStream = fs.createWriteStream(input.zipPath);

  await new Promise<void>((resolve, reject) => {
    outStream.on("close", () => resolve());
    outStream.on("error", reject);
    zip.outputStream.pipe(outStream);
    zip.end();
  });
}
