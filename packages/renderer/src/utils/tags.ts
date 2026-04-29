export function normalizeTagInput(input: string) {
  const trimmed = String(input ?? "").trim();
  return trimmed.startsWith("#") ? trimmed.slice(1).trim() : trimmed;
}

export function validateTagInput(input: string) {
  const v = normalizeTagInput(input);
  if (!v) return { ok: false as const, error: "empty" as const };
  if (v.length > 32) return { ok: false as const, error: "too_long" as const };
  if (/\s/.test(v)) return { ok: false as const, error: "whitespace" as const };
  if (/[\u0000-\u001f\u007f]/.test(v)) return { ok: false as const, error: "control" as const };
  return { ok: true as const, value: v };
}
