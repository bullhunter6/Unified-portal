// Pure server-side text extractor (no canvas)
// DO NOT import pdfjs at top-level to keep the module cold on edge paths.

import fs from 'node:fs/promises';
import path from 'node:path';
import { getPdfJsStandardFontDataUrl } from '@/lib/pdfjs-node';
import type { PageRecord } from './types';

type PageText = {
  pageNumber: number;
  text: string;
  needsOcr: boolean;
  requiresRecoveredScanText: boolean;
};

type Matrix = readonly [number, number, number, number, number, number];
type PageBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
};
type OperatorListLike = {
  fnArray: readonly number[];
  argsArray: readonly (readonly unknown[] | null)[];
};

const MAX_SPARSE_TEXT_CHARACTERS = 200;
const MAX_SPARSE_TEXT_AREA_RATIO = 0.02;
const MIN_RASTER_PAGE_COVERAGE = 0.65;
export const DEFAULT_OCR_LANGUAGES = 'eng+ara+uzb_cyrl';
let ocrEnvironmentPromise: Promise<NodeJS.ProcessEnv | undefined> | undefined;
let execaModulePromise: Promise<typeof import('execa')> | undefined;

async function loadExeca() {
  const execaModule = await (execaModulePromise ??= import('execa'));
  return execaModule.execa;
}

function stubGraphicsIfNeeded() {
  // Avoid pdfjs trying to polyfill DOMMatrix/Path2D via node-canvas
  // These light stubs satisfy feature detection without rendering.
  const g: any = globalThis as any;
  if (!g.DOMMatrix) g.DOMMatrix = class {};
  if (!g.Path2D) g.Path2D = class {};
}

/** Remove control bytes that break JSON, prompts, and PDF text writers. */
export function sanitizeExtractedText(text: string): string {
  return (text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/[\ufdd0-\ufdef\ufffe\uffff]/g, '')
    .replace(/[^\S\n]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Remove a narrow class of scan-margin noise without guessing at normal OCR
 * prose. Some scanned government documents produce several isolated glyphs at
 * the top of a page before a stable, numbered document header. Only discard the
 * prefix when there are at least three tiny blocks, one is punctuation-only,
 * and the following block looks like a labelled identifier containing digits.
 */
export function sanitizeOcrExtractedText(text: string): string {
  const sanitized = sanitizeExtractedText(text);
  const blocks = sanitized.split(/\n{2,}/g);
  let prefixLength = 0;
  let hasPunctuationOnlyBlock = false;

  while (prefixLength < blocks.length) {
    const block = blocks[prefixLength].trim();
    if (block.includes('\n') || Array.from(block).length > 3) break;
    if (block && !/[A-Za-z0-9\u00c0-\u024f\u0400-\u052f\u0600-\u06ff]/.test(block)) {
      hasPunctuationOnlyBlock = true;
    }
    prefixLength += 1;
  }

  const followingBlock = blocks[prefixLength]?.trim() ?? '';
  const labelledNumericHeader = /^[^:\s]{2,12}\s*:\s*.*\d/.test(followingBlock);
  if (
    prefixLength >= 3 &&
    hasPunctuationOnlyBlock &&
    labelledNumericHeader
  ) {
    return blocks.slice(prefixLength).join('\n\n');
  }

  return sanitized;
}

function asMatrix(value: unknown): Matrix | null {
  if (
    !Array.isArray(value) ||
    value.length !== 6 ||
    value.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))
  ) {
    return null;
  }
  return value as unknown as Matrix;
}

function multiplyMatrices(left: Matrix, right: Matrix): Matrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

type Point = readonly [number, number];

function clipPolygon(
  polygon: readonly Point[],
  inside: (point: Point) => boolean,
  intersection: (start: Point, end: Point) => Point,
): Point[] {
  const clipped: Point[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const startInside = inside(start);
    const endInside = inside(end);
    if (startInside && endInside) {
      clipped.push(end);
    } else if (startInside) {
      clipped.push(intersection(start, end));
    } else if (endInside) {
      clipped.push(intersection(start, end), end);
    }
  }
  return clipped;
}

function visibleUnitSquareArea(matrix: Matrix, pageBox: PageBox): number {
  let polygon: Point[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ].map(([x, y]) => [
    matrix[0] * x + matrix[2] * y + matrix[4],
    matrix[1] * x + matrix[3] * y + matrix[5],
  ] as Point);

  const clipX = (boundary: number, keepGreater: boolean) => {
    polygon = clipPolygon(
      polygon,
      ([x]) => keepGreater ? x >= boundary : x <= boundary,
      (start, end) => {
        const ratio = (boundary - start[0]) / (end[0] - start[0]);
        return [boundary, start[1] + ratio * (end[1] - start[1])];
      },
    );
  };
  const clipY = (boundary: number, keepGreater: boolean) => {
    polygon = clipPolygon(
      polygon,
      ([, y]) => keepGreater ? y >= boundary : y <= boundary,
      (start, end) => {
        const ratio = (boundary - start[1]) / (end[1] - start[1]);
        return [start[0] + ratio * (end[0] - start[0]), boundary];
      },
    );
  };

  clipX(pageBox.minX, true);
  clipX(pageBox.maxX, false);
  clipY(pageBox.minY, true);
  clipY(pageBox.maxY, false);
  if (polygon.length < 3) return 0;

  let doubledArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const point = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    doubledArea += point[0] * next[1] - next[0] * point[1];
  }
  return Math.abs(doubledArea) / 2;
}

function numericArrayLike(value: unknown): ArrayLike<unknown> | null {
  if (Array.isArray(value)) return value;
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return value as unknown as ArrayLike<unknown>;
  }
  return null;
}

function rasterMetrics(
  operatorList: OperatorListLike,
  ops: typeof import('pdfjs-dist/legacy/build/pdf.mjs').OPS,
  pageBox: PageBox,
): { hasRasterImage: boolean; coverage: number } {
  const singleImageOperators = new Set([
    ops.paintImageMaskXObject,
    ops.paintImageXObject,
    ops.paintInlineImageXObject,
  ]);
  const imageOperators = new Set([
    ops.paintImageMaskXObject,
    ops.paintImageXObject,
    ops.paintInlineImageXObject,
    ops.paintImageMaskXObjectGroup,
    ops.paintInlineImageXObjectGroup,
    ops.paintImageXObjectRepeat,
    ops.paintImageMaskXObjectRepeat,
  ]);

  const identity: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  let current = identity;
  let hasRasterImage = false;
  let paintedArea = 0;

  const addTransformedImage = (transform: unknown) => {
    const imageTransform = asMatrix(transform);
    if (!imageTransform) return;
    paintedArea += visibleUnitSquareArea(
      multiplyMatrices(current, imageTransform),
      pageBox,
    );
  };

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operator = operatorList.fnArray[index];
    const args = operatorList.argsArray[index] ?? [];

    if (operator === ops.save) {
      stack.push(current);
      continue;
    }
    if (operator === ops.restore) {
      current = stack.pop() ?? identity;
      continue;
    }
    if (operator === ops.paintFormXObjectBegin) {
      stack.push(current);
      const formTransform = asMatrix(args[0]);
      if (formTransform) current = multiplyMatrices(current, formTransform);
      continue;
    }
    if (operator === ops.paintFormXObjectEnd) {
      current = stack.pop() ?? identity;
      continue;
    }
    if (operator === ops.transform) {
      const transform = asMatrix(args);
      if (transform) current = multiplyMatrices(current, transform);
      continue;
    }
    if (!imageOperators.has(operator)) continue;

    hasRasterImage = true;
    if (singleImageOperators.has(operator)) {
      paintedArea += visibleUnitSquareArea(current, pageBox);
      continue;
    }

    if (operator === ops.paintImageXObjectRepeat) {
      const [, scaleX, scaleY, positions] = args;
      const positionValues = numericArrayLike(positions);
      if (
        typeof scaleX === 'number' &&
        typeof scaleY === 'number' &&
        positionValues
      ) {
        for (
          let position = 0;
          position + 1 < positionValues.length;
          position += 2
        ) {
          addTransformedImage([
            scaleX,
            0,
            0,
            scaleY,
            Number(positionValues[position]),
            Number(positionValues[position + 1]),
          ]);
        }
      }
      continue;
    }

    if (operator === ops.paintImageMaskXObjectRepeat) {
      const [, scaleX, skewX, skewY, scaleY, positions] = args;
      const positionValues = numericArrayLike(positions);
      if (
        [scaleX, skewX, skewY, scaleY].every(
          (value) => typeof value === 'number' && Number.isFinite(value),
        ) &&
        positionValues
      ) {
        for (
          let position = 0;
          position + 1 < positionValues.length;
          position += 2
        ) {
          addTransformedImage([
            Number(scaleX),
            Number(skewX),
            Number(skewY),
            Number(scaleY),
            Number(positionValues[position]),
            Number(positionValues[position + 1]),
          ]);
        }
      }
      continue;
    }

    const entries = operator === ops.paintInlineImageXObjectGroup
      ? args[1]
      : args[0];
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (entry && typeof entry === 'object' && 'transform' in entry) {
          addTransformedImage((entry as { transform?: unknown }).transform);
        }
      }
    }
  }

  return {
    hasRasterImage,
    coverage: Math.min(1, paintedArea / Math.max(1, pageBox.area)),
  };
}

function pageNeedsOcr(params: {
  substantiveCharacters: number;
  substantiveTextAreaRatio: number;
  hasRasterImage: boolean;
  rasterCoverage: number;
}): boolean {
  if (!params.hasRasterImage) return false;
  if (params.substantiveCharacters === 0) return true;

  return (
    params.rasterCoverage >= MIN_RASTER_PAGE_COVERAGE &&
    params.substantiveCharacters <= MAX_SPARSE_TEXT_CHARACTERS &&
    params.substantiveTextAreaRatio <= MAX_SPARSE_TEXT_AREA_RATIO
  );
}

function pageTextMetrics(
  items: readonly unknown[],
  pageArea: number,
): {
  displayedText: string;
  substantiveCharacters: number;
  substantiveTextAreaRatio: number;
} {
  const artifactScopes: boolean[] = [];
  const displayedText: string[] = [];
  let substantiveCharacters = 0;
  let substantiveTextArea = 0;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if ('type' in item) {
      const marker = item as { type?: unknown; tag?: unknown };
      if (
        marker.type === 'beginMarkedContent' ||
        marker.type === 'beginMarkedContentProps'
      ) {
        const parentIsArtifact = artifactScopes[artifactScopes.length - 1] ?? false;
        artifactScopes.push(parentIsArtifact || marker.tag === 'Artifact');
      } else if (marker.type === 'endMarkedContent') {
        artifactScopes.pop();
      }
      continue;
    }
    if (!('str' in item) || typeof item.str !== 'string') continue;

    displayedText.push(item.str);
    if (artifactScopes[artifactScopes.length - 1]) continue;

    substantiveCharacters += item.str.replace(/\s/g, '').length;
    const width = 'width' in item && typeof item.width === 'number' ? item.width : 0;
    const height = 'height' in item && typeof item.height === 'number' ? item.height : 0;
    substantiveTextArea += Math.abs(width * height);
  }

  return {
    displayedText: displayedText.join('\n').replace(/\s+\n/g, '\n'),
    substantiveCharacters,
    substantiveTextAreaRatio: Math.min(
      1,
      substantiveTextArea / Math.max(1, pageArea),
    ),
  };
}

export async function extractPdfTextBuffer(fileBuf: Buffer): Promise<PageText[]> {
  console.log('[extractPdfTextBuffer] Starting extraction, buffer size:', fileBuf.length);
  stubGraphicsIfNeeded();

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(fileBuf),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    standardFontDataUrl: getPdfJsStandardFontDataUrl(),
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });

  const doc = await loadingTask.promise;
  try {
    const total = doc.numPages;
    console.log('[extractPdfTextBuffer] PDF loaded, total pages:', total);
    const pages: PageText[] = [];

    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i);
      const [minX, minY, maxX, maxY] = page.view;
      const pageBox: PageBox = {
        minX,
        minY,
        maxX,
        maxY,
        area: Math.abs((maxX - minX) * (maxY - minY)),
      };
      const textContent = await page.getTextContent({ includeMarkedContent: true });
      const textMetrics = pageTextMetrics(textContent.items, pageBox.area);
      const sanitizedText = sanitizeExtractedText(textMetrics.displayedText);
      const inspectRaster =
        textMetrics.substantiveCharacters <= MAX_SPARSE_TEXT_CHARACTERS;
      const raster = inspectRaster
        ? rasterMetrics(await page.getOperatorList(), pdfjs.OPS, pageBox)
        : { hasRasterImage: false, coverage: 0 };
      const needsOcr = pageNeedsOcr({
        substantiveCharacters: textMetrics.substantiveCharacters,
        substantiveTextAreaRatio: textMetrics.substantiveTextAreaRatio,
        hasRasterImage: raster.hasRasterImage,
        rasterCoverage: raster.coverage,
      });
      if (needsOcr) {
        console.log(
          `[extractPdfTextBuffer] Page ${i} requires OCR: substantiveCharacters=${textMetrics.substantiveCharacters}, textArea=${textMetrics.substantiveTextAreaRatio.toFixed(4)}, rasterCoverage=${raster.coverage.toFixed(4)}`,
        );
      }
      pages.push({
        pageNumber: i,
        text: sanitizedText,
        needsOcr,
        requiresRecoveredScanText:
          needsOcr &&
          Boolean(sanitizedText) &&
          textMetrics.substantiveCharacters === 0,
      });
    }

    const repeatedSparseText = new Map<string, number>();
    for (const page of pages) {
      if (!page.needsOcr || !page.text) continue;
      repeatedSparseText.set(
        page.text,
        (repeatedSparseText.get(page.text) ?? 0) + 1,
      );
    }
    for (const page of pages) {
      if ((repeatedSparseText.get(page.text) ?? 0) > 1) {
        page.requiresRecoveredScanText = true;
      }
    }

    return pages;
  } finally {
    await doc.destroy();
  }
}

export async function extractAllPages(inputPath: string): Promise<PageRecord[]> {
  console.log('[extractAllPages] Reading file:', inputPath);
  const data = await fs.readFile(inputPath);
  console.log('[extractAllPages] File read successfully, size:', data.length);
  const pageTexts = await extractPdfTextBuffer(data);
  console.log('[extractAllPages] Extracted text from', pageTexts.length, 'pages');
  
  return pageTexts.map(({
    pageNumber,
    text,
    needsOcr,
    requiresRecoveredScanText,
  }) => {
    console.log(`[extractAllPages] Page ${pageNumber}: text length=${text.length}, needsOcr=${needsOcr}`);
    return {
      pageNumber,
      originalText: sanitizeExtractedText(text),
      translatedText: undefined,
      needsOcr,
      requiresRecoveredScanText,
      status: 'pending' as const,
    };
  });
}

async function getOcrProcessEnvironment(): Promise<NodeJS.ProcessEnv | undefined> {
  if (ocrEnvironmentPromise) return ocrEnvironmentPromise;

  ocrEnvironmentPromise = (async () => {
    const candidates = (process.env.PDFX_OCR_BIN_PATHS || '')
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (process.platform === 'win32') {
      const programRoots = [
        process.env.ProgramFiles,
        process.env['ProgramFiles(x86)'],
        process.env.ProgramW6432,
      ];
      for (const programRoot of programRoots) {
        if (!programRoot) continue;
        candidates.push(path.join(programRoot, 'Tesseract-OCR'));
        const ghostscriptRoot = path.join(programRoot, 'gs');
        const versions = await fs.readdir(ghostscriptRoot, {
          withFileTypes: true,
        }).catch(() => []);
        for (const version of versions) {
          if (version.isDirectory()) {
            candidates.push(path.join(ghostscriptRoot, version.name, 'bin'));
          }
        }
      }
    }

    const existing: string[] = [];
    for (const candidate of candidates) {
      if (existing.includes(candidate)) continue;
      if (await fs.access(candidate).then(() => true).catch(() => false)) {
        existing.push(candidate);
      }
    }
    if (existing.length === 0) return undefined;

    const environment: NodeJS.ProcessEnv = { ...process.env };
    const currentPathEntry = Object.entries(environment).find(
      ([key]) => key.toLowerCase() === 'path',
    );
    for (const key of Object.keys(environment)) {
      if (key.toLowerCase() === 'path') delete environment[key];
    }
    environment.PATH = [
      ...existing,
      currentPathEntry?.[1] || '',
    ].filter(Boolean).join(path.delimiter);
    return environment;
  })();

  return ocrEnvironmentPromise;
}

/**
 * OCR a single page to text using the worker image's OCRmyPDF toolchain.
 * The production contract is `ocrmypdf` + English, Arabic, Uzbek Cyrillic, and
 * orientation Tesseract data. OCRmyPDF supplies qpdf, Ghostscript, and
 * Tesseract on Alpine.
 */
export async function ocrPageToText(
  inputPath: string,
  pageNumber: number,
  workDir: string
): Promise<string> {
  const singlePdf = path.join(workDir, `page_${pageNumber}.pdf`);
  const sidecarTxt = path.join(workDir, `page_${pageNumber}.txt`);
  const ocrPdf = path.join(workDir, `ocr_${pageNumber}.pdf`);

  const ocrLanguages = process.env.PDFX_OCR_LANGUAGES?.trim() || DEFAULT_OCR_LANGUAGES;
  if (!/^[a-z0-9_+.-]+$/i.test(ocrLanguages)) {
    throw new Error('PDFX_OCR_LANGUAGES contains an invalid Tesseract language list');
  }
  const ocrEnvironment = await getOcrProcessEnvironment();
  const execa = await loadExeca();

  try {
    await execa('qpdf', ['--empty', '--pages', inputPath, String(pageNumber), '--', singlePdf], {
      windowsHide: true,
      env: ocrEnvironment,
    });
  } catch (qpdfError) {
    // Docker's OCRmyPDF package supplies qpdf. The pdf-lib fallback keeps
    // non-Docker workers functional when only OCRmyPDF/Tesseract are on PATH.
    try {
      const { PDFDocument } = await import('pdf-lib');
      const source = await PDFDocument.load(await fs.readFile(inputPath), {
        updateMetadata: false,
      });
      if (pageNumber < 1 || pageNumber > source.getPageCount()) {
        throw new Error(`Source page ${pageNumber} is outside the PDF page range`);
      }
      const singlePageDocument = await PDFDocument.create();
      const [copiedPage] = await singlePageDocument.copyPages(source, [pageNumber - 1]);
      singlePageDocument.addPage(copiedPage);
      await fs.writeFile(singlePdf, await singlePageDocument.save());
      console.warn(
        `[ocrPageToText] qpdf was unavailable for page ${pageNumber}; used the pdf-lib page splitter`,
      );
    } catch (pdfLibError) {
      throw new Error(`OCR could not prepare source page ${pageNumber}`, {
        cause: new AggregateError([qpdfError, pdfLibError]),
      });
    }
  }

  try {
    await execa('ocrmypdf', [
      '--sidecar',
      sidecarTxt,
      '--jobs',
      '1',
      '-l',
      ocrLanguages,
      '--rotate-pages',
      '--deskew',
      '--oversample',
      '300',
      '--force-ocr',
      singlePdf,
      ocrPdf,
    ], { windowsHide: true, env: ocrEnvironment });
  } catch (error) {
    throw new Error(
      `OCR failed for source page ${pageNumber}; verify OCRmyPDF and the ${ocrLanguages} Tesseract data packs are installed`,
      { cause: error },
    );
  }

  return sanitizeOcrExtractedText(await fs.readFile(sidecarTxt, 'utf8'));
}

/** Keep a clean embedded layer unless OCR found materially more page content. */
export function selectBestPageText(embeddedText: string, ocrText: string): string {
  const embedded = sanitizeExtractedText(embeddedText);
  const ocr = sanitizeOcrExtractedText(ocrText);
  if (!embedded) return ocr;
  if (!ocr) return embedded;

  const embeddedCharacters = embedded.replace(/\s/g, '').length;
  const ocrCharacters = ocr.replace(/\s/g, '').length;
  const minimumGain = Math.max(12, Math.ceil(embeddedCharacters * 0.25));
  return ocrCharacters >= embeddedCharacters + minimumGain ? ocr : embedded;
}
