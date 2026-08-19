import type {
  PdfCell,
  PdfElement,
  PdfPageLayout,
  PdfPageTranslation,
} from './schemas';

function orderedElements(layout: PdfPageLayout): PdfElement[] {
  return [...layout.elements].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id),
  );
}

function tableMatrix(element: PdfElement): string[][] {
  const rowCount = Math.max(element.rowCount, ...element.rows.map((row) => row.rowIndex + 1), 0);
  const columnCount = Math.max(
    element.columnCount,
    ...element.rows.flatMap((row) =>
      row.cells.map((cell) => cell.columnIndex + cell.columnSpan),
    ),
    0,
  );
  const matrix = Array.from({ length: rowCount }, () =>
    Array.from({ length: columnCount }, () => ''),
  );
  for (const row of element.rows) {
    for (const cell of row.cells) {
      if (matrix[cell.rowIndex]?.[cell.columnIndex] !== undefined) {
        matrix[cell.rowIndex][cell.columnIndex] = cell.text;
      }
    }
  }
  return matrix;
}

export function pageLayoutToPlainText(layout: PdfPageLayout): string {
  const blocks: string[] = [];
  for (const element of orderedElements(layout)) {
    if (element.kind === 'table') {
      const matrix = tableMatrix(element);
      if (element.text.trim()) blocks.push(element.text.trim());
      blocks.push(...matrix.map((row) => row.join('\t')));
    } else if (element.text.trim()) {
      blocks.push(element.text.trim());
    }
  }
  return blocks.join('\n').trim();
}

export function pageLayoutForTranslation(layout: PdfPageLayout): object {
  return {
    pageNumber: layout.pageNumber,
    sourceLanguage: layout.sourceLanguage,
    sourceScript: layout.sourceScript,
    elements: orderedElements(layout).map((element) => ({
      id: element.id,
      kind: element.kind,
      text: element.text,
      cells: element.kind === 'table'
        ? element.rows.flatMap((row) =>
            row.cells.map((cell) => ({ id: cell.id, text: cell.text })),
          )
        : [],
    })),
  };
}

export function mergePageTranslation(
  source: PdfPageLayout,
  translation: PdfPageTranslation,
): PdfPageLayout {
  const translatedElements = new Map(
    translation.elements.map((element) => [element.id, element]),
  );
  return {
    ...source,
    warnings: [...source.warnings, ...translation.warnings],
    elements: source.elements.map((element) => {
      const translated = translatedElements.get(element.id);
      const translatedCells = new Map(
        (translated?.cells ?? []).map((cell) => [cell.id, cell.text]),
      );
      return {
        ...element,
        text: translated?.text ?? '',
        rows: element.rows.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => ({
            ...cell,
            text: translatedCells.get(cell.id) ?? '',
          })),
        })),
      };
    }),
  };
}

export function allCells(element: PdfElement): PdfCell[] {
  return element.rows.flatMap((row) => row.cells);
}
