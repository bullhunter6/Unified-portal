import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function withTimeout<T>(p: Promise<T>, ms = 30000): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return p.finally(() => clearTimeout(t));
}

async function postJSON(url: string, body: any, headers: Record<string,string>) {
  const res = await withTimeout(fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }), 30000);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

export async function GET(req: Request) {
  try {
    const name = new URL(req.url).searchParams.get("name")?.trim();
    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    // 1) search company
    const searchUrl = "https://marketingwidget.iss-corporate.com/api/searchCompany";
    const searchPayload = { searchTerm: name };
    const searchHeaders = {
      "accept": "application/json, text/plain, */*",
      "content-type": "application/json",
      "user-agent": UA,
      "origin": "https://marketingwidget.iss-corporate.com",
      "referer": "https://marketingwidget.iss-corporate.com/home",
    };

    const searchData = await postJSON(searchUrl, searchPayload, searchHeaders);
    if (!Array.isArray(searchData) || searchData.length === 0) {
      return NextResponse.json({ source: "ISS", oekomRating: "-" });
    }

    const picked = searchData[0];
    const entityId = picked?.entityId || picked?.entityID || picked?.EntityId;
    if (!entityId) return NextResponse.json({ source: "ISS", oekomRating: "-" });

    // 2) details
    const detailUrl = `https://marketingwidget.iss-corporate.com/api/getCompanyDetails/${encodeURIComponent(entityId)}`;
    const details = await postJSON(detailUrl, {}, {
      "accept": "application/json, text/plain, */*",
      "content-type": "application/json",
      "user-agent": UA,
    });

    const list = details?.companyData ?? [];
    if (!Array.isArray(list) || list.length === 0) {
      return NextResponse.json({ source: "ISS", oekomRating: "-" });
    }

    // The Python code returns the list; your UI uses the first item
    const first = { ...list[0], source: "ISS" };
    // ensure the key your UI reads:
    if (first.oekomRating == null) first.oekomRating = "-";

    return NextResponse.json(first);
  } catch {
    return NextResponse.json({ source: "ISS", oekomRating: "-" });
  }
}