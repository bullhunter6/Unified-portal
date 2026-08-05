import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/config/env";
export { MAX_PDF_UPLOAD_BYTES } from "@/lib/pdfx/constants";

const ROOT = process.cwd();
const BASE = env.PDFX_STORAGE_DIR;
export const PDFX_BASE = path.resolve(ROOT, BASE);
export const PDFX_UPLOADS = path.join(PDFX_BASE, "uploads");
export const PDFX_OUTPUTS = path.join(PDFX_BASE, "outputs");
export const MAX_PDF_PAGES = 100;

export function ensureFolders() {
  [PDFX_BASE, PDFX_UPLOADS, PDFX_OUTPUTS].forEach((p) => {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
}

export function jobInputPath(stored: string) {
  return resolveInside(PDFX_UPLOADS, stored);
}

export function pdfUploadPath(jobId: string) {
  return jobInputPath(`${jobId}.pdf`);
}

export function normalizePdfDisplayName(name: string, jobId: string): string {
  const leaf = path.posix.basename(String(name || "").replace(/\\/g, "/"));
  const cleaned = leaf
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/["<>|:*?]/g, "_")
    .trim()
    .slice(0, 180);

  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `upload_${jobId}.pdf`;
}

export function assertPdfxManagedPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (isInside(PDFX_UPLOADS, resolved) || isInside(PDFX_OUTPUTS, resolved)) {
    return resolved;
  }

  throw new Error("Refusing to access a path outside PDFX storage");
}

function resolveInside(root: string, leaf: string): string {
  if (!leaf || path.isAbsolute(leaf)) {
    throw new Error("Invalid PDFX storage path");
  }

  const resolved = path.resolve(root, leaf);
  if (!isInside(root, resolved)) {
    throw new Error("Refusing to resolve a path outside PDFX storage");
  }

  return resolved;
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}
