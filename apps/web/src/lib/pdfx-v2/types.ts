import type {
  DocumentContext,
  PdfPageLayout,
  PdfPageTranslation,
} from './schemas';

export const PDFX_V2_SUPPORTED_LANGUAGES = [
  'English',
  'Arabic',
  'Russian',
] as const;

export type PdfxV2TargetLanguage = (typeof PDFX_V2_SUPPORTED_LANGUAGES)[number];

export type PdfxV2Stage =
  | 'queued'
  | 'extracting'
  | 'context'
  | 'translating'
  | 'validating'
  | 'rendering'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface PdfxV2JobPayload {
  filename: string;
  targetLang: PdfxV2TargetLanguage;
  pageCount: number;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  responseId: string;
}

export interface ExtractedPageResult extends ModelUsage {
  layout: PdfPageLayout;
  attempts: number;
}

export interface TranslatedPageResult extends ModelUsage {
  translation: PdfPageTranslation;
  layout: PdfPageLayout;
  attempts: number;
  validation: PdfxV2Validation;
}

export interface PdfxV2Validation {
  valid: boolean;
  failures: string[];
  warnings: string[];
}

export interface SourcePageMapping {
  sourcePageNumber: number;
  outputPageNumbers: number[];
}

export interface TranslatedPdfResult {
  outputPath: string;
  pageMap: SourcePageMapping[];
}

export interface ContextResult extends ModelUsage {
  context: DocumentContext;
}

export function isPdfxV2TargetLanguage(
  value: unknown,
): value is PdfxV2TargetLanguage {
  return typeof value === 'string' &&
    (PDFX_V2_SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
