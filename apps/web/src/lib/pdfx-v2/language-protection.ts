import type { PdfPageLayout } from './schemas';

const ENGLISH_CUES = new Set([
  'a', 'about', 'and', 'approved', 'are', 'as', 'at', 'be', 'by', 'company',
  'complaint', 'confidential', 'definition', 'document', 'employee', 'employees',
  'for', 'from', 'grievance', 'handling', 'in', 'is', 'may', 'must', 'of', 'on',
  'policy', 'procedure', 'purpose', 'shall', 'source', 'the', 'this', 'to',
  'version', 'with', 'without',
]);

const UZBEK_LATIN_CUES = new Set([
  'amalga', 'bilan', 'bo‘yicha', "bo'yicha", 'bu', 'ham', 'hujjat', 'jamiyat',
  'mazkur', 'murojaat', 'qilish', 'shikoyat', 'uchun', 'ushbu', 'va', 'xodim',
]);

function latinWords(text: string): string[] {
  return (text.toLocaleLowerCase().match(/[a-z]+(?:['’‘`][a-z]+)?/g) ?? []);
}

/** Conservative deterministic backstop for the model's language routing.
 * It only protects text that is clearly English; ambiguous Uzbek Latin remains
 * translatable so a false positive cannot silently skip source content. */
export function looksDefinitelyEnglish(text: string): boolean {
  if (/[Ѐ-ӿ؀-ۿ]/.test(text)) return false;
  const words = latinWords(text);
  if (words.length === 0) return false;
  const english = words.filter((word) => ENGLISH_CUES.has(word)).length;
  const uzbek = words.filter((word) => UZBEK_LATIN_CUES.has(word)).length;
  if (uzbek >= english && uzbek > 0) return false;
  return english >= 2 || (english === 1 && words.length <= 4);
}

export function enforceEnglishProtection(layout: PdfPageLayout): PdfPageLayout {
  return {
    ...layout,
    elements: layout.elements.map((element) => {
      if (element.kind === 'table') {
        const rows = element.rows.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => ({
            ...cell,
            translate: cell.translate && !looksDefinitelyEnglish(cell.text),
          })),
        }));
        return {
          ...element,
          rows,
          translate: rows.some((row) =>
            row.cells.some((cell) => cell.translate && cell.text.trim()),
          ),
        };
      }
      if (['image', 'stamp', 'signature', 'other', 'page_number', 'suppressed_text']
        .includes(element.kind)) {
        return { ...element, translate: false };
      }
      return {
        ...element,
        translate: element.translate && !looksDefinitelyEnglish(element.text),
      };
    }),
  };
}
