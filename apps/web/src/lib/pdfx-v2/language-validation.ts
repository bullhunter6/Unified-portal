function tabularRowShape(text: string): number[] {
  return text
    .split('\n')
    .filter((line) => line.includes('\t'))
    .map((line) => line.split('\t').length);
}

function normalizedWordBag(text: string): string[] {
  return (
    text
      .toLocaleLowerCase('ru')
      .replace(/[\u2018\u2019\u02bc`]/g, "'")
      .match(/[A-Za-z\u00c0-\u024f\u0400-\u052f]+(?:'[A-Za-z\u00c0-\u024f\u0400-\u052f]+)*/g) ?? []
  ).filter((word) => word.length >= 2);
}

const RUSSIAN_FUNCTION_WORDS = new Set([
  'без', 'был', 'была', 'были', 'быть', 'в', 'во', 'для', 'до', 'его', 'ее',
  'её', 'из', 'или', 'их', 'к', 'как', 'который', 'на', 'не', 'но', 'о', 'об',
  'от', 'по', 'при', 'с', 'со', 'что', 'это', 'этот',
]);

const UZBEK_OFFICIAL_NAME_WORDS = new Set([
  'ўзбекистон',
  'қорақалпоғистон',
]);

const UZBEK_CYRILLIC_CUE_WORDS = new Set([
  'амалга', 'белгиланади', 'белгиланган', 'билан', 'бундай', 'бўйича',
  'давлат', 'мазкур', 'мувофиқ', 'ошириш', 'соҳасида', 'тартиби',
  'томонидан', 'тўғрисида', 'уларнинг', 'унинг', 'учун', 'ушбу', 'ҳам',
  'ҳамда', 'қилиш', 'қилиши', 'қонун', 'қонуннинг',
]);

const UZBEK_LATIN_CUE_WORDS = new Set([
  'amalga', 'belgilanadi', 'belgilangan', 'bilan', 'boshqa', 'bunday',
  "bo'yicha", 'davlat', 'ham', 'hamda', 'mazkur', 'muvofiq', 'oshirish',
  'qilish', 'qilishi', 'qonun', 'qonunning', 'sohasida', 'tartibi',
  'tomonidan', "to'g'risida", 'ularning', 'uning', 'uchun', 'ushbu', 'va',
]);

function isUzbekCueWord(word: string): boolean {
  if (UZBEK_OFFICIAL_NAME_WORDS.has(word)) return false;
  return (
    /[ўқғҳ]/.test(word) ||
    UZBEK_CYRILLIC_CUE_WORDS.has(word) ||
    UZBEK_LATIN_CUE_WORDS.has(word)
  );
}

function multisetOverlap(left: readonly string[], right: readonly string[]): number {
  const rightCounts = new Map<string, number>();
  for (const word of right) rightCounts.set(word, (rightCounts.get(word) ?? 0) + 1);

  let overlap = 0;
  for (const word of left) {
    const remaining = rightCounts.get(word) ?? 0;
    if (remaining < 1) continue;
    overlap += 1;
    rightCounts.set(word, remaining - 1);
  }
  return overlap;
}

/** Return a retry reason when a syntactically complete answer lost structure or
 * is effectively untranslated; otherwise return null. */
export function validateTranslationResult(
  source: string,
  targetLang: string,
  translated: string,
): string | null {
  const sourceTableShape = tabularRowShape(source);
  if (sourceTableShape.length > 0) {
    const translatedTableShape = tabularRowShape(translated);
    if (translatedTableShape.length !== sourceTableShape.length) {
      return 'the translated table did not preserve its row count';
    }
    const changedRow = sourceTableShape.findIndex(
      (cellCount, index) => translatedTableShape[index] !== cellCount,
    );
    if (changedRow >= 0) {
      return `translated table row ${changedRow + 1} did not preserve its cell count`;
    }
  }

  if (targetLang.trim().toLowerCase() === 'russian') {
    const sourceWords = normalizedWordBag(source);
    const translatedWords = normalizedWordBag(translated);
    const sourceRussianFunctionWordRatio = sourceWords.filter(
      (word) => RUSSIAN_FUNCTION_WORDS.has(word),
    ).length / Math.max(1, sourceWords.length);
    const uzbekSpecificWords = sourceWords.filter(
      (word) => /[ўқғҳ]/.test(word) && !UZBEK_OFFICIAL_NAME_WORDS.has(word),
    );
    const sourceUzbekCueWords = sourceWords.filter(isUzbekCueWord);
    const uniqueUzbekCueWords = new Set(sourceUzbekCueWords).size;
    const sourceAppearsUzbek =
      sourceWords.length >= 12 &&
      sourceRussianFunctionWordRatio < 0.18 &&
      (
        uzbekSpecificWords.length >= 3 ||
        (sourceUzbekCueWords.length >= 5 && uniqueUzbekCueWords >= 3)
      );

    if (
      sourceAppearsUzbek &&
      translatedWords.length > 0
    ) {
      const overallOverlap = multisetOverlap(sourceWords, translatedWords) / sourceWords.length;
      const retainedUzbekCues = multisetOverlap(sourceUzbekCueWords, translatedWords)
        / Math.max(1, sourceUzbekCueWords.length);
      const translatedUzbekCueRatio = translatedWords.filter(isUzbekCueWord).length
        / translatedWords.length;
      const translatedRussianFunctionWordRatio = translatedWords.filter(
        (word) => RUSSIAN_FUNCTION_WORDS.has(word),
      ).length / translatedWords.length;
      const isMostlySourceCopy = overallOverlap >= 0.68 && retainedUzbekCues >= 0.5;
      const remainsPredominantlyUzbek =
        retainedUzbekCues >= 0.55 &&
        translatedUzbekCueRatio >= 0.08 &&
        translatedRussianFunctionWordRatio < 0.12;
      if (isMostlySourceCopy || remainsPredominantlyUzbek) {
        return 'the Russian result appears to leave Uzbek source text untranslated';
      }
    }
  }

  return null;
}
