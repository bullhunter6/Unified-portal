import type { EsgEventFilters } from "./types";

export function normalizeExternalUrl(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 2_048) return null;
  try {
    const url = new URL(candidate);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
export function buildEsgEventQuery(filters: EsgEventFilters): string {
  const params = new URLSearchParams();
  if (filters.when !== "upcoming") params.set("when", filters.when);
  if (filters.q) params.set("q", filters.q);
  if (filters.country) params.set("country", filters.country);
  if (filters.city) params.set("city", filters.city);
  if (filters.format) params.set("format", filters.format);
  if (filters.source) params.set("source", filters.source);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

export function buildEsgEventsUrl(filters: EsgEventFilters): string {
  const query = buildEsgEventQuery(filters);
  return query ? `/esg/events?${query}` : "/esg/events";
}

export function updateEsgEventFilters(
  filters: EsgEventFilters,
  updates: Partial<EsgEventFilters>,
): EsgEventFilters {
  const next = { ...filters, ...updates };
  const filterChanged = (["when", "q", "country", "city", "format", "source"] as const)
    .some((key) => updates[key] !== undefined && updates[key] !== filters[key]);
  if (filterChanged && updates.page === undefined) next.page = 1;
  if (updates.country !== undefined && updates.country !== filters.country && updates.city === undefined) {
    delete next.city;
  }
  return next;
}

export function buildEsgEventDetailUrl(id: number, returnFilters?: EsgEventFilters): string {
  const path = `/esg/events/${id}`;
  if (!returnFilters) return path;
  const back = buildEsgEventsUrl(returnFilters);
  return `${path}?back=${encodeURIComponent(back)}`;
}
