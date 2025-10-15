import { prismaCredit } from "@/db/credit";

export type CreditRegion = "global" | "MiddleEast" | "CentralAsia";
export type CreditSector =
  | "sovereigns"
  | "banks"
  | "sovereignsRACS"
  | "banksRACS"
  | "corporates"
  | "corporatesRACS";

export type CreditArticle = {
  id: number;
  title: string;
  source: string | null;
  date: Date | null;
  link: string | null;
  region: CreditRegion;
  sector: CreditSector;
};

type ListCreditArticlesOpts = {
  date?: string;
  region?: CreditRegion | null;
  sector?: CreditSector | null;
  source?: string | null;
  page?: number;
  pageSize?: number;
};

export async function listCreditArticles(opts: ListCreditArticlesOpts) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(6, opts.pageSize ?? 18));
  const offset = (page - 1) * pageSize;

  const params: any[] = [];
  let where = `WHERE 1=1`;

  // today-only by default
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  params.push(date);
  where += ` AND date::date = $${params.length}::date`;

  if (opts.region) {
    params.push(opts.region);
    where += ` AND region = $${params.length}`;
  }

  if (opts.sector) {
    params.push(opts.sector);
    where += ` AND sector = $${params.length}`;
  }

  if (opts.source) {
    params.push(opts.source);
    where += ` AND source = $${params.length}`;
  }

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM credit_articles
    ${where}
  `;

  const dataQuery = `
    SELECT id, title, source, date, link, region, sector
    FROM credit_articles
    ${where}
    ORDER BY date DESC, id DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const [countRow] = await prismaCredit.$queryRawUnsafe<any[]>(countQuery, ...params);
  const rows = await prismaCredit.$queryRawUnsafe<CreditArticle[]>(dataQuery, ...params);

  return {
    total: countRow?.total ?? 0,
    page,
    pageSize,
    items: rows,
  };
}
