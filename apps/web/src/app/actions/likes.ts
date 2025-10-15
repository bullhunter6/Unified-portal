"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { getPrisma, Domain } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function toggleLike(
  domain: Domain,
  contentId: number,
  contentType: "article" | "event" | "publication",
  like: boolean
) {
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as any)?.id);
  if (!userId) return { ok: false as const, reason: "not_authenticated" };

  const prisma = getPrisma(domain);

  try {
    if (like) {
      await prisma.$executeRaw`
        INSERT INTO likes (user_id, content_type, content_id, created_at)
        VALUES (${userId}, ${contentType}, ${contentId}, now())
        ON CONFLICT (user_id, content_type, content_id)
        DO UPDATE SET created_at = EXCLUDED.created_at;
      `;
    } else {
      await prisma.$executeRaw`
        DELETE FROM likes
        WHERE user_id = ${userId}
          AND content_type = ${contentType}
          AND content_id = ${contentId};
      `;
    }

    const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM likes
      WHERE content_type = ${contentType}
        AND content_id = ${contentId};
    `;

    // 🔁 Clear cached RSC pages so navigation shows fresh results
    revalidatePath(`/${domain}/community`);
    revalidatePath(`/${domain}/articles`);
    revalidatePath(`/${domain}/articles/${contentId}`);
    revalidatePath(`/${domain}`); // home stats, if any

    return { ok: true as const, count, liked: like };
  } catch (e: any) {
    return { ok: false as const, reason: e?.message ?? "db_error" };
  }
}