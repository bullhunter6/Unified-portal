import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import bidiFactory from 'bidi-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { segmentPdfText } from './structured-text';
import type { SourcePageMapping, TranslatedPdfResult } from './types';

type PageBlock = { pageNumber: number; text: string };

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;
const TABLE_CELL_PADDING = 4;
const TABLE_BORDER_WIDTH = 0.65;
const ARABIC_CHARACTER = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/g;
const bidi = bidiFactory();

export function normalizePdfText(input: string): string {
  return (input ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/[\ufdd0-\ufdef\ufffe\uffff]/g, '')
    .replace(/[^\S\n\t]+$/gm, '')
    .normalize('NFC');
}

function isRtlLine(text: string): boolean {
  ARABIC_CHARACTER.lastIndex = 0;
  return ARABIC_CHARACTER.test(text);
}

/**
 * Fontkit shapes an Arabic line as one RTL run and reverses every glyph in it,
 * including embedded LTR runs such as Western digits. Preorder the logical text
 * with the Unicode bidi algorithm so Fontkit's final reversal yields the proper
 * visual order without turning `10` into `01`.
 */
export function prepareRtlLineForPdf(text: string): string {
  const embedding = bidi.getEmbeddingLevels(text, 'rtl');
  const characters = text.split('');

  bidi.getMirroredCharactersMap(text, embedding).forEach((replacement, index) => {
    characters[index] = replacement;
  });
  for (const [start, end] of bidi.getReorderSegments(text, embedding)) {
    for (let left = start, right = end; left < right; left += 1, right -= 1) {
      const character = characters[left];
      characters[left] = characters[right];
      characters[right] = character;
    }
  }

  return Array.from(characters.join('')).reverse().join('');
}

function wrapLogicalLine(
  logicalLine: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
): string[] {
  if (!logicalLine.trim()) return [''];
  const output: string[] = [];
  const words = logicalLine.trim().split(/\s+/g);
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) output.push(line);
    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      line = word;
      continue;
    }

    let fragment = '';
    for (const character of Array.from(word)) {
      const candidateFragment = fragment + character;
      if (
        fragment &&
        font.widthOfTextAtSize(candidateFragment, fontSize) > maxWidth
      ) {
        output.push(fragment);
        fragment = character;
      } else {
        fragment = candidateFragment;
      }
    }
    line = fragment;
  }
  if (line) output.push(line);
  return output;
}

export function wrapLines(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
): string[] {
  return normalizePdfText(text)
    .split('\n')
    .flatMap((line) => wrapLogicalLine(line, maxWidth, font, fontSize));
}

function measureTableColumnWidths(
  rows: readonly string[][],
  columnCount: number,
  usableWidth: number,
  font: PDFFont,
  fontSize: number,
): number[] {
  const equalWidth = usableWidth / columnCount;
  const minimumWidth = Math.min(52, equalWidth);
  const preferred = Array.from({ length: columnCount }, (_, columnIndex) => {
    let width = minimumWidth;
    for (const row of rows) {
      width = Math.max(
        width,
        font.widthOfTextAtSize(normalizePdfText(row[columnIndex] || ''), fontSize) +
          TABLE_CELL_PADDING * 2,
      );
    }
    return Math.min(width, usableWidth * 0.65);
  });

  const reserved = minimumWidth * columnCount;
  const distributable = Math.max(0, usableWidth - reserved);
  const desiredExtra = preferred.map((width) => Math.max(0, width - minimumWidth));
  const totalExtra = desiredExtra.reduce((sum, width) => sum + width, 0);
  if (totalExtra === 0) return Array(columnCount).fill(equalWidth);

  return desiredExtra.map(
    (extra) => minimumWidth + distributable * (extra / totalExtra),
  );
}

function drawPdfLine(
  page: PDFPage,
  line: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
): void {
  if (!line) return;
  const rtl = isRtlLine(line);
  const renderedLine = rtl ? prepareRtlLineForPdf(line) : line;
  const lineWidth = font.widthOfTextAtSize(renderedLine, fontSize);
  page.drawText(renderedLine, {
    x: rtl ? Math.max(x, x + maxWidth - lineWidth) : x,
    y,
    size: fontSize,
    font,
  });
}

function drawHeader(
  page: PDFPage,
  sourcePageNumber: number,
  continuation: boolean,
  font: PDFFont,
  pageHeight: number,
  margin: number,
): number {
  const label = continuation
    ? `Source page ${sourcePageNumber} (continued)`
    : `Source page ${sourcePageNumber}`;
  page.drawText(label, {
    x: margin,
    y: pageHeight - margin,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  return pageHeight - margin - 18;
}

async function resolveFontPath(): Promise<string> {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf'),
    path.resolve(process.cwd(), 'apps', 'web', 'public', 'fonts', 'DejaVuSans.ttf'),
    path.resolve(moduleDirectory, '../../../public/fonts/DejaVuSans.ttf'),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue to the next known application layout.
    }
  }
  throw new Error('PDF translation font DejaVuSans.ttf is missing');
}

export async function makeTranslatedPdf(
  pages: PageBlock[],
  outPath: string,
  title = 'Translated Document',
): Promise<TranslatedPdfResult> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const fontBytes = await fs.readFile(await resolveFontPath());
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(title);
  pdf.setSubject('Text translation with explicit source-page mapping');

  const font = await pdf.embedFont(fontBytes, { subset: true });
  const lineGap = 4;
  const pageMap: SourcePageMapping[] = [];

  for (const source of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    const mapping: SourcePageMapping = {
      sourcePageNumber: source.pageNumber,
      outputPageNumbers: [],
    };
    pageMap.push(mapping);

    const safeText = normalizePdfText(source.text || '') || '[No translated text]';
    const segments = segmentPdfText(safeText);
    const maximumTableColumns = segments.reduce(
      (maximum, segment) => segment.kind === 'table'
        ? Math.max(maximum, segment.columnCount)
        : maximum,
      0,
    );
    const useLandscape = maximumTableColumns >= 6;
    const pageSize = useLandscape ? { w: A4.h, h: A4.w } : A4;
    const margin = useLandscape ? 30 : MARGIN;
    const proseFontSize = useLandscape ? 10 : 11;
    const proseLineHeight = proseFontSize + lineGap;
    const tableFontSize = useLandscape
      ? Math.max(6, 9 - Math.max(0, maximumTableColumns - 8) * 0.45)
      : proseFontSize;
    const tableLineHeight = tableFontSize + (useLandscape ? 2.5 : lineGap);
    const usableWidth = pageSize.w - margin * 2;

    let outputPage = pdf.addPage([pageSize.w, pageSize.h]);
    mapping.outputPageNumbers.push(pdf.getPageCount());
    let y = drawHeader(
      outputPage,
      source.pageNumber,
      false,
      font,
      pageSize.h,
      margin,
    );

    const addContinuationPage = () => {
      outputPage = pdf.addPage([pageSize.w, pageSize.h]);
      mapping.outputPageNumbers.push(pdf.getPageCount());
      y = drawHeader(
        outputPage,
        source.pageNumber,
        true,
        font,
        pageSize.h,
        margin,
      );
    };

    for (const segment of segments) {
      if (segment.kind === 'text') {
        const lines = wrapLines(segment.text, usableWidth, font, proseFontSize);
        for (const line of lines) {
          if (y < margin + proseFontSize) addContinuationPage();
          if (!line) {
            y -= proseLineHeight;
            continue;
          }

          drawPdfLine(
            outputPage,
            line,
            margin,
            y,
            usableWidth,
            font,
            proseFontSize,
          );
          y -= proseLineHeight;
        }
        continue;
      }

      const columnWidths = measureTableColumnWidths(
        segment.rows,
        segment.columnCount,
        usableWidth,
        font,
        tableFontSize,
      );
      const maximumFreshPageHeight =
        pageSize.h - margin - 18 - margin;

      for (const row of segment.rows) {
        const cellLines = row.map((cell, columnIndex) => {
          const wrapped = wrapLines(
            cell,
            Math.max(4, columnWidths[columnIndex] - TABLE_CELL_PADDING * 2),
            font,
            tableFontSize,
          );
          return wrapped.length > 0 ? wrapped : [''];
        });
        const totalLines = Math.max(...cellLines.map((lines) => lines.length), 1);
        const fullRowHeight = totalLines * tableLineHeight + TABLE_CELL_PADDING * 2;
        if (
          fullRowHeight <= maximumFreshPageHeight &&
          fullRowHeight > y - margin
        ) {
          addContinuationPage();
        }

        let lineOffset = 0;
        while (lineOffset < totalLines) {
          const availableHeight = y - margin;
          const availableLines = Math.floor(
            (availableHeight - TABLE_CELL_PADDING * 2) / tableLineHeight,
          );
          if (availableLines < 1) {
            addContinuationPage();
            continue;
          }

          const lineCount = Math.min(totalLines - lineOffset, availableLines);
          const rowHeight = lineCount * tableLineHeight + TABLE_CELL_PADDING * 2;
          let x = margin;
          for (let columnIndex = 0; columnIndex < segment.columnCount; columnIndex += 1) {
            const columnWidth = columnWidths[columnIndex];
            outputPage.drawRectangle({
              x,
              y: y - rowHeight,
              width: columnWidth,
              height: rowHeight,
              borderColor: rgb(0.35, 0.35, 0.35),
              borderWidth: TABLE_BORDER_WIDTH,
            });

            const renderedLines = cellLines[columnIndex].slice(
              lineOffset,
              lineOffset + lineCount,
            );
            for (let cellLineIndex = 0; cellLineIndex < renderedLines.length; cellLineIndex += 1) {
              drawPdfLine(
                outputPage,
                renderedLines[cellLineIndex],
                x + TABLE_CELL_PADDING,
                y - TABLE_CELL_PADDING - tableFontSize - cellLineIndex * tableLineHeight,
                columnWidth - TABLE_CELL_PADDING * 2,
                font,
                tableFontSize,
              );
            }
            x += columnWidth;
          }
          y -= rowHeight;
          lineOffset += lineCount;
          if (lineOffset < totalLines) addContinuationPage();
        }
      }
      // Prose is drawn from its baseline, so reserve a full line after the
      // table rather than only padding; this keeps glyph ascenders clear of
      // the final border on both the same page and a continuation page.
      y -= proseLineHeight;
    }
  }

  const bytes = await pdf.save();
  await fs.writeFile(outPath, Buffer.from(bytes));
  return { outputPath: outPath, pageMap };
}
