import { describe, expect, it } from 'vitest';
import {
  fitLayoutFontSize,
  normalizedBox,
  resolvePageSize,
} from '../layout-geometry';
import type { StoredPdfPageLayout } from '@/lib/pdfx-v2/schemas';

function layout(overrides: Partial<StoredPdfPageLayout> = {}): StoredPdfPageLayout {
  return {
    pageNumber: 1,
    width: 1000,
    height: 1000,
    orientation: 'portrait',
    sourceLanguage: 'Uzbek',
    sourceScript: 'Latin',
    elements: [],
    warnings: [],
    ...overrides,
  };
}

describe('PDF positioned text geometry', () => {
  it('maps normalized model coordinates onto physical PDF page dimensions', () => {
    expect(normalizedBox([100, 250, 900, 750], 600, 840)).toEqual({
      x: 60,
      y: 210,
      width: 480,
      height: 420,
    });
  });

  it('uses worker-recorded physical dimensions and a safe A4 fallback', () => {
    expect(resolvePageSize(layout({ pageWidthPoints: 612, pageHeightPoints: 792 }))).toEqual({
      width: 612,
      height: 792,
    });
    expect(resolvePageSize(layout({ orientation: 'landscape' }))).toEqual({
      width: 841.89,
      height: 595.28,
    });
  });

  it('shrinks long text to remain inside its source bounding box', () => {
    const short = fitLayoutFontSize('Short heading', { x: 0, y: 0, width: 300, height: 40 }, 18);
    const long = fitLayoutFontSize(
      'A much longer translated heading that must wrap across several visible lines',
      { x: 0, y: 0, width: 120, height: 40 },
      18,
    );
    expect(short).toBeGreaterThan(long);
    expect(long).toBeGreaterThanOrEqual(3.2);
  });
});
