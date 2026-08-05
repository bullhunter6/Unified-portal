import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import bidiFactory from 'bidi-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SourcePageMapping, TranslatedPdfResult } from './types';

type PageBlock = { pageNumber: number; text: string };

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;
const ARABIC_CHARACTER = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/g;
const bidi = bidiFactory();

export function normalizePdfText(input: string): string {
  return (input ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/[\ufdd0-\ufdef\ufffe\uffff]/g, '')
    .replace(/[^\S\n]+$/gm, '')
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

function drawHeader(
  page: PDFPage,
  sourcePageNumber: number,
  continuation: boolean,
  font: PDFFont,
): number {
  const label = continuation
    ? `Source page ${sourcePageNumber} (continued)`
    : `Source page ${sourcePageNumber}`;
  page.drawText(label, {
    x: MARGIN,
    y: A4.h - MARGIN,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  return A4.h - MARGIN - 18;
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
  const fontSize = 11;
  const lineGap = 4;
  const usableWidth = A4.w - MARGIN * 2;
  const pageMap: SourcePageMapping[] = [];

  for (const source of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    const mapping: SourcePageMapping = {
      sourcePageNumber: source.pageNumber,
      outputPageNumbers: [],
    };
    pageMap.push(mapping);

    let outputPage = pdf.addPage([A4.w, A4.h]);
    mapping.outputPageNumbers.push(pdf.getPageCount());
    let y = drawHeader(outputPage, source.pageNumber, false, font);
    const safeText = normalizePdfText(source.text || '') || '[No translated text]';
    const lines = wrapLines(safeText, usableWidth, font, fontSize);

    for (const line of lines) {
      if (y < MARGIN + fontSize) {
        outputPage = pdf.addPage([A4.w, A4.h]);
        mapping.outputPageNumbers.push(pdf.getPageCount());
        y = drawHeader(outputPage, source.pageNumber, true, font);
      }
      if (!line) {
        y -= fontSize + lineGap;
        continue;
      }

      const rtl = isRtlLine(line);
      const renderedLine = rtl ? prepareRtlLineForPdf(line) : line;
      const lineWidth = font.widthOfTextAtSize(renderedLine, fontSize);
      const x = rtl
        ? Math.max(MARGIN, A4.w - MARGIN - lineWidth)
        : MARGIN;
      outputPage.drawText(renderedLine, { x, y, size: fontSize, font });
      y -= fontSize + lineGap;
    }
  }

  const bytes = await pdf.save();
  await fs.writeFile(outPath, Buffer.from(bytes));
  return { outputPath: outPath, pageMap };
}
