import {
  ESG_EVENT_DIGEST_DELIVERY_MODES,
  ESG_EVENT_DIGEST_DELIVERY_STATUSES,
  type EsgEventDigestDeliveryFilters,
} from "./digest-admin";

const ALLOWED_KEYS = new Set(["page", "status", "mode", "recipient"]);

export function parseEsgEventDigestAdminQuery(
  searchParams: URLSearchParams,
): EsgEventDigestDeliveryFilters | null {
  let invalidKey = false;
  searchParams.forEach((_value, key) => {
    if (!ALLOWED_KEYS.has(key) || searchParams.getAll(key).length !== 1) invalidKey = true;
  });
  if (invalidKey) return null;
  const rawPage = searchParams.get("page");
  if (rawPage !== null && !/^[1-9]\d{0,4}$/.test(rawPage)) return null;
  const page = rawPage ? Number(rawPage) : 1;

  const rawStatus = searchParams.get("status");
  const status = rawStatus || undefined;
  if (status && !ESG_EVENT_DIGEST_DELIVERY_STATUSES.includes(
    status as (typeof ESG_EVENT_DIGEST_DELIVERY_STATUSES)[number],
  )) return null;

  const rawMode = searchParams.get("mode");
  const mode = rawMode || undefined;
  if (mode && !ESG_EVENT_DIGEST_DELIVERY_MODES.includes(
    mode as (typeof ESG_EVENT_DIGEST_DELIVERY_MODES)[number],
  )) return null;

  const rawRecipient = searchParams.get("recipient");
  const recipient = rawRecipient?.trim() || undefined;
  if (recipient && (recipient.length > 120 || /[\r\n\0]/.test(recipient))) return null;

  return {
    page,
    status: status as EsgEventDigestDeliveryFilters["status"],
    mode: mode as EsgEventDigestDeliveryFilters["mode"],
    recipient,
  };
}

export function buildEsgEventDigestAdminQuery(
  filters: EsgEventDigestDeliveryFilters,
  page = filters.page,
): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.mode) params.set("mode", filters.mode);
  if (filters.recipient) params.set("recipient", filters.recipient);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}
