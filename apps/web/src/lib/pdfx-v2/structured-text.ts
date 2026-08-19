export type PdfTextSegment =
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'table';
      columnCount: number;
      raw: string;
      rows: string[][];
    };

type SourceLine = {
  content: string;
  raw: string;
};

/** Estimate readable fixed-layout column widths without allowing one long OCR
 * cell to stretch the whole viewer beyond a practical horizontal scroll. */
export function estimateTableColumnWidths(
  rows: readonly (readonly string[])[],
  columnCount: number,
): number[] {
  return Array.from({ length: columnCount }, (_, columnIndex) => {
    const longestLine = rows.reduce((longest, row) => {
      const cellLines = (row[columnIndex] || '').split(/\r?\n/g);
      return Math.max(longest, ...cellLines.map((line) => Array.from(line).length));
    }, 0);
    return Math.max(8, Math.min(28, 6 + Math.sqrt(longestLine) * 2.2));
  });
}

/**
 * Separates reliably tabular text from the surrounding page copy.
 *
 * PDF extraction occasionally uses a tab for indentation, so a single tabbed
 * line is deliberately left as prose. A block becomes a table only when at
 * least two of its consecutive rows contain values in multiple columns.
 */
export function segmentPdfText(text: string): PdfTextSegment[] {
  if (!text) return [];

  const lines = splitSourceLines(text);
  const segments: PdfTextSegment[] = [];
  let prose = '';

  const flushProse = () => {
    if (!prose) return;
    segments.push({ kind: 'text', text: prose });
    prose = '';
  };

  for (let index = 0; index < lines.length; ) {
    if (!isTabDelimited(lines[index].content)) {
      prose += lines[index].raw;
      index += 1;
      continue;
    }

    const start = index;
    const tableLines: SourceLine[] = [];
    while (index < lines.length) {
      const line = lines[index];
      if (isTabDelimited(line.content)) {
        tableLines.push(line);
        index += 1;
        continue;
      }
      // Translation models occasionally retain an empty visual spacer between
      // TSV rows. Keep the table intact when the next non-empty line is still
      // tab-delimited, but leave trailing blank space with the prose segment.
      if (
        line.content.trim().length === 0 &&
        index + 1 < lines.length &&
        isTabDelimited(lines[index + 1].content)
      ) {
        index += 1;
        continue;
      }
      break;
    }

    const candidate = lines.slice(start, index);
    const parsedRows = tableLines.map((line) => parseRow(line.content));
    const substantiveRows = parsedRows.filter(
      (row) => row.filter((cell) => cell.length > 0).length >= 2,
    ).length;

    if (parsedRows.length < 2 || substantiveRows < 2) {
      prose += candidate.map((line) => line.raw).join('');
      continue;
    }

    flushProse();
    const columnCount = Math.max(...parsedRows.map((row) => row.length));
    segments.push({
      kind: 'table',
      columnCount,
      raw: candidate.map((line) => line.raw).join(''),
      rows: parsedRows.map((row) => [
        ...row,
        ...Array<string>(columnCount - row.length).fill(''),
      ]),
    });
  }

  flushProse();
  return segments;
}

function isTabDelimited(line: string): boolean {
  return line.includes('\t') && line.split('\t').length >= 2;
}

function parseRow(line: string): string[] {
  return line.split('\t').map((cell) => cell.trim());
}

function splitSourceLines(text: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    let endingStart = cursor;
    while (
      endingStart < text.length &&
      text[endingStart] !== '\r' &&
      text[endingStart] !== '\n'
    ) {
      endingStart += 1;
    }

    let endingEnd = endingStart;
    if (text[endingStart] === '\r' && text[endingStart + 1] === '\n') {
      endingEnd += 2;
    } else if (text[endingStart] === '\r' || text[endingStart] === '\n') {
      endingEnd += 1;
    }

    lines.push({
      content: text.slice(cursor, endingStart),
      raw: text.slice(cursor, endingEnd),
    });
    cursor = endingEnd;
  }

  return lines;
}
