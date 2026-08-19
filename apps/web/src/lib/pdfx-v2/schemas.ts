import { z } from 'zod/v3';

// OpenAI Structured Outputs supports homogeneous array `items`, but not the
// tuple form emitted by `z.tuple()` (`items: [{...}, {...}]`). Keep the exact
// four-coordinate contract through minItems/maxItems instead.
export const BBoxSchema = z.array(z.number()).length(4);

export const PdfCellSchema = z.object({
  id: z.string(),
  rowIndex: z.number().int().nonnegative(),
  columnIndex: z.number().int().nonnegative(),
  rowSpan: z.number().int().positive(),
  columnSpan: z.number().int().positive(),
  isHeader: z.boolean(),
  text: z.string(),
  bbox: BBoxSchema,
});

export const PdfTableRowSchema = z.object({
  rowIndex: z.number().int().nonnegative(),
  cells: z.array(PdfCellSchema),
});

export const PdfElementSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'heading',
    'paragraph',
    'list',
    'table',
    'header',
    'footer',
    'page_number',
    'image',
    'stamp',
    'signature',
    'other',
  ]),
  order: z.number().int().nonnegative(),
  level: z.number().int().nonnegative(),
  text: z.string(),
  bbox: BBoxSchema,
  columnCount: z.number().int().nonnegative(),
  rowCount: z.number().int().nonnegative(),
  rows: z.array(PdfTableRowSchema),
});

export const PdfPageLayoutSchema = z.object({
  pageNumber: z.number().int().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  orientation: z.enum(['portrait', 'landscape']),
  sourceLanguage: z.string(),
  sourceScript: z.string(),
  elements: z.array(PdfElementSchema),
  warnings: z.array(z.string()),
});

export const DocumentContextSchema = z.object({
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  documentType: z.string(),
  summary: z.string(),
  preserveTerms: z.array(z.string()),
  terminology: z.array(z.object({
    source: z.string(),
    target: z.string(),
    note: z.string(),
  })),
});

export const TranslatedCellSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const TranslatedElementSchema = z.object({
  id: z.string(),
  text: z.string(),
  cells: z.array(TranslatedCellSchema),
});

export const PdfPageTranslationSchema = z.object({
  pageNumber: z.number().int().positive(),
  elements: z.array(TranslatedElementSchema),
  warnings: z.array(z.string()),
});

export const PdfPageReviewSchema = z.object({
  pageNumber: z.number().int().positive(),
  complete: z.boolean(),
  meaningPreserved: z.boolean(),
  targetLanguageSatisfied: z.boolean(),
  tableStructurePreserved: z.boolean(),
  failures: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type PdfPageLayout = z.infer<typeof PdfPageLayoutSchema>;
export type PdfElement = z.infer<typeof PdfElementSchema>;
export type PdfCell = z.infer<typeof PdfCellSchema>;
export type DocumentContext = z.infer<typeof DocumentContextSchema>;
export type PdfPageTranslation = z.infer<typeof PdfPageTranslationSchema>;
export type PdfPageReview = z.infer<typeof PdfPageReviewSchema>;
