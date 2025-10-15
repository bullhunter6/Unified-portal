import { NextResponse } from "next/server";
import { esgPrisma } from "@esgcredit/db-esg";
import { findUserByEmail } from "@/lib/auth-db";
import bcrypt from "bcryptjs";

/**
 * Tries 3 insert shapes in order:
 *  1) Modern: (username, email, password_hash, team, created_at) - saves user's team (esg/credit)
 *  2) Legacy w/ NOT NULL username/password: (username, email, password, password_hash, is_admin, created_at)
 *  3) Minimal legacy: (email, password_hash, created_at)
 *
 * Whichever works first returns 200.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  const team = (body?.default_domain === "credit" ? "credit" : "esg") as "esg" | "credit";

  if (!name || !email || !password) {
    return NextResponse.json({ ok: false, reason: "missing_fields" }, { status: 400 });
  }

  const exists = await findUserByEmail(email);
  if (exists) return NextResponse.json({ ok: false, reason: "email_exists" }, { status: 409 });

  const hash = await bcrypt.hash(password, 10);
  const username = name || email.split("@")[0];

  // 1) Modern schema with team column
  try {
    const rows = await esgPrisma.$queryRaw<{ id: number }[]>`
      INSERT INTO users (username, email, password_hash, team, created_at)
      VALUES (${username}, ${email}, ${hash}, ${team}, now())
      RETURNING id;
    `;
    return NextResponse.json({ ok: true, id: rows[0]?.id ?? null, mode: "modern" });
  } catch (e1) {
    // fall through
  }

  // 2) Legacy schema with NOT NULL username/password
  try {
    const rows = await esgPrisma.$queryRaw<{ id: number }[]>`
      INSERT INTO users (username, email, password, password_hash, is_admin, created_at)
      VALUES (${username}, ${email}, ${""}, ${hash}, false, now())
      RETURNING id;
    `;
    return NextResponse.json({ ok: true, id: rows[0]?.id ?? null, mode: "legacy_full" });
  } catch (e2) {
    // fall through
  }

  // 3) Minimal legacy (if username/password are nullable)
  try {
    const rows = await esgPrisma.$queryRaw<{ id: number }[]>`
      INSERT INTO users (email, password_hash, created_at)
      VALUES (${email}, ${hash}, now())
      RETURNING id;
    `;
    return NextResponse.json({ ok: true, id: rows[0]?.id ?? null, mode: "legacy_min" });
  } catch (e3: any) {
    return NextResponse.json(
      { ok: false, reason: "insert_failed", detail: String(e3?.message ?? e3) },
      { status: 500 }
    );
  }
}
