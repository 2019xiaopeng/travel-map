import fs from "node:fs/promises";
import path from "node:path";

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

export async function readLocalText(input: {
  userDataPath: string;
  localPath: string;
  maxBytes: number;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const assetsRoot = path.resolve(path.join(input.userDataPath, "assets"));
  const absolutePath = path.resolve(path.join(input.userDataPath, input.localPath));

  if (!absolutePath.startsWith(assetsRoot + path.sep)) {
    return { ok: false, error: "Access Denied" };
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) {
    return { ok: false, error: "Unsupported text file" };
  }

  const stat = await fs.stat(absolutePath);
  if (stat.size > input.maxBytes) {
    return { ok: false, error: "File too large to preview" };
  }

  return { ok: true, text: await fs.readFile(absolutePath, "utf8") };
}
