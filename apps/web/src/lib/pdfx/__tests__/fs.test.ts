import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PDFX_BASE,
  assertPdfxManagedPath,
  jobInputPath,
  normalizePdfDisplayName,
  pdfUploadPath,
} from "@/lib/pdfx/fs";

describe("PDFX managed paths", () => {
  it("creates a server-controlled PDF filename", () => {
    const jobId = "11111111-1111-4111-8111-111111111111";

    expect(pdfUploadPath(jobId)).toBe(jobInputPath(`${jobId}.pdf`));
    expect(normalizePdfDisplayName("../../quarterly-report.pdf", jobId)).toBe(
      "quarterly-report.pdf",
    );
  });

  it("rejects traversal and absolute stored filenames", () => {
    expect(() => jobInputPath("../../../outside.pdf")).toThrow(/outside PDFX storage/);
    expect(() => jobInputPath(path.resolve(PDFX_BASE, "outside.pdf"))).toThrow(
      /Invalid PDFX storage path/,
    );
  });

  it("rejects database paths outside the managed upload/output roots", () => {
    const outside = path.resolve(PDFX_BASE, "..", "outside.pdf");
    expect(() => assertPdfxManagedPath(outside)).toThrow(/outside PDFX storage/);
  });
});
