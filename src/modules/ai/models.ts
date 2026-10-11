export function availableFlashModels(models: unknown, excluded: string): string[] {
  if (!Array.isArray(models)) return [];
  const originalVersion = /^gemini-(\d+(?:\.\d+)?)-flash/.exec(excluded)?.[1];
  const candidates = models.slice(0, 100).flatMap((entry: unknown) => {
    const item = entry as { name?: unknown; supportedGenerationMethods?: unknown } | null;
    if (!item || typeof item.name !== "string" || !Array.isArray(item.supportedGenerationMethods) || !item.supportedGenerationMethods.includes("generateContent")) return [];
    const name = item.name.replace(/^models\//, "");
    if (/(?:^|-)(?:tts|audio|live|image|vision|computer|research|robotic)(?:-|$)/i.test(name)) return [];
    if (["gemini-flash-latest", "gemini-flash-lite-latest"].includes(name) && name !== excluded)
      return [{ name, score: name === "gemini-flash-latest" ? 50000 : 49999 }];
    const match = /^gemini-(\d+(?:\.\d+)?)-flash(?:-lite)?(?:-(?:preview|exp|latest|\d+)(?:-[a-z0-9]+)*)?$/.exec(name);
    if (!match || name === excluded) return [];
    const stable = !/preview|exp/.test(name);
    const versionScore = originalVersion ? -Math.abs(Number(match[1]) - Number(originalVersion)) * 100 : Number(match[1]) * 100;
    return [{ name, score: (stable ? 100000 : 0) + (match[1] === originalVersion ? 10000 : 0) + versionScore - (name.includes("-lite") ? 2 : 0) }];
  });
  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return [...new Set(candidates.map(candidate => candidate.name))];
}
export function selectAvailableFlash(models: unknown, excluded: string): string | null {
  return availableFlashModels(models, excluded)[0] ?? null;
}
