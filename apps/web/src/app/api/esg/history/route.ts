import { NextResponse } from "next/server";
import { esgPrisma } from "@esgcredit/db-esg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userIdParam = new URL(req.url).searchParams.get("userId");
    const userId = userIdParam ? parseInt(userIdParam) : null;
    
    // Build where clause based on whether userId is provided
    const whereClause = userId ? { user_id: userId } : {};
    
    const rows = await esgPrisma.file_uploads.findMany({
      where: whereClause,
      orderBy: { created_at: "desc" },
      take: 50,
      select: {
        id: true,
        task_id: true,
        original_filename: true,
        output_filename: true,
        status: true,
        error_message: true,
        created_at: true,
        updated_at: true,
      }
    });

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("History API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch history" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const taskId = new URL(req.url).searchParams.get("taskId");
    
    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    // Delete the record from database
    const deletedRecord = await esgPrisma.file_uploads.delete({
      where: { task_id: taskId },
    });

    // Also try to delete the physical file if it exists
    try {
      const fs = require("fs");
      const path = require("path");
      if (deletedRecord.output_filename) {
        const UPLOAD_DIR = path.join(process.cwd(), "uploads", "esg");
        const filePath = path.join(UPLOAD_DIR, deletedRecord.output_filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (fileError) {
      console.error("Failed to delete physical file:", fileError);
      // Continue even if file deletion fails
    }

    return NextResponse.json({ success: true, deleted: deletedRecord });
  } catch (error: any) {
    console.error("Delete API error:", error);
    
    // Handle case where record doesn't exist
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to delete record" },
      { status: 500 }
    );
  }
}