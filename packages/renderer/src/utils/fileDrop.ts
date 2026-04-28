export function extractFilePaths(files: Array<{ path?: unknown }>) {
  const next: string[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const p = typeof f?.path === "string" ? f.path : "";
    if (!p) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    next.push(p);
  }
  return next;
}

