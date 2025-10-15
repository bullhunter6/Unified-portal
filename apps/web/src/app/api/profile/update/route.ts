import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";

export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ ok: false, reason: "invalid_user_id" }, { status: 400 });
    }

    // Parse request body
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, reason: "invalid_body" }, { status: 400 });
    }

    const { name, email, team, first_name, last_name, bio, preferred_categories } = body;

    // Build update object with only provided fields
    const updateData: any = {};
    
    if (name !== undefined) {
      // Update username field with the name
      updateData.username = name;
    }
    
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;
    if (team !== undefined && (team === "esg" || team === "credit")) {
      updateData.team = team;
    }
    if (preferred_categories !== undefined) updateData.preferred_categories = preferred_categories;

    // Update user in database
    await esgPrisma.users.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({ 
      ok: true, 
      message: "Profile updated successfully",
      updated: updateData 
    });
  } catch (error: any) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { ok: false, reason: "update_failed", detail: error.message },
      { status: 500 }
    );
  }
}
