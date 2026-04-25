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

/** Build a local:// protocol URL for an asset */
export function localAssetUrl(assetId: string): string {
  return `local://asset/${assetId}`;
}
