import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = process.env.PDFX_STORAGE_DIR || ".pdfx_store";
export const PDFX_BASE = path.join(ROOT, BASE);
export const PDFX_UPLOADS = path.join(PDFX_BASE, "uploads");
export const PDFX_OUTPUTS = path.join(PDFX_BASE, "outputs");

export function ensureFolders() {
  [PDFX_BASE, PDFX_UPLOADS, PDFX_OUTPUTS].forEach((p) => {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
}

export function jobInputPath(stored: string) {
  return path.join(PDFX_UPLOADS, stored);
}