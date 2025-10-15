import { getPrisma } from "@/lib/db";
import fs from "node:fs/promises";
import type { Readable } from "node:stream";
import { translateChunk } from "./openai";
import { ensureFolders, jobInputPath } from "./fs";
import { extractPdfText } from "./textExtractor";

/**
 * Sanitize text to remove null bytes and other problematic characters
 * that PostgreSQL text fields cannot handle
 */
function sanitizeText(text: string): string {
  if (!text) return "";
  // Remove null bytes (\u0000) and other control characters except newlines and tabs
  return text
    .replace(/\u0000/g, "") // Remove null bytes
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ""); // Remove other control chars except \t, \n, \r
}

/**
 * Simple in-memory registry so we can cancel jobs.
 */
type JobState = { cancelled?: boolean; running?: boolean };
const registry = new Map<string, JobState>();
export function cancelJob(jobId: string) {
  const s = registry.get(jobId);
  if (s) s.cancelled = true;
}
export function isCancelled(jobId: string) {
  return registry.get(jobId)?.cancelled === true;
}

type PageEntry = {
  page_number: number;
  original_text: string;
  translated_text: string;
};

export async function startPdfJob(job: {
  id: string;
  user_id: number;
  stored_filename: string;
  target_lang: string;
}) {
  ensureFolders();
  registry.set(job.id, { running: true });

  const prisma = getPrisma("esg");
  const inputPath = jobInputPath(job.stored_filename);
  let buffer: Buffer;

  try {
    buffer = await fs.readFile(inputPath);
  } catch (e) {
    await (prisma as any).pdf_translation_jobs.update({
      where: { id: job.id },
      data: { status: "error", message: "File missing on disk", progress: 100 },
    });
    registry.delete(job.id);
    return;
  }

  // Extract text from PDF using our custom extractor
  const perPage = await extractPdfText(buffer);

  await (prisma as any).pdf_translation_jobs.update({
    where: { id: job.id },
    data: {
      status: "processing",
      message: "Extracted text, translating...",
      total_pages: perPage.length,
      current_page: 0,
      progress: 10,
    },
  });

  const translated_pages: PageEntry[] = [];
  let current = 0;

  for (let i = 0; i < perPage.length; i++) {
    if (isCancelled(job.id)) break;
    current = i + 1;
    const original_text = sanitizeText(perPage[i] || "");

    await (prisma as any).pdf_translation_jobs.update({
      where: { id: job.id },
      data: {
        current_page: current,
        progress: 10 + Math.floor((current / Math.max(1, perPage.length)) * 80),
        message: `Translating page ${current}/${perPage.length}...`,
      },
    });

    // Short-circuit very empty pages
    let translated_text = "";
    if (original_text.trim().length < 5) {
      translated_text = "";
    } else {
      // big pages → chunk
      if (original_text.length > 3500) {
        const chunks = chunkText(original_text, 3000);
        const outs: string[] = [];
        for (const ch of chunks) {
          const translatedChunk = await translateChunk(ch, job.target_lang || "English");
          outs.push(sanitizeText(translatedChunk));
          // small delay helps prevent rate-limits across many pages
          await new Promise((r) => setTimeout(r, 200));
        }
        translated_text = outs.join("\n\n");
      } else {
        const translatedChunk = await translateChunk(original_text, job.target_lang || "English");
        translated_text = sanitizeText(translatedChunk);
      }
    }

    translated_pages.push({
      page_number: current,
      original_text,
      translated_text,
    });

    // write incremental state
    await (prisma as any).pdf_translation_jobs.update({
      where: { id: job.id },
      data: {
        translated_pages: translated_pages as any,
      },
    });
  }

  if (isCancelled(job.id)) {
    await (prisma as any).pdf_translation_jobs.update({
      where: { id: job.id },
      data: { status: "cancelled", message: "Job cancelled", progress: 100 },
    });
    registry.delete(job.id);
    return;
  }

  await (prisma as any).pdf_translation_jobs.update({
    where: { id: job.id },
    data: {
      status: "completed",
      message: `Translated ${translated_pages.length} pages.`,
      progress: 100,
    },
  });

  registry.delete(job.id);
}

function chunkText(s: string, max = 3000) {
  const parts: string[] = [];
  let cur = "";
  for (const para of s.split(/\n{2,}/g)) {
    if (cur.length + para.length + 2 > max) {
      if (cur) parts.push(cur);
      cur = para;
    } else {
      cur = cur ? cur + "\n\n" + para : para;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}