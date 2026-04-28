/** Generate an asset filename: {assetId}__{originalName} */
export function assetFilename(assetId: string, originalName: string): string {
  return `${assetId}__${originalName}`;
}

/** Parse assetId from a stored filename */
export function parseAssetFilename(filename: string): {
  assetId: string;
  originalName: string;
} | null {
  const idx = filename.indexOf("__");
  if (idx === -1) return null;
  return {
    assetId: filename.slice(0, idx),
    originalName: filename.slice(idx + 2),
  };
}

export function localAssetUrl(localPath: string): string {
  const normalized = String(localPath ?? "").replace(/^\/+/, "");
  if (normalized.startsWith("assets/")) return `local://assets/${normalized.slice("assets/".length)}`;
  return `local:///${normalized}`;
}
