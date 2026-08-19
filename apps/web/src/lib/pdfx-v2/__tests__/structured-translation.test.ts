import { describe, expect, it } from 'vitest';
import type { PdfPageLayout, PdfPageTranslation } from '../schemas';
import {
  mergePageTranslation,
  pageLayoutForTranslation,
  pageLayoutToPlainText,
} from '../serialize';
import { validateExtractedPage, validateTranslatedPage } from '../validation';

function wideTable(): PdfPageLayout {
  return {
    pageNumber: 16,
    width: 1000,
    height: 700,
    orientation: 'landscape',
    sourceLanguage: 'Uzbek',
    sourceScript: 'Cyrillic',
    warnings: [],
    elements: [{
      id: 'e001',
      kind: 'table',
      order: 0,
      level: 0,
      text: '1-ilova',
      bbox: [10, 20, 990, 680],
      columnCount: 14,
      rowCount: 2,
      rows: Array.from({ length: 2 }, (_, rowIndex) => ({
        rowIndex,
        cells: Array.from({ length: 14 }, (_, columnIndex) => ({
          id: `e001-r${rowIndex}-c${columnIndex}`,
          rowIndex,
          columnIndex,
          rowSpan: 1,
          columnSpan: 1,
          isHeader: rowIndex === 0,
          text: rowIndex === 0 ? `Устун ${columnIndex + 1}` : String(columnIndex + 100),
          bbox: [columnIndex * 70, rowIndex * 100, columnIndex * 70 + 65, rowIndex * 100 + 90],
        })),
      })),
    }],
  };
}

function translatedTable(source: PdfPageLayout): PdfPageTranslation {
  const table = source.elements[0];
  return {
    pageNumber: source.pageNumber,
    warnings: [],
    elements: [{
      id: table.id,
      text: 'Приложение 1',
      cells: table.rows.flatMap((row) => row.cells.map((cell) => ({
        id: cell.id,
        text: cell.rowIndex === 0 ? `Колонка ${cell.columnIndex + 1}` : cell.text,
      }))),
    }],
  };
}

describe('PDF Translator structured page contract', () => {
  it('retains every column of a 14-column page table as TSV', () => {
    const layout = wideTable();
    const lines = pageLayoutToPlainText(layout).split('\n');
    expect(lines[1].split('\t')).toHaveLength(14);
    expect(lines[2].split('\t')).toHaveLength(14);
    expect(validateExtractedPage(layout, 16)).toEqual({ valid: true, failures: [], warnings: [] });
  });

  it('sends stable element and cell IDs to translation', () => {
    const source = wideTable();
    expect(pageLayoutForTranslation(source)).toMatchObject({
      pageNumber: 16,
      elements: [{
        id: 'e001',
        kind: 'table',
        cells: expect.arrayContaining([{ id: 'e001-r1-c13', text: '113' }]),
      }],
    });
  });

  it('rejects a response that silently drops one table cell', () => {
    const source = wideTable();
    const translation = translatedTable(source);
    translation.elements[0].cells.pop();
    const result = validateTranslatedPage(source, translation, 'Russian');
    expect(result.valid).toBe(false);
    expect(result.failures.join(' ')).toMatch(/cell IDs|cell count/i);
  });

  it('rejects an extracted table that omits a visual grid position', () => {
    const source = wideTable();
    source.elements[0].rows[1].cells.splice(6, 1);
    const result = validateExtractedPage(source, 16);
    expect(result.valid).toBe(false);
    expect(result.failures.join(' ')).toMatch(/missing 1 grid position/i);
  });

  it('merges a valid translation without changing source table geometry', () => {
    const source = wideTable();
    const translation = translatedTable(source);
    const result = validateTranslatedPage(source, translation, 'Russian');
    expect(result.valid).toBe(true);
    const merged = mergePageTranslation(source, translation);
    expect(merged.elements[0].columnCount).toBe(14);
    expect(merged.elements[0].rows[1].cells[13]).toMatchObject({
      id: 'e001-r1-c13',
      text: '113',
      columnIndex: 13,
    });
  });
});
