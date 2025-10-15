/* Fitch GraphQL helpers + DB cache (Credit DB) */

import { getPrisma } from "@/lib/db";

const FITCH_ENDPOINT = "https://api.fitchratings.com/";

function norm(s: string) {
  return s.trim().toLowerCase();
}

async function postGQL(query: string, variables: any) {
  const res = await fetch(FITCH_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": "https://www.fitchratings.com",
      "referer": "https://www.fitchratings.com/",
      "user-agent": "Mozilla/5.0",
      accept: "*/*",
    },
    body: JSON.stringify({ query, variables }),
    // avoid caching at edge
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fitch API error ${res.status}`);
  return res.json();
}

export async function getSlug(companyName: string) {
  const q = `
    query Suggest($item: SearchItem, $term: String!) {
      suggest(item: $item, term: $term) {
        entity { name permalink }
      }
    }`;
  const data = await postGQL(q, { item: "ENTITY", term: companyName });
  const items: Array<{name: string; permalink: string}> =
    data?.data?.suggest?.entity ?? [];
  const lc = companyName.toLowerCase();
  const hit = items.find((e) => e.name?.toLowerCase()?.includes(lc));
  return hit ? { name: hit.name, slug: hit.permalink } : null;
}

export async function getCompany(slug: string) {
  const q = `
    query Entity($slug: String!) {
      getEntity(slug: $slug) {
        name
        ratings { ratingCode ratingActionDescription ratingChangeDate ratingTypeDescription ratingAlertCode }
        ratingHistory { ratingCode ratingActionDescription ratingChangeDate ratingTypeDescription }
        latestRAC { rows { title slug } }
      }
    }`;
  const data = await postGQL(q, { slug });
  return data?.data?.getEntity ?? null;
}

export async function searchCompanyCached(userInput: string) {
  const prisma = getPrisma("credit");
  const n = norm(userInput);

  // 1) check cache
  const cached = await prisma.$queryRaw<
    { details: any; name: string }[]
  >`
    SELECT details, name FROM company_details
    WHERE normalized_name = ${n}
    LIMIT 1
  `;
  if (cached.length) {
    return { fromCache: true, company: cached[0].details };
  }

  // 2) resolve slug then fetch details
  const slugInfo = await getSlug(userInput);
  if (!slugInfo) return { fromCache: false, company: null };

  const company = await getCompany(slugInfo.slug);
  if (!company) return { fromCache: false, company: null };

  // 3) store in cache
  await prisma.$queryRawUnsafe(
    `INSERT INTO company_details (name, slug, details, normalized_name, user_entered_name)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (normalized_name) DO UPDATE SET
       details = EXCLUDED.details,
       name = EXCLUDED.name,
       slug = EXCLUDED.slug`,
    slugInfo.name,
    slugInfo.slug,
    company,
    n,
    userInput
  );

  return { fromCache: false, company };
}