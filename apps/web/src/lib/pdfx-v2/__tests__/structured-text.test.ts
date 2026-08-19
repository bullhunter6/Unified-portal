import { describe, expect, it } from 'vitest';

import {
  estimateTableColumnWidths,
  segmentPdfText,
} from '@/lib/pdfx-v2/structured-text';

describe('segmentPdfText', () => {
  it('keeps ordinary page text and its line endings unchanged', () => {
    const text = 'First paragraph\r\n\r\nSecond paragraph\r\n';

    expect(segmentPdfText(text)).toEqual([{ kind: 'text', text }]);
  });

  it('turns consecutive tab-delimited rows into a padded table', () => {
    const text = 'Показатель\t2024\t2025\nВыручка\t100\t125\nРасходы\t75';

    expect(segmentPdfText(text)).toEqual([
      {
        kind: 'table',
        columnCount: 3,
        raw: text,
        rows: [
          ['Показатель', '2024', '2025'],
          ['Выручка', '100', '125'],
          ['Расходы', '75', ''],
        ],
      },
    ]);
  });

  it('preserves the prose before and after a detected table', () => {
    const text = 'Summary\nName\tValue\nCarbon\t12\nNotes follow.';

    expect(segmentPdfText(text)).toEqual([
      { kind: 'text', text: 'Summary\n' },
      {
        kind: 'table',
        columnCount: 2,
        raw: 'Name\tValue\nCarbon\t12\n',
        rows: [
          ['Name', 'Value'],
          ['Carbon', '12'],
        ],
      },
      { kind: 'text', text: 'Notes follow.' },
    ]);
  });

  it('keeps a table together across blank row spacers', () => {
    const text = 'Name\tValue\n\nCarbon emissions\t12\n\nEnergy use\t30\nNotes';

    expect(segmentPdfText(text)).toEqual([
      {
        kind: 'table',
        columnCount: 2,
        raw: 'Name\tValue\n\nCarbon emissions\t12\n\nEnergy use\t30\n',
        rows: [
          ['Name', 'Value'],
          ['Carbon emissions', '12'],
          ['Energy use', '30'],
        ],
      },
      { kind: 'text', text: 'Notes' },
    ]);
  });

  it('allocates more viewer width to descriptive columns than numeric columns', () => {
    const widths = estimateTableColumnWidths([
      ['A long descriptive disclosure name used by the source table', '2025', '10'],
      ['Another metric', '2024', '9'],
    ], 3);

    expect(widths).toHaveLength(3);
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThanOrEqual(8);
    expect(widths.every((width) => width <= 28)).toBe(true);
  });

  it('does not mistake a single tabbed prose line for a table', () => {
    const text = 'Section 1\tOverview\nThis remains ordinary text.';

    expect(segmentPdfText(text)).toEqual([{ kind: 'text', text }]);
  });

  it('does not mistake tab-indented lines with only one value for a table', () => {
    const text = '\tFirst item\n\tSecond item';

    expect(segmentPdfText(text)).toEqual([{ kind: 'text', text }]);
  });
});
