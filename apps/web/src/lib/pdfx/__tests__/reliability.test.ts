import {
  beginMarkedContent,
  endMarkedContent,
  PDFDocument,
  StandardFonts,
} from 'pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  extractPdfTextBuffer,
  ocrPageToText,
  sanitizeExtractedText,
  sanitizeOcrExtractedText,
  selectBestPageText,
} from '@/lib/pdfx/extract';
import {
  chunkTextForTranslation,
  translatePage,
  TranslationIncompleteError,
} from '@/lib/pdfx/translate';
import {
  makeTranslatedPdf,
  prepareRtlLineForPdf,
} from '@/lib/pdfx/makeTranslatedPdf';

const START = '[[PDFX_TRANSLATION_START]]';
const END = '[[PDFX_TRANSLATION_END]]';
const execaMock = vi.hoisted(() => vi.fn());

vi.mock('execa', () => ({ execa: execaMock }));

describe('PDF translation reliability', () => {
  it('extracts in Node without assigning an invalid PDF.js workerSrc', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage();
    page.drawText('Reliable PDF extraction', { x: 40, y: 700, font });

    const extracted = await extractPdfTextBuffer(Buffer.from(await pdf.save()));

    expect(extracted).toHaveLength(1);
    expect(extracted[0].text).toContain('Reliable PDF extraction');
    expect(extracted[0].needsOcr).toBe(false);
  });

  it('does not OCR short text pages unless they contain raster image content', async () => {
    const textPdf = await PDFDocument.create();
    const font = await textPdf.embedFont(StandardFonts.Helvetica);
    textPdf.addPage().drawText('Cover', { x: 40, y: 700, font });

    const scannedPdf = await PDFDocument.create();
    const pixel = await scannedPdf.embedPng(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lqj0WQAAAABJRU5ErkJggg==',
        'base64',
      ),
    );
    scannedPdf.addPage().drawImage(pixel, { x: 40, y: 600, width: 100, height: 100 });

    const [textPage] = await extractPdfTextBuffer(Buffer.from(await textPdf.save()));
    const [imagePage] = await extractPdfTextBuffer(Buffer.from(await scannedPdf.save()));

    expect(textPage.needsOcr).toBe(false);
    expect(imagePage.needsOcr).toBe(true);
  });

  it('OCRs raster-dominant pages even when a sparse text overlay exceeds 20 characters', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pixel = await pdf.embedPng(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lqj0WQAAAABJRU5ErkJggg==',
        'base64',
      ),
    );
    const overlay = 'QMMB: 03/25/1073/0587-son 08.07.2025-y.';

    const artifactPage = pdf.addPage([595, 842]);
    artifactPage.drawImage(pixel, { x: 0, y: 0, width: 595, height: 842 });
    artifactPage.pushOperators(beginMarkedContent('Artifact'));
    artifactPage.drawText(overlay, { x: 28, y: 815, size: 10, font });
    artifactPage.pushOperators(endMarkedContent());

    const untaggedPage = pdf.addPage([595, 842]);
    untaggedPage.drawImage(pixel, { x: 0, y: 0, width: 595, height: 842 });
    untaggedPage.drawText(overlay, { x: 28, y: 815, size: 10, font });

    const extracted = await extractPdfTextBuffer(Buffer.from(await pdf.save()));

    expect(extracted).toHaveLength(2);
    expect(extracted[0].text).toContain('QMMB: 03/25/1073/0587-son');
    expect(extracted[0].needsOcr).toBe(true);
    expect(extracted[0].requiresRecoveredScanText).toBe(true);
    expect(extracted[1].needsOcr).toBe(true);
    expect(extracted[1].requiresRecoveredScanText).toBe(true);
  });

  it('does not OCR sparse native text with only a decorative raster image', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pixel = await pdf.embedPng(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lqj0WQAAAABJRU5ErkJggg==',
        'base64',
      ),
    );
    const page = pdf.addPage([595, 842]);
    page.drawText('A short native cover page with a small logo', {
      x: 40,
      y: 700,
      font,
    });
    page.drawImage(pixel, { x: 40, y: 560, width: 100, height: 100 });

    const [extracted] = await extractPdfTextBuffer(Buffer.from(await pdf.save()));

    expect(extracted.needsOcr).toBe(false);
  });

  it('keeps embedded text when OCR is empty or does not add material content', () => {
    expect(selectBestPageText('Clean embedded title', '')).toBe(
      'Clean embedded title',
    );
    expect(selectBestPageText('Clean embedded title', 'Noisy title')).toBe(
      'Clean embedded title',
    );
    expect(
      selectBestPageText(
        'QMMB: 03/25/1073/0587-son',
        'QMMB: 03/25/1073/0587-son\n' + 'Uzbek Cyrillic body text. '.repeat(20),
      ),
    ).toContain('Uzbek Cyrillic body text.');
  });

  it('removes isolated scan-margin glyphs before a numbered document header', () => {
    const noisy = [
      'Uo.',
      ')',
      'N',
      'м',
      'М',
      'wn',
      'QMMB: 03/25/1073/0587-son',
      '11',
      'Recovered body text',
    ].join('\n\n');

    expect(sanitizeOcrExtractedText(noisy)).toBe(
      'QMMB: 03/25/1073/0587-son\n\n11\n\nRecovered body text',
    );
    expect(
      sanitizeOcrExtractedText('A\n\nB\n\nC\n\nDate: 2025\n\nLegitimate content'),
    ).toBe('A\n\nB\n\nC\n\nDate: 2025\n\nLegitimate content');
  });

  it('falls back to pdf-lib page splitting and invokes the multilingual OCR contract', async () => {
    const parent = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(parent, { recursive: true });
    const directory = await fs.mkdtemp(path.join(parent, 'ocr-fallback-'));
    const inputPath = path.join(directory, 'source.pdf');

    try {
      const pdf = await PDFDocument.create();
      pdf.addPage();
      pdf.addPage();
      await fs.writeFile(inputPath, await pdf.save());
      execaMock.mockImplementation(async (command: string, args: string[]) => {
        if (command === 'qpdf') throw new Error('spawn qpdf ENOENT');
        if (command === 'ocrmypdf') {
          const sidecarIndex = args.indexOf('--sidecar');
          await fs.writeFile(args[sidecarIndex + 1], 'Recognized Uzbek Cyrillic text');
          return { exitCode: 0 };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      const text = await ocrPageToText(inputPath, 2, directory);
      const splitPdf = await PDFDocument.load(
        await fs.readFile(path.join(directory, 'page_2.pdf')),
      );
      const ocrCall = execaMock.mock.calls.find(([command]) => command === 'ocrmypdf');

      expect(text).toBe('Recognized Uzbek Cyrillic text');
      expect(splitPdf.getPageCount()).toBe(1);
      expect(ocrCall?.[1]).toEqual(
        expect.arrayContaining([
          '-l',
          'eng+ara+uzb_cyrl',
          '--rotate-pages',
          '--oversample',
          '300',
        ]),
      );
    } finally {
      execaMock.mockReset();
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('builds translated output under the ESM worker runtime', async () => {
    const parent = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(parent, { recursive: true });
    const directory = await fs.mkdtemp(path.join(parent, 'make-translated-'));
    const outputPath = path.join(directory, 'translated.pdf');

    try {
      const result = await makeTranslatedPdf(
        [{ pageNumber: 1, text: 'English text\nنص عربي\nРусский текст' }],
        outputPath,
        'Regression output',
      );
      const pdf = await PDFDocument.load(await fs.readFile(outputPath));

      expect(pdf.getPageCount()).toBe(1);
      expect(result.pageMap).toEqual([
        { sourcePageNumber: 1, outputPageNumbers: [1] },
      ]);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('preorders embedded LTR runs for Fontkit without reversing Arabic text', () => {
    expect(prepareRtlLineForPdf('السطر العربي 10: نص واضح')).toBe(
      'السطر العربي 01: نص واضح',
    );
  });

  it('removes unsafe controls while retaining Arabic and useful whitespace', () => {
    expect(sanitizeExtractedText('  Hello\u0000\u0007\r\nمرحبا\u2028world  ')).toBe(
      'Hello\nمرحبا\nworld',
    );
  });

  it('chunks long pages on readable boundaries', () => {
    const chunks = chunkTextForTranslation(
      `${'First paragraph. '.repeat(8)}\n\n${'Second paragraph. '.repeat(8)}`,
      80,
    );
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.some((chunk) => chunk.separatorAfter === '\n\n')).toBe(true);
    expect(chunks.every((chunk) => chunk.text.length <= 80)).toBe(true);
  });

  it('splits and retries a chunk when the model reports token truncation', async () => {
    const request = vi.fn(async (source: string) =>
      source.length > 500
        ? { text: 'partial', finishReason: 'length' }
        : { text: `${START}${source.toUpperCase()}${END}`, finishReason: 'stop' },
    );
    const source = 'translation sentence. '.repeat(55);

    const translated = await translatePage(source, 'Arabic', {
      maxChunkCharacters: 2_000,
      request,
      attemptsPerChunk: 1,
    });

    expect(request.mock.calls.length).toBeGreaterThan(1);
    expect(translated).toContain('TRANSLATION SENTENCE.');
    expect(translated).not.toContain('partial');
  });

  it('rejects a short truncated response instead of silently accepting it', async () => {
    await expect(
      translatePage('Short source text', 'English', {
        request: async () => ({ text: 'partial', finishReason: 'length' }),
        attemptsPerChunk: 1,
      }),
    ).rejects.toBeInstanceOf(TranslationIncompleteError);
  });
});
