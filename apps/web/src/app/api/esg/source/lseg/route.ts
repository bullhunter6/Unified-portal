import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function withTimeout<T>(p: Promise<T>, ms = 30000): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return p.finally(() => clearTimeout(t));
}
async function fetchJSON(url: string, init?: RequestInit) {
  const res = await withTimeout(fetch(url, { ...init }), 30000);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function cleanTokens(name: string) {
  const toks = name.toLowerCase().split(/\s+/);
  const stop = new Set(["s.a.", "ltd", "inc", "co", "company", "corporation", "limited", "plc", "corp"]);
  return toks.filter((t) => !stop.has(t));
}
function bestMatch(user: string, companies: any[]): { name: string; ric: string } | null {
  const userLower = user.toLowerCase();
  const userTokens = cleanTokens(userLower);
  let best: any = null;
  let bestScore = 0;

  for (const c of companies) {
    const compName: string = c.companyName || "";
    const ric = c.ricCode || "";
    const compLower = compName.toLowerCase();
    const compTokens = cleanTokens(compLower);

    if (compLower === userLower) return { name: compName, ric };

    const common = userTokens.filter((t) => compTokens.includes(t));
    const tokenScore = userTokens.length ? common.length / userTokens.length : 0;
    if (tokenScore >= 0.8) {
      const lenSim = 1 - Math.abs(userLower.length - compLower.length) / Math.max(userLower.length, compLower.length);
      const score = tokenScore * 0.7 + lenSim * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = { name: compName, ric };
      }
    }
  }
  return bestScore >= 0.6 ? best : null;
}

export async function GET(req: Request) {
  try {
    const name = new URL(req.url).searchParams.get("name")?.trim();
    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const suggestUrl = "https://www.lseg.com/bin/esg/esgsearchsuggestions";
    const suggestions = await fetchJSON(suggestUrl, {
      headers: {
        "user-agent": UA,
        accept: "*/*",
        referer: "https://www.lseg.com/en/data-analytics/sustainable-finance/esg-scores",
      },
    });

    const match = bestMatch(name, Array.isArray(suggestions) ? suggestions : []);
    if (!match) return NextResponse.json({ source: "LSEG", "TR.TRESG": "-" });

    const resultUrl = `https://www.lseg.com/bin/esg/esgsearchresult?ricCode=${encodeURIComponent(match.ric)}`;
    const data = await fetchJSON(resultUrl, {
      headers: {
        "user-agent": UA,
        accept: "*/*",
        referer: `https://www.lseg.com/en/data-analytics/sustainable-finance/esg-scores?esg=${encodeURIComponent(
          match.name
        )}`,
      },
    });

    const out: Record<string, any> = {
      source: "LSEG",
      "Company Name": match.name,
      "Ric Code": match.ric,
    };

    // industryComparison block
    const ic = data?.industryComparison ?? {};
    out["Industry Type"] = ic.industryType ?? "N/A";
    out["Score Year"] = ic.scoreYear ?? "N/A";
    if (ic.rank != null && ic.totalIndustries != null) {
      out["Rank"] = `${ic.rank} out of ${ic.totalIndustries}`;
    }

    // esgScore block
    const esg = data?.esgScore ?? {};
    // TR.TRESG / pillars
    out["TR.TRESG"] = esg?.["TR.TRESG"]?.score ?? esg?.["TR.TRESG.Score"] ?? "-";
    out["TR.GovernancePillar"] = esg?.["TR.GovernancePillar"]?.score ?? "N/A";
    out["TR.EnvironmentPillar"] = esg?.["TR.EnvironmentPillar"]?.score ?? "N/A";
    out["TR.SocialPillar"] = esg?.["TR.SocialPillar"]?.score ?? "N/A";

    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ source: "LSEG", "TR.TRESG": "-" });
  }
}