export function parseKeywords(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return j.map(String).filter(Boolean);
    } catch {}
    return raw
      .split(/[;,]/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (typeof raw === "object") {
    const vals: string[] = [];
    for (const v of Object.values(raw)) {
      if (Array.isArray(v)) vals.push(...(v as any[]).map(String));
      else if (typeof v === "string") vals.push(v);
    }
    return vals.filter(Boolean);
  }
  return [];
}