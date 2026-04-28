import crypto from "crypto";
import path from "path";

type Store = {
  getBySha256: (sha256: string) => Promise<{ assetId: string; localPath: string } | null>;
  insert: (record: {
    assetId: string;
    type: "image" | "file";
    originalFilename: string;
    mime: string;
    size: number;
    sha256: string;
    localPath: string;
    createdAt: number;
  }) => Promise<string>;
};

type FsOps = {
  mkdirp: (absDir: string) => Promise<void>;
  writeFile: (absPath: string, bytes: Uint8Array) => Promise<void>;
  unlink: (absPath: string) => Promise<void>;
};

export async function saveAssetBytesCore(input: {
  userDataPath: string;
  destRelativeDir: string;
  originalFilename: string;
  bytes: Uint8Array;
  mime: string;
  now: number;
  makeId: () => string;
  store: Store;
  fs: FsOps;
}): Promise<{ assetId: string; localUrl: string }> {
  const normalizedDestDir = path.posix.normalize(input.destRelativeDir).replace(/^(?:\.\.(?:\/|\\|$))+/, "");
  if (!/^[a-zA-Z0-9/_-]*$/.test(normalizedDestDir)) {
    throw new Error("Invalid destination directory");
  }

  const assetId = input.makeId();
  const destFilename = `${assetId}__${path.posix.basename(input.originalFilename)}`;
  const localPath = path.posix.join("assets", normalizedDestDir, destFilename);

  const assetsRootAbs = path.resolve(path.join(input.userDataPath, "assets"));
  const absoluteDestPath = path.resolve(path.join(input.userDataPath, localPath));
  if (!absoluteDestPath.startsWith(assetsRootAbs + path.sep)) {
    throw new Error("Invalid destination path");
  }

  const sha256 = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const existing = await input.store.getBySha256(sha256);

  await input.fs.mkdirp(path.dirname(absoluteDestPath));
  await input.fs.writeFile(absoluteDestPath, input.bytes);

  if (existing?.assetId && existing?.localPath) {
    await input.fs.unlink(absoluteDestPath);
    return { assetId: existing.assetId, localUrl: `local://assets/${existing.localPath.slice("assets/".length)}` };
  }

  await input.store.insert({
    assetId,
    type: input.mime.startsWith("image/") ? "image" : "file",
    originalFilename: path.posix.basename(input.originalFilename),
    mime: input.mime,
    size: input.bytes.byteLength,
    sha256,
    localPath,
    createdAt: input.now,
  });

  return { assetId, localUrl: `local://assets/${path.posix.join(normalizedDestDir, destFilename)}` };
}

