import { validateTranslationResult } from './language-validation';
import type { PdfPageLayout, PdfPageTranslation } from './schemas';
import { allCells, mergePageTranslation, pageLayoutToPlainText } from './serialize';
import type { PdfxV2Validation } from './types';

export class PdfxV2ValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PdfxV2ValidationError';
  }
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return Array.from(repeated);
}

export function validateExtractedPage(
  layout: PdfPageLayout,
  expectedPageNumber: number,
): PdfxV2Validation {
  const failures: string[] = [];
  const warnings = [...layout.warnings];
  if (layout.pageNumber !== expectedPageNumber) {
    failures.push(`expected page ${expectedPageNumber}, received page ${layout.pageNumber}`);
  }
  const elementIds = layout.elements.map((element) => element.id.trim());
  if (elementIds.some((id) => !id)) failures.push('one or more elements have an empty ID');
  const repeatedElements = duplicates(elementIds);
  if (repeatedElements.length) failures.push(`duplicate element IDs: ${repeatedElements.join(', ')}`);

  for (const element of layout.elements) {
    const cells = allCells(element);
    const repeatedCells = duplicates(cells.map((cell) => cell.id.trim()));
    if (repeatedCells.length) {
      failures.push(`element ${element.id} has duplicate cell IDs: ${repeatedCells.join(', ')}`);
    }
    if (element.kind === 'table') {
      if (element.columnCount < 1 || element.rowCount < 1 || cells.length < 1) {
        failures.push(`table ${element.id} has no complete grid`);
      }
      if (element.columnCount > 200 || element.rowCount > 2_000) {
        failures.push(`table ${element.id} declares implausible grid dimensions`);
        continue;
      }
      const coverage = Array.from({ length: element.rowCount }, () =>
        Array.from({ length: element.columnCount }, () => 0),
      );
      for (const cell of cells) {
        if (
          cell.rowIndex + cell.rowSpan > element.rowCount ||
          cell.columnIndex + cell.columnSpan > element.columnCount
        ) {
          failures.push(`table ${element.id} cell ${cell.id} lies outside the declared grid`);
          continue;
        }
        for (let row = cell.rowIndex; row < cell.rowIndex + cell.rowSpan; row += 1) {
          for (
            let column = cell.columnIndex;
            column < cell.columnIndex + cell.columnSpan;
            column += 1
          ) {
            coverage[row][column] += 1;
          }
        }
      }
      const uncovered = coverage.reduce(
        (count, row) => count + row.filter((value) => value === 0).length,
        0,
      );
      const overlaps = coverage.reduce(
        (count, row) => count + row.filter((value) => value > 1).length,
        0,
      );
      if (uncovered > 0) {
        failures.push(`table ${element.id} is missing ${uncovered} grid position(s)`);
      }
      if (overlaps > 0) {
        failures.push(`table ${element.id} overlaps ${overlaps} grid position(s)`);
      }
    } else if (element.rows.length || element.columnCount || element.rowCount) {
      failures.push(`non-table element ${element.id} unexpectedly contains table geometry`);
    }
  }

  return { valid: failures.length === 0, failures, warnings };
}

function numberTokens(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of text.match(/\d+(?:[.,:/-]\d+)*/g) ?? []) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function equalCounts(left: Map<string, number>, right: Map<string, number>): boolean {
  if (left.size !== right.size) return false;
  let equal = true;
  left.forEach((count, key) => {
    if (right.get(key) !== count) equal = false;
  });
  return equal;
}

function lexicalTokens(text: string): string[] {
  return (text.toLocaleLowerCase().match(/[A-Za-z\u0400-\u04FF\u0600-\u06FF]+/g) ?? [])
    .filter((token) => token.length > 1);
}

function looksEffectivelyUnchanged(source: string, translated: string): boolean {
  const sourceTokens = lexicalTokens(source);
  const translatedTokens = lexicalTokens(translated);
  if (sourceTokens.length < 3 || translatedTokens.length < 3) return false;
  const normalizedSource = sourceTokens.join(' ');
  const normalizedTranslation = translatedTokens.join(' ');
  if (normalizedSource === normalizedTranslation) return true;
  if (sourceTokens.length < 8) return false;
  const translatedCounts = new Map<string, number>();
  for (const token of translatedTokens) {
    translatedCounts.set(token, (translatedCounts.get(token) ?? 0) + 1);
  }
  let matches = 0;
  for (const token of sourceTokens) {
    const remaining = translatedCounts.get(token) ?? 0;
    if (remaining > 0) {
      matches += 1;
      translatedCounts.set(token, remaining - 1);
    }
  }
  return matches / Math.max(sourceTokens.length, translatedTokens.length) >= 0.88;
}

export function validateTranslatedPage(
  source: PdfPageLayout,
  translation: PdfPageTranslation,
  targetLanguage: string,
): PdfxV2Validation {
  const failures: string[] = [];
  const warnings = [...translation.warnings];
  if (translation.pageNumber !== source.pageNumber) {
    failures.push(`translation returned page ${translation.pageNumber} for source page ${source.pageNumber}`);
  }

  const sourceIds = source.elements.map((element) => element.id);
  const translatedIds = translation.elements.map((element) => element.id);
  if (sourceIds.length !== translatedIds.length ||
      sourceIds.some((id, index) => translatedIds[index] !== id)) {
    failures.push('translated elements do not preserve the exact source order and IDs');
  }

  const translatedById = new Map(translation.elements.map((element) => [element.id, element]));
  for (const sourceElement of source.elements) {
    const translatedElement = translatedById.get(sourceElement.id);
    if (!translatedElement) continue;
    if (sourceElement.text.trim() && !translatedElement.text.trim()) {
      failures.push(`element ${sourceElement.id} lost its text`);
    }
    const sourceCells = allCells(sourceElement);
    const translatedCellIds = translatedElement.cells.map((cell) => cell.id);
    if (
      sourceCells.length !== translatedCellIds.length ||
      sourceCells.some((cell, index) => translatedCellIds[index] !== cell.id)
    ) {
      failures.push(`table ${sourceElement.id} does not preserve cell order and IDs`);
      continue;
    }
    translatedElement.cells.forEach((cell, index) => {
      if (sourceCells[index]?.text.trim() && !cell.text.trim()) {
        failures.push(`table cell ${cell.id} lost its text`);
      }
    });
  }

  const merged = mergePageTranslation(source, translation);
  const sourceText = pageLayoutToPlainText(source);
  const translatedText = pageLayoutToPlainText(merged);
  if (!equalCounts(numberTokens(sourceText), numberTokens(translatedText))) {
    failures.push('numeric values or legal references changed during translation');
  }
  const languageFailure = validateTranslationResult(sourceText, targetLanguage, translatedText);
  if (languageFailure) failures.push(languageFailure);
  const sourceLanguage = source.sourceLanguage.trim().toLocaleLowerCase();
  if (
    sourceLanguage &&
    !sourceLanguage.includes(targetLanguage.toLocaleLowerCase()) &&
    looksEffectivelyUnchanged(sourceText, translatedText)
  ) {
    failures.push(
      `page ${source.pageNumber} is effectively unchanged from ${source.sourceLanguage}; ` +
      `it was not translated into ${targetLanguage}`,
    );
  }

  return { valid: failures.length === 0, failures, warnings };
}
