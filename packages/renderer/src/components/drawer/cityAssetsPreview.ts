export type CityAssetPreviewKind = "image" | "pdf" | "text" | "external";

export function getCityAssetPreviewKind(input: {
  mime: string;
  original_filename: string;
}): CityAssetPreviewKind {
  const mime = String(input.mime ?? "").toLowerCase();
  const filename = String(input.original_filename ?? "").toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || filename.endsWith(".pdf")) return "pdf";

  if (
    mime === "text/plain" ||
    mime === "text/markdown" ||
    filename.endsWith(".txt") ||
    filename.endsWith(".md") ||
    filename.endsWith(".markdown")
  ) {
    return "text";
  }

  return "external";
}

export function localPathToLocalUrl(localPath: string) {
  const normalized = String(localPath ?? "");
  if (normalized.startsWith("assets/")) return `local://assets/${normalized.slice("assets/".length)}`;
  return `local:///${normalized.replace(/^\/+/, "")}`;
}
