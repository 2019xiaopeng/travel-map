import path from "path";

export function resolveLocalAssetRequest(input: { requestUrl: string; userDataPath: string }): {
  allowed: boolean;
  relativePath: string;
  absolutePath: string;
} {
  const raw = String(input.requestUrl ?? "");
  const prefix = "local://";
  const rawRest = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  const relativePathRaw = rawRest.startsWith("/")
    ? rawRest.replace(/^\/+/, "")
    : (() => {
        const idx = rawRest.indexOf("/");
        if (idx === -1) return rawRest;
        const host = rawRest.slice(0, idx);
        const tail = rawRest.slice(idx + 1);
        return `${host}/${tail}`;
      })();

  const relativePath = decodeURIComponent(relativePathRaw);
  const normalizedRelative = path.posix.normalize(relativePath);

  const assetsRoot = path.resolve(path.join(input.userDataPath, "assets"));
  const absolutePath = path.resolve(path.join(input.userDataPath, normalizedRelative));

  const assetsRootWithSep = assetsRoot.endsWith(path.sep) ? assetsRoot : `${assetsRoot}${path.sep}`;
  const absoluteWithSep = absolutePath.endsWith(path.sep) ? absolutePath : `${absolutePath}${path.sep}`;

  if (!normalizedRelative.startsWith("assets/")) {
    return { allowed: false, relativePath: normalizedRelative, absolutePath };
  }

  if (!absoluteWithSep.startsWith(assetsRootWithSep)) {
    return { allowed: false, relativePath: normalizedRelative, absolutePath };
  }

  return { allowed: true, relativePath: normalizedRelative, absolutePath };
}
