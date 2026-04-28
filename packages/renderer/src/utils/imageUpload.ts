export function deriveUploadFilename(file: { name?: unknown; type?: unknown }) {
  const name = typeof file?.name === "string" ? file.name.trim() : "";
  if (name) return name;

  const type = typeof file?.type === "string" ? file.type : "";
  const ext =
    type === "image/png"
      ? "png"
      : type === "image/jpeg"
        ? "jpg"
        : type === "image/webp"
          ? "webp"
          : type === "image/gif"
            ? "gif"
            : "bin";

  return `pasted-image.${ext}`;
}

