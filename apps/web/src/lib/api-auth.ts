import "server-only";

import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { esgPrisma } from "@esgcredit/db-esg";
import { env } from "@/lib/config/env";
import { authOptions } from "@/lib/nextauth-options";

type SessionWithRole = Session & {
  role?: string;
  is_admin?: boolean;
  user: NonNullable<Session["user"]> & {
    id?: string;
    role?: string;
    is_admin?: boolean;
    team?: string;
  };
};

type AuthResult =
  | { session: SessionWithRole; response?: never }
  | { session?: never; response: NextResponse };

type UserSessionResult =
  | { session: SessionWithRole; userId: number; response?: never }
  | { session?: never; userId?: never; response: NextResponse };

type EmailSessionResult =
  | { session: SessionWithRole; email: string; userId: number; response?: never }
  | { session?: never; email?: never; userId?: never; response: NextResponse };

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireSession(): Promise<AuthResult> {
  const session = (await getServerSession(authOptions)) as SessionWithRole | null;

  if (!session?.user) {
    return { response: unauthorized() };
  }

  return { session };
}

export async function requireUserSession(): Promise<UserSessionResult> {
  const auth = await requireSession();
  if (auth.response) return { response: auth.response };

  const userId = Number(auth.session.user.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return { response: unauthorized() };
  }

  return { session: auth.session, userId };
}

export async function requireEmailSession(): Promise<EmailSessionResult> {
  const auth = await requireUserSession();
  if (auth.response) return { response: auth.response };

  const email = auth.session.user.email?.trim();
  if (!email) {
    return { response: unauthorized() };
  }

  return { session: auth.session, email, userId: auth.userId };
}

export async function requireAdminSession(): Promise<AuthResult> {
  const auth = await requireUserSession();
  if (auth.response) return { response: auth.response };

  const user = await esgPrisma.users.findUnique({
    where: { id: auth.userId },
    select: { is_admin: true, is_active_db: true },
  });

  if (!user || !user.is_active_db) {
    return { response: unauthorized() };
  }

  if (user.is_admin !== true) {
    return { response: forbidden("Admin access required") };
  }

  return { session: auth.session };
}

export function requireCronSecret(request: Request): NextResponse | null {
  const cronSecret = env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  return null;
}
