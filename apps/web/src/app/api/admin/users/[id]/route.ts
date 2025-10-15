import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { esgPrisma } from "@esgcredit/db-esg";
import bcrypt from "bcryptjs";

// GET /api/admin/users/[id] - Get user details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is admin
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const userId = parseInt(params.id);

    const user = await esgPrisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        first_name: true,
        last_name: true,
        team: true,
        is_admin: true,
        is_active_db: true,
        created_at: true,
        last_login: true,
        email_notifications: true,
        preferred_categories: true,
        _count: {
          select: {
            alert_preferences: true,
            likes: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is admin
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const userId = parseInt(params.id);
    const body = await req.json();
    const { email, password, first_name, last_name, team, is_admin, is_active } = body;

    // Build update data
    const updateData: any = {};
    
    if (email !== undefined) updateData.email = email;
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (team !== undefined) updateData.team = team;
    if (is_admin !== undefined) updateData.is_admin = is_admin;
    if (is_active !== undefined) updateData.is_active_db = is_active;
    
    // Hash password if provided
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    // Update user
    const updatedUser = await esgPrisma.users.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        team: true,
        is_admin: true,
        is_active_db: true,
        created_at: true,
        last_login: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is admin
    if (!(session as any)?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const userId = parseInt(params.id);
    const sessionUserId = session?.user ? parseInt((session.user as any).id) : null;

    // Prevent self-deletion
    if (sessionUserId && userId === sessionUserId) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Manually delete related records first (in case cascade is not set up in DB)
    // Delete email_queue records
    await esgPrisma.email_queue.deleteMany({
      where: { user_id: userId },
    });

    // Delete alert_preferences (this will cascade to alert_content_sent)
    await esgPrisma.alert_preferences.deleteMany({
      where: { user_id: userId },
    });

    // Delete likes (should have cascade, but doing it explicitly)
    await esgPrisma.likes.deleteMany({
      where: { user_id: userId },
    });

    // Delete PDF translation jobs (user_id is nullable)
    await esgPrisma.pdf_translation_jobs.deleteMany({
      where: { user_id: userId },
    });

    // Delete translation_history
    await esgPrisma.translation_history.deleteMany({
      where: { user_id: userId },
    });

    // Delete user_preferences
    await esgPrisma.user_preferences.deleteMany({
      where: { user_id: userId },
    });

    // Delete file_uploads (user_id is nullable)
    await esgPrisma.file_uploads.deleteMany({
      where: { user_id: userId },
    });

    // Finally delete the user
    await esgPrisma.users.delete({
      where: { id: userId },
    });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete user" },
      { status: 500 }
    );
  }
}
