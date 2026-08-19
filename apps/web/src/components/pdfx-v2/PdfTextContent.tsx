import {
  estimateTableColumnWidths,
  segmentPdfText,
  type PdfTextSegment,
} from '@/lib/pdfx-v2/structured-text';

type PdfTextContentProps = {
  emptyLabel: string;
  fontSize: number;
  label: string;
  text: string;
  tone: 'original' | 'translated';
};

const tableTone = {
  original: {
    frame: 'focus-visible:ring-slate-500/50',
  },
  translated: {
    frame: 'focus-visible:ring-blue-500/50',
  },
} as const;

export function PdfTextContent({
  emptyLabel,
  fontSize,
  label,
  text,
  tone,
}: PdfTextContentProps) {
  if (!text) {
    return <span className="italic text-gray-400">{emptyLabel}</span>;
  }

  const segments = segmentPdfText(text);
  let tableNumber = 0;

  return (
    <div className="font-mono text-gray-800" style={{ fontSize: `${fontSize}px` }}>
      {segments.map((segment, index) => {
        if (segment.kind === 'text') {
          return (
            <pre
              key={`text-${index}`}
              className="m-0 whitespace-pre-wrap break-words [font-family:inherit] leading-relaxed"
            >
              {segment.text}
            </pre>
          );
        }

        tableNumber += 1;
        return (
          <PdfTextTable
            key={`table-${index}`}
            label={`${label}, table ${tableNumber}`}
            segment={segment}
            tone={tone}
          />
        );
      })}
    </div>
  );
}

function PdfTextTable({
  label,
  segment,
  tone,
}: {
  label: string;
  segment: Extract<PdfTextSegment, { kind: 'table' }>;
  tone: PdfTextContentProps['tone'];
}) {
  const colors = tableTone[tone];
  const columnWidths = estimateTableColumnWidths(
    segment.rows,
    segment.columnCount,
  );
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);

  return (
    <div
      aria-label={`${label}. Scroll horizontally to view all ${segment.columnCount} columns.`}
      className={`my-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 ${colors.frame}`}
      role="region"
      tabIndex={0}
    >
      <table
        className="min-w-full table-fixed border-collapse text-start leading-relaxed"
        style={{ width: `${tableWidth}rem` }}
      >
        <caption className="sr-only">{label}</caption>
        <colgroup>
          {columnWidths.map((width, columnIndex) => (
            <col key={`column-${columnIndex}`} style={{ width: `${width}rem` }} />
          ))}
        </colgroup>
        <tbody>
          {segment.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="even:bg-slate-50/70">
              {row.map((cell, columnIndex) => (
                <td
                  key={`cell-${rowIndex}-${columnIndex}`}
                  className="whitespace-pre-wrap break-words border-b border-r border-slate-200 px-3 py-2 text-start align-top last:border-r-0"
                  dir="auto"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
