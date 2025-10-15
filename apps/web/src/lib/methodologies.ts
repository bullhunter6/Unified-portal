import { getPrisma } from "@/lib/db";

export type Methodology = {
  id: number;
  title: string;
  published_date: Date | null;
  abstract: string | null;
  description: string | null;
  link: string | null;
  source: "Fitch Banks" | "Fitch Corporates" | "S&P Global";
  permalink: string | null;
  report_url: string | null;
};

const ORDER = `COALESCE(published_date, created_at) DESC`;

export async function listMethodologiesBySource() {
  const prisma = getPrisma("credit");
  
  // fetch once, group in JS (keeps ordering consistent)
  const rows = await prisma.$queryRawUnsafe<Methodology[]>(`
    SELECT id, title, published_date, abstract, description, link, source, permalink, report_url
    FROM methodologies
    ORDER BY ${ORDER}
  `);

  return {
    fitchBanks: rows.filter(r => r.source === "Fitch Banks"),
    fitchCorporates: rows.filter(r => r.source === "Fitch Corporates"),
    spGlobal: rows.filter(r => r.source === "S&P Global"),
  };
}

export async function getMethodology(id: number) {
  const prisma = getPrisma("credit");
  
  const [row] = await prisma.$queryRaw<Methodology[]>`
    SELECT id, title, published_date, abstract, description, link, source, permalink, report_url
    FROM methodologies
    WHERE id = ${id}
    LIMIT 1
  `;
  return row ?? null;
}