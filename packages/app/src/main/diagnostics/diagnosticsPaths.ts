import fs from "fs";
import path from "path";

async function isSymlink(absPath: string) {
  try {
    return (await fs.promises.lstat(absPath)).isSymbolicLink();
  } catch {
    return false;
  }
}

function isUnder(root: string, p: string) {
  const r = path.resolve(root);
  const a = path.resolve(p);
  return a === r || a.startsWith(r + path.sep);
}

export async function resolveDiagnosticsRevealAbsolutePath(input: { userDataPath: string; relativePath: string }) {
  const userDataPath = input.userDataPath;
  const relRaw = String(input.relativePath ?? "").replace(/\\/g, "/");
  if (!relRaw || path.isAbsolute(relRaw)) return { ok: false as const, error: "Access Denied" };
  if (relRaw.startsWith("../") || relRaw.includes("/../")) return { ok: false as const, error: "Access Denied" };

  const rootDiagnostics = path.resolve(path.join(userDataPath, "diagnostics"));
  const rootLogs = path.resolve(path.join(userDataPath, "logs"));
  if (await isSymlink(rootDiagnostics)) return { ok: false as const, error: "Access Denied" };
  if (await isSymlink(rootLogs)) return { ok: false as const, error: "Access Denied" };

  const abs = path.resolve(path.join(userDataPath, relRaw));
  const ok = isUnder(rootDiagnostics, abs) || isUnder(rootLogs, abs);
  if (!ok) return { ok: false as const, error: "Access Denied" };

  if (await isSymlink(abs)) return { ok: false as const, error: "Access Denied" };
  return { ok: true as const, abs };
}

