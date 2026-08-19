import { describe, expect, it, vi } from 'vitest';
import type { PdfPageLayout, PdfPageTranslation } from '../schemas';
import type { PdfxV2OpenAiRequester } from '../openai';
import { extractPageWithOpenAi, translatePageWithOpenAi } from '../openai';

function sourcePage(): PdfPageLayout {
  return {
    pageNumber: 5,
    width: 1000,
    height: 1400,
    orientation: 'portrait',
    sourceLanguage: 'Uzbek',
    sourceScript: 'Cyrillic',
    warnings: [],
    elements: [{
      id: 'e001', kind: 'paragraph', order: 0, level: 0,
      text: 'Ушбу қарор 2026 йилда кучга киради.', bbox: [50, 50, 950, 200],
      columnCount: 0, rowCount: 0, rows: [],
    }],
  };
}

const context = {
  sourceLanguage: 'Uzbek', targetLanguage: 'Russian', documentType: 'Resolution',
  summary: 'Legal resolution', preserveTerms: [], terminology: [],
};

function provider<T>(value: T, model: string) {
  return { value, model, inputTokens: 10, outputTokens: 20, responseId: `${model}-response` };
}

function requester(overrides: Partial<PdfxV2OpenAiRequester>): PdfxV2OpenAiRequester {
  return {
    extract: vi.fn(async () => provider(sourcePage(), 'extract')),
    context: vi.fn(async () => provider(context, 'context')),
    translate: vi.fn(async () => provider({ pageNumber: 5, elements: [], warnings: [] }, 'translate')),
    validate: vi.fn(async () => provider({
      pageNumber: 5,
      complete: true,
      meaningPreserved: true,
      targetLanguageSatisfied: true,
      tableStructurePreserved: true,
      failures: [],
      warnings: [],
    }, 'review')),
    ...overrides,
  };
}

describe('PDF Translator OpenAI retry ladder', () => {
  it('re-prompts after an incomplete extraction and accepts the corrected page', async () => {
    const extract = vi.fn()
      .mockResolvedValueOnce(provider({ ...sourcePage(), pageNumber: 4 }, 'primary'))
      .mockResolvedValueOnce(provider(sourcePage(), 'primary'));
    const result = await extractPageWithOpenAi(Buffer.from('%PDF'), 5, requester({ extract }));
    expect(result.attempts).toBe(2);
    expect(extract).toHaveBeenCalledTimes(2);
    expect(extract.mock.calls[1][0].validationFailure).toMatch(/page 4/i);
  });

  it('retries a page that remains in Uzbek instead of accepting it as Russian', async () => {
    const source = sourcePage();
    const untranslated: PdfPageTranslation = {
      pageNumber: 5,
      warnings: [],
      elements: [{ id: 'e001', text: source.elements[0].text, cells: [] }],
    };
    const translated: PdfPageTranslation = {
      pageNumber: 5,
      warnings: [],
      elements: [{ id: 'e001', text: 'Настоящее постановление вступает в силу в 2026 году.', cells: [] }],
    };
    const translate = vi.fn()
      .mockResolvedValueOnce(provider(untranslated, 'primary'))
      .mockResolvedValueOnce(provider(translated, 'primary'));
    const result = await translatePageWithOpenAi(source, context, 'Russian', requester({ translate }));
    expect(result.attempts).toBe(2);
    expect(result.translation.elements[0].text).toContain('постановление');
    expect(translate.mock.calls[1][0].validationFailure).toBeTruthy();
  });

  it('stops after one permanent provider error instead of multiplying calls', async () => {
    const failure = Object.assign(new Error('Model access denied'), { status: 403 });
    const extract = vi.fn().mockRejectedValue(failure);
    await expect(extractPageWithOpenAi(Buffer.from('%PDF'), 5, requester({ extract })))
      .rejects.toThrow(/could not extract/i);
    expect(extract).toHaveBeenCalledTimes(1);
  });

  it('retries when the independent semantic reviewer rejects a fluent but incorrect page', async () => {
    const source = sourcePage();
    const first = {
      pageNumber: 5,
      warnings: [],
      elements: [{ id: 'e001', text: 'Постановление отменено в 2026 году.', cells: [] }],
    };
    const corrected = {
      pageNumber: 5,
      warnings: [],
      elements: [{ id: 'e001', text: 'Настоящее постановление вступает в силу в 2026 году.', cells: [] }],
    };
    const translate = vi.fn()
      .mockResolvedValueOnce(provider(first, 'primary'))
      .mockResolvedValueOnce(provider(corrected, 'primary'));
    const validate = vi.fn()
      .mockResolvedValueOnce(provider({
        pageNumber: 5, complete: true, meaningPreserved: false,
        targetLanguageSatisfied: true, tableStructurePreserved: true,
        failures: ['The legal effect was reversed.'], warnings: [],
      }, 'review'))
      .mockResolvedValueOnce(provider({
        pageNumber: 5, complete: true, meaningPreserved: true,
        targetLanguageSatisfied: true, tableStructurePreserved: true,
        failures: [], warnings: [],
      }, 'review'));
    const result = await translatePageWithOpenAi(
      source, context, 'Russian', requester({ translate, validate }),
    );
    expect(result.attempts).toBe(2);
    expect(translate.mock.calls[1][0].validationFailure).toMatch(/legal effect was reversed/i);
    expect(validate).toHaveBeenCalledTimes(2);
  });
});
