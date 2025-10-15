import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function withTimeout<T>(p: Promise<T>, ms = 30000): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return p.finally(() => clearTimeout(t));
}

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await withTimeout(fetch(url, { ...init, signal: (init as any)?.signal }), 30000);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}
async function fetchText(url: string, init?: RequestInit) {
  const res = await withTimeout(fetch(url, { ...init, signal: (init as any)?.signal }), 30000);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export async function GET(req: Request) {
  try {
    const name = new URL(req.url).searchParams.get("name")?.trim();
    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    // 1) Search S&P to get company id (cid)
    const searchUrl = `https://www.spglobal.com/api/apps/s1/query/s1-scores?q=${encodeURIComponent(
      name
    )}&auto=true`;

    const search = await fetchJSON(searchUrl, {
      headers: {
        "user-agent": UA,
        accept: "application/json, text/plain, */*",
        referer: "https://www.spglobal.com/sustainable1/en/scores/results",
        authorization:
          // this token is public in their website scripts and rotates; when it rotates your code still fails gracefully.
          'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzZWFyY2gtcXVlcnkiLCJjbGllbnQtaWQiOiJ3ZWItc2VhcmNoIiwiZXhwIjoxNzU4MTAzNjc3MTM3fQ.RY7Sfd_F58EdwKsrad6xFVOM-842hxmuEIwaTXH_p4Y',
      },
    });

    const docs: any[] = search?.response?.docs ?? [];
    if (!docs.length) {
      return NextResponse.json({ source: "S&P", esg_score: "-" });
    }

    const targetDoc =
      docs.find((d) => (d?.es_long_name_s || "").toLowerCase().trim() === name.toLowerCase().trim()) ??
      docs.find((d) => {
        const long = (d?.es_long_name_s || "").toLowerCase();
        return name
          .toLowerCase()
          .split(/\s+/)
          .every((w) => long.includes(w));
      }) ??
      docs[0];

    const cid = targetDoc?.es_company_id_i;
    if (!cid) return NextResponse.json({ source: "S&P", esg_score: "-" });

    // 2) Fetch HTML result page
    const pageUrl = `https://www.spglobal.com/content/spglobal/sustainable1/us/en/scores/results.html?cid=${cid}`;
    const html = await fetchText(pageUrl, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        referer: `https://www.spglobal.com/sustainable1/en/scores/results?cid=${cid}`,
      },
    });

    // 3) Minimal parsing (no cheerio): try to locate a row with 6 cells and pick text.
    // We fall back safely to "-" if structure changes.
    const normalize = (s: string) =>
      s
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // extract H1 as company title if present
    const h1Regex = /<h1[^>]*>(.*?)<\/h1>/i;
    const h1Match = html.match(h1Regex);
    const companyName = h1Match ? normalize(h1Match[1]).replace(/ ESG Score$/i, "") : undefined;

    // naïve capture of "rows": look for divs with role=row and capture their inner
    const rowRegex = /<div[^>]+role=["']row["'][^>]*>([\s\S]*?)<\/div>/gi;
    const rowsRaw: string[] = [];
    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      rowsRaw.push(rowMatch[1]);
    }

    let rowData: string[] | null = null;
    for (const row of rowsRaw) {
      // capture "cells" inside row
      const cellRegex = /<div[^>]+role=["'](?:cell|columnheader)["'][^>]*>([\s\S]*?)<\/div>/gi;
      const cells: string[] = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        cells.push(normalize(cellMatch[1]));
      }
      if (cells.length >= 6 && cells[0]?.toLowerCase() !== "company") {
        rowData = cells.slice(0, 6);
        break;
      }
    }

    const result = {
      source: "S&P",
      company_id: cid,
      company_name: companyName || targetDoc?.es_long_name_s || name,
      long_name: rowData?.[0] ?? companyName ?? name,
      industry: rowData?.[1] ?? "-",
      csa_score: rowData?.[2] ?? "-",
      esg_score: rowData?.[3] ?? "-",
      score_under_review: rowData?.[4] ?? "-",
      last_updated: rowData?.[5] ?? "-",
      url: pageUrl,
    };

    return NextResponse.json(result);
  } catch {
    // never blow up the UI
    return NextResponse.json({ source: "S&P", esg_score: "-" });
  }
}