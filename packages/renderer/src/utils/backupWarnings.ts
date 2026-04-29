export function formatBackupWarnings(warnings: Array<{ type: string; asset_id?: string; message: string }>) {
  const list = Array.isArray(warnings) ? warnings : [];
  if (list.length === 0) return "";
  const head = list.slice(0, 5);
  const lines = head.map((w) => `- ${w.type}${w.asset_id ? ` (${w.asset_id})` : ""}: ${w.message}`);
  const suffix = list.length > head.length ? `\n... 还有 ${list.length - head.length} 条` : "";
  return `发现 ${list.length} 条异常：\n${lines.join("\n")}${suffix}`;
}

export function formatBackupWarningsGrouped(warnings: Array<{ type: string; asset_id?: string; message: string }>) {
  const list = Array.isArray(warnings) ? warnings : [];
  if (list.length === 0) return "";

  const counts = new Map<string, number>();
  for (const w of list) {
    const t = String(w?.type ?? "");
    if (!t) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  const highRisk = new Set(["import_missing_asset", "import_asset_sha256_mismatch", "import_asset_size_mismatch"]);
  const high: Array<[string, number]> = [];
  const rest: Array<[string, number]> = [];
  const examples = new Map<string, string[]>();

  for (const [t, c] of counts.entries()) {
    if (highRisk.has(t)) high.push([t, c]);
    else rest.push([t, c]);
  }

  high.sort((a, b) => b[1] - a[1]);
  rest.sort((a, b) => b[1] - a[1]);

  const parts: string[] = [`发现 ${list.length} 条异常`];
  if (high.length > 0) {
    parts.push(`\n高风险：\n${high.map(([t, c]) => `- ${t} ×${c}`).join("\n")}`);

    for (const w of list) {
      const t = String(w?.type ?? "");
      if (!highRisk.has(t)) continue;
      const msg = String(w?.message ?? "");
      const arr = examples.get(t) ?? [];
      if (arr.length < 3 && msg) {
        arr.push(`${w.asset_id ? `${w.asset_id}: ` : ""}${msg}`);
        examples.set(t, arr);
      }
    }

    const exampleLines: string[] = [];
    for (const [t, msgs] of examples.entries()) {
      for (const m of msgs) exampleLines.push(`- ${t}: ${m}`);
    }
    if (exampleLines.length > 0) {
      parts.push(`\n示例：\n${exampleLines.join("\n")}`);
    }
  }
  if (rest.length > 0) {
    parts.push(`\n汇总：\n${rest.map(([t, c]) => `- ${t} ×${c}`).join("\n")}`);
  }

  return parts.join("\n");
}
