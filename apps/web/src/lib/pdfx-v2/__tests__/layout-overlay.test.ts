import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { makeTranslatedPdf } from '../makeTranslatedPdf';
import type { PdfPageLayout } from '../schemas';

describe('layout-preserving translated PDF renderer', () => {
  it('renders a clean UI-style layout page while retaining source dimensions', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pdfx-v2-overlay-test-'));
    try {
      const source = await PDFDocument.create();
      const sourcePage = source.addPage([600, 840]);
      sourcePage.drawRectangle({ x: 40, y: 760, width: 120, height: 35, color: rgb(0, 0.55, 0.2) });
      sourcePage.drawLine({ start: { x: 40, y: 500 }, end: { x: 560, y: 500 }, thickness: 1 });
      sourcePage.drawLine({ start: { x: 40, y: 420 }, end: { x: 560, y: 420 }, thickness: 1 });
      sourcePage.drawLine({ start: { x: 300, y: 420 }, end: { x: 300, y: 500 }, thickness: 1 });
      const sourceBytes = Buffer.from(await source.save());
      const outputPath = path.join(directory, 'translated.pdf');
      const layout: PdfPageLayout = {
        pageNumber: 1,
        width: 1000,
        height: 1000,
        orientation: 'portrait',
        sourceLanguage: 'Uzbek',
        sourceScript: 'Latin',
        warnings: [],
        elements: [
          {
            id: 'e001', kind: 'image', order: 0, level: 0, translate: false, text: '',
            bbox: [67, 54, 267, 96], columnCount: 0, rowCount: 0, rows: [],
          },
          {
            id: 'e002', kind: 'list', order: 1, level: 0, translate: true,
            text: '• Первый пункт\n• Второй пункт',
            bbox: [67, 150, 933, 300], columnCount: 0, rowCount: 0, rows: [],
          },
          {
            id: 'e003', kind: 'table', order: 2, level: 0, translate: true, text: '',
            bbox: [67, 405, 933, 500], columnCount: 2, rowCount: 1,
            rows: [{
              rowIndex: 0,
              cells: [
                {
                  id: 'e003-r0-c0', rowIndex: 0, columnIndex: 0,
                  rowSpan: 1, columnSpan: 1, isHeader: false, translate: true,
                  text: 'Описание', bbox: [67, 405, 500, 500],
                },
                {
                  id: 'e003-r0-c1', rowIndex: 0, columnIndex: 1,
                  rowSpan: 1, columnSpan: 1, isHeader: false, translate: true,
                  text: '125', bbox: [500, 405, 933, 500],
                },
              ],
            }],
          },
          {
            id: 'e004', kind: 'signature', order: 3, level: 0, translate: false, text: '',
            bbox: [650, 700, 900, 800], columnCount: 0, rowCount: 0, rows: [],
          },
        ],
      };

      const result = await makeTranslatedPdf([layout], sourceBytes, outputPath);
      const rendered = await PDFDocument.load(await fs.readFile(outputPath));
      expect(rendered.getPageCount()).toBe(1);
      expect(rendered.getSubject()).toBe('Clean geometry-preserving translated text layout');
      expect(rendered.getPage(0).getSize()).toEqual({ width: 600, height: 840 });
      expect(result.pageMap).toEqual([{ sourcePageNumber: 1, outputPageNumbers: [1] }]);
      expect((await fs.stat(outputPath)).size).toBeGreaterThan(1_000);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
