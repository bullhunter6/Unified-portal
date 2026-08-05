import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { esgPrisma } from "@esgcredit/db-esg";
import { buildTranslatedPdf } from "./buildPdf";
import { extractAllPages, ocrPageToText, selectBestPageText } from "./extract";
import { MAX_PDF_PAGES } from "./fs";
import { translatePage } from "./translate";
import type { PageRecord } from "./types";
import type { ClaimedBackgroundJob } from "@/lib/jobs/queue";
import {
  completePdfTranslationJob,
  createBackgroundJobData,
  rethrowBackgroundJobEnqueueError,
  throwIfJobCancelled,
  updateBackgroundJobProgress,
} from "@/lib/jobs/queue";

export interface PdfJobPayload {
  filename: string;
  storedFilename: string;
  targetLang: string;
  pageCount: number;
}

export async function startPdfJob(params: {
  jobId: string;
  userId: number;
  filename: string;
  storedFilename: string;
  targetLang: string;
  pageCount: number;
  inputBuffer: Buffer;
}): Promise<void> {
  const payload: PdfJobPayload = {
    filename: params.filename,
    storedFilename: params.storedFilename,
    targetLang: params.targetLang,
    pageCount: params.pageCount,
  };

  try {
    await esgPrisma.$transaction([
      esgPrisma.pdf_translation_jobs.create({
        data: {
          id: params.jobId,
          user_id: params.userId,
          filename: params.filename,
          stored_filename: params.storedFilename,
          input_path: `db://background_jobs/${params.jobId}/input`,
          target_lang: params.targetLang,
          status: "queued",
          message: "Queued for processing",
          progress: 0,
          total_pages: params.pageCount,
          current_page: 0,
          pages: [],
          translated_pages: [],
        },
      }),
      esgPrisma.background_jobs.create({
        data: createBackgroundJobData({
          id: params.jobId,
          jobType: "pdf_translation",
          userId: params.userId,
          payload,
          inputData: params.inputBuffer,
          maxAttempts: 2,
        }),
      }),
    ]);
  } catch (error) {
    rethrowBackgroundJobEnqueueError(error);
  }
}

export async function processPdfTranslationJob(
  job: ClaimedBackgroundJob<PdfJobPayload>,
): Promise<{ queueCompleted: true; result: Record<string, unknown> }> {
  if (!job.inputData) throw new Error("PDF input is missing");

  const existing = await esgPrisma.pdf_translation_jobs.findFirst({
    where: { id: job.id, user_id: job.userId },
    select: {
      status: true,
      output_pdf: true,
      total_pages: true,
      translated_pages: true,
    },
  });
  if (!existing) throw new Error("PDF translation record is missing");
  if (existing.status === "completed" && existing.output_pdf) {
    const result = { pages: existing.total_pages, pageMap: [], reused: true };
    await completePdfTranslationJob(job.id, job.userId, job.leaseOwner, {
      outputPdf: Buffer.from(existing.output_pdf),
      translatedPages: existing.translated_pages,
      result,
      message: `Done. ${existing.total_pages} pages processed.`,
    });
    return {
      queueCompleted: true,
      result,
    };
  }

  const workDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "pdfx-worker-"));
  const inputPath = path.join(workDirectory, `${job.id}.pdf`);
  const outputPath = path.join(workDirectory, `${job.id}-translated.pdf`);

  const reportProgress = async (
    progress: number,
    message: string,
    patch: { current_page?: number; total_pages?: number; pages?: PageRecord[] } = {},
  ) => {
    await throwIfJobCancelled(job.id, job.leaseOwner);
    await updateBackgroundJobProgress(job.id, job.leaseOwner, progress, {
      message,
      currentPage: patch.current_page ?? 0,
      totalPages: patch.total_pages ?? job.payload.pageCount,
    });
    const domainProgress = await esgPrisma.pdf_translation_jobs.updateMany({
      where: {
        id: job.id,
        user_id: job.userId,
        status: { in: ["queued", "processing"] },
      },
      data: {
        status: "processing",
        message,
        progress,
        current_page: patch.current_page,
        total_pages: patch.total_pages,
        pages: patch.pages,
      },
    });
    if (domainProgress.count !== 1) {
      await throwIfJobCancelled(job.id, job.leaseOwner);
      throw new Error("PDF translation record is no longer active");
    }
  };

  try {
    await fs.writeFile(inputPath, job.inputData, { flag: "wx" });
    await reportProgress(5, "Analyzing PDF…");

    const pages = await extractAllPages(inputPath);
    if (pages.length < 1 || pages.length > MAX_PDF_PAGES) {
      throw new Error(`PDF page count must be between 1 and ${MAX_PDF_PAGES}`);
    }
    await reportProgress(10, `Extracting ${pages.length} pages…`, {
      total_pages: pages.length,
      pages,
    });

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      await reportProgress(
        10 + Math.round((index / Math.max(1, pages.length)) * 25),
        `Extracting page ${page.pageNumber}/${pages.length}…`,
        { current_page: page.pageNumber, total_pages: pages.length },
      );
      if (page.needsOcr || !page.originalText?.trim()) {
        const embeddedText = page.originalText || "";
        const ocrText = await ocrPageToText(
          inputPath,
          page.pageNumber,
          workDirectory,
        );
        const recoveredText = selectBestPageText(embeddedText, ocrText);
        if (
          page.requiresRecoveredScanText &&
          recoveredText === selectBestPageText(embeddedText, "")
        ) {
          throw new Error(
            `OCR did not recover the scanned body on source page ${page.pageNumber}; refusing to translate only its embedded header`,
          );
        }
        page.originalText = recoveredText;
      }
      page.status = "extracted";
    }
    await esgPrisma.pdf_translation_jobs.updateMany({
      where: { id: job.id, user_id: job.userId, status: "processing" },
      data: { pages },
    });

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      await reportProgress(
        35 + Math.round((index / Math.max(1, pages.length)) * 55),
        `Translating page ${page.pageNumber}/${pages.length}…`,
        { current_page: page.pageNumber, total_pages: pages.length },
      );
      page.translatedText = await translatePage(
        page.originalText || "",
        job.payload.targetLang,
      );
      page.status = "translated";

      if (index % 3 === 0 || index === pages.length - 1) {
        const saved = await esgPrisma.pdf_translation_jobs.updateMany({
          where: { id: job.id, user_id: job.userId, status: "processing" },
          data: { translated_pages: pages },
        });
        if (saved.count !== 1) await throwIfJobCancelled(job.id, job.leaseOwner);
      }
    }

    await reportProgress(95, "Building translated PDF…", {
      current_page: pages.length,
      total_pages: pages.length,
    });
    const generated = await buildTranslatedPdf(pages, outputPath);
    const output = await fs.readFile(outputPath);
    await throwIfJobCancelled(job.id, job.leaseOwner);

    const result = { pages: pages.length, pageMap: generated.pageMap };
    await completePdfTranslationJob(job.id, job.userId, job.leaseOwner, {
      outputPdf: output,
      translatedPages: pages,
      result,
      message: `Done. ${pages.length} pages processed.`,
    });
    return { queueCompleted: true, result };
  } finally {
    await fs.rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
