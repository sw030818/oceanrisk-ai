export function selectAvailableFlash(models: unknown, excluded: string): string | null {
  if (!Array.isArray(models)) return null;
  const candidates = models.slice(0, 100).flatMap((entry: unknown) => {
    const item = entry as { name?: unknown; supportedGenerationMethods?: unknown } | null;
    if (!item || typeof item.name !== "string" || !Array.isArray(item.supportedGenerationMethods) || !item.supportedGenerationMethods.includes("generateContent")) return [];
    const name = item.name.replace(/^models\//, "");
    if (["gemini-flash-latest", "gemini-flash-lite-latest"].includes(name) && name !== excluded)
      return [{ name, score: name === "gemini-flash-latest" ? 0 : -1 }];
    const match = /^gemini-(\d+(?:\.\d+)?)-flash(?:-lite)?(?:-(?:preview|exp|latest|\d+)(?:-[a-z0-9]+)*)?$/.exec(name);
    if (!match || name === excluded) return [];
    return [{ name, score: Number(match[1]) * 100 - (/preview|exp/.test(name) ? 5 : 0) - (name.includes("-lite") ? 2 : 0) }];
  });
  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return candidates[0]?.name ?? null;
}
