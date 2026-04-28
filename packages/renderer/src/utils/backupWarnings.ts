export function formatBackupWarnings(warnings: Array<{ type: string; asset_id?: string; message: string }>) {
  const list = Array.isArray(warnings) ? warnings : [];
  if (list.length === 0) return "";
  const head = list.slice(0, 5);
  const lines = head.map((w) => `- ${w.type}${w.asset_id ? ` (${w.asset_id})` : ""}: ${w.message}`);
  const suffix = list.length > head.length ? `\n... 还有 ${list.length - head.length} 条` : "";
  return `发现 ${list.length} 条异常：\n${lines.join("\n")}${suffix}`;
}

