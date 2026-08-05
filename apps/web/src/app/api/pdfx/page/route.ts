import { NextRequest, NextResponse } from "next/server";
import { esgPrisma } from "@esgcredit/db-esg";
import { requirePdfxUser } from "@/lib/pdfx/auth";
import { isUuid } from "@/lib/jobs/queue";
import { MAX_PDF_PAGES } from "@/lib/pdfx/fs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requirePdfxUser();
  if (auth.response) return auth.response;
  const jobId = req.nextUrl.searchParams.get("jobId")!;
  const page = Number(req.nextUrl.searchParams.get("page") || 1);
  if (!isUuid(jobId) || !Number.isSafeInteger(page) || page < 1 || page > MAX_PDF_PAGES) {
    return NextResponse.json({ success: false, error: "Invalid query parameters" }, { status: 400 });
  }

  const row = await esgPrisma.pdf_translation_jobs.findFirst({
    where: { id: jobId, user_id: auth.userId },
  });
  if (!row)
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const list = Array.isArray(row.translated_pages) ? row.translated_pages : [];
  if (row.total_pages && page > row.total_pages) {
    return NextResponse.json({ success: false, error: "Page not found" }, { status: 404 });
  }
  const item = list.find((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    return Number(record.pageNumber ?? record.page_number) === page;
  });
  const record = item && typeof item === "object" && !Array.isArray(item)
    ? item as Record<string, unknown>
    : null;

  const response = NextResponse.json({
    success: true,
    page,
    originalText: stringValue(record?.originalText ?? record?.original_text),
    translatedText: stringValue(record?.translatedText ?? record?.translated_text),
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
