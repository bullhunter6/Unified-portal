export const PDFX_SUPPORTED_LANGUAGES = [
  "English",
  "Arabic",
  "Russian",
] as const;

export type PdfxSupportedLanguage = (typeof PDFX_SUPPORTED_LANGUAGES)[number];

export const MAX_PDF_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
export const MAX_PDF_REQUEST_BYTES =
  MAX_PDF_UPLOAD_BYTES + MAX_PDF_MULTIPART_OVERHEAD_BYTES;

export const PDFX_ACTIVE_STATUSES = [
  "queued",
  "processing",
  "cancelling",
] as const;

export const PDFX_TERMINAL_STATUSES = [
  "completed",
  "error",
  "cancelled",
  "failed",
  "stopped",
] as const;

export type PdfxActiveStatus = (typeof PDFX_ACTIVE_STATUSES)[number];
export type PdfxTerminalStatus = (typeof PDFX_TERMINAL_STATUSES)[number];
export type PdfxJobStatus = PdfxActiveStatus | PdfxTerminalStatus;

export function isPdfxSupportedLanguage(
  value: unknown,
): value is PdfxSupportedLanguage {
  return (
    typeof value === "string" &&
    (PDFX_SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

export function isPdfxActiveStatus(value: unknown): value is PdfxActiveStatus {
  return (
    typeof value === "string" &&
    (PDFX_ACTIVE_STATUSES as readonly string[]).includes(value)
  );
}

export function isPdfxTerminalStatus(
  value: unknown,
): value is PdfxTerminalStatus {
  return (
    typeof value === "string" &&
    (PDFX_TERMINAL_STATUSES as readonly string[]).includes(value)
  );
}

export function buildPdfxContentDisposition(
  disposition: "attachment" | "inline",
  filename: string,
): string {
  const wellFormedFilename = makeWellFormed(String(filename || "document.pdf"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim() || "document.pdf";
  const asciiFallback = wellFormedFilename
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\;]/g, "_")
    .trim()
    .slice(0, 180) || "document.pdf";
  const encodedFilename = encodeURIComponent(wellFormedFilename).replace(
    /['()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
}

function makeWellFormed(value: string): string {
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += value[index] + value[index + 1];
        index += 1;
      } else {
        result += "\ufffd";
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      result += "\ufffd";
    } else {
      result += value[index];
    }
  }

  return result;
}
