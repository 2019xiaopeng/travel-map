export function normalizeTagInput(input: string) {
  const raw = String(input ?? "");
  const withoutHash = raw.startsWith("#") ? raw.slice(1) : raw;
  return withoutHash.trim();
}

