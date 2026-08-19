const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 100_000;

export interface PdfxV2Pagination {
  page: number;
  pageSize: number;
  skip: number;
}

function parsePositiveInteger(value: string | null, fallback: number, max: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) return null;
  return parsed;
}

export function parsePdfxV2Pagination(
  searchParams: URLSearchParams,
): PdfxV2Pagination | null {
  const page = parsePositiveInteger(searchParams.get('page'), 1, MAX_PAGE);
  const pageSize = parsePositiveInteger(
    searchParams.get('pageSize'),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  if (page === null || pageSize === null) return null;
  return { page, pageSize, skip: (page - 1) * pageSize };
}
