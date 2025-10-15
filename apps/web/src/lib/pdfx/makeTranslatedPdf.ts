import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs/promises';
import path from 'node:path';

type PageBlock = { pageNumber: number; text: string };

const A4 = { w: 595.28, h: 841.89 }; // 72 dpi points
const MARGIN = 48;

function normalizeText(input: string) {
  // Normalize Unicode & line endings; strip lone control chars that can break writers
  return (input ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\u2028|\u2029/g, '\n')
    .replace(/[^\S\n]+$/gm, '')
    .normalize('NFC');
}

function wrapLines(text: string, maxWidth: number, font: any, fontSize: number) {
  const out: string[] = [];
  const paragraphs = text.split(/\n{2,}/g);
  for (const p of paragraphs) {
    const words = p.split(/\s+/g);
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      const wpx = font.widthOfTextAtSize(test, fontSize);
      if (wpx > maxWidth) {
        if (line) out.push(line);
        // if single word is wider than maxWidth -> hard-split by glyph advance
        if (font.widthOfTextAtSize(w, fontSize) > maxWidth) {
          let chunk = '';
          for (const ch of w) {
            const t = chunk + ch;
            if (font.widthOfTextAtSize(t, fontSize) > maxWidth) {
              if (chunk) out.push(chunk);
              chunk = ch;
            } else {
              chunk = t;
            }
          }
          if (chunk) out.push(chunk);
          line = '';
        } else {
          line = w;
        }
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    out.push(''); // blank line between paragraphs
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

export async function makeTranslatedPdf(
  pages: PageBlock[],
  outPath: string,
  title = 'Translated Document'
) {
  // ensure output dir exists
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  // ✅ resolve font without duplicating apps/web
  let fontPath = path.resolve(process.cwd(), 'public', 'fonts', 'DejaVuSans.ttf');
  try {
    await fs.access(fontPath);
  } catch {
    // try other candidates
    const alt1 = path.resolve(process.cwd(), 'apps', 'web', 'public', 'fonts', 'DejaVuSans.ttf');
    const alt2 = path.resolve(__dirname, '../../../../public/fonts/DejaVuSans.ttf');
    try {
      await fs.access(alt1);
      fontPath = alt1;
    } catch {
      await fs.access(alt2);
      fontPath = alt2;
    }
  }

  const fontBytes = await fs.readFile(fontPath);

  const pdf = await PDFDocument.create();
  
  // Register fontkit for custom font support
  pdf.registerFontkit(fontkit);
  
  pdf.setTitle(title);

  const font = await pdf.embedFont(fontBytes, { subset: true });
  const fontBold = font; // or embed a bold TTF if you add one
  const fontSize = 11;
  const lineGap = 4;
  const usableWidth = A4.w - MARGIN * 2;

  for (const p of pages.sort((a, b) => a.pageNumber - b.pageNumber)) {
    let page = pdf.addPage([A4.w, A4.h]);
    let y = A4.h - MARGIN;

    // header
    const header = `Page ${p.pageNumber}`;
    page.drawText(header, {
      x: MARGIN,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 16;

    const safe = normalizeText(p.text || '');
    const lines = wrapLines(safe, usableWidth, font, fontSize);

    for (const ln of lines) {
      if (y < MARGIN + fontSize) {
        page = pdf.addPage([A4.w, A4.h]);
        y = A4.h - MARGIN;
        page.drawText(`${header} (cont.)`, {
          x: MARGIN,
          y,
          size: 10,
          font: fontBold,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= 16;
      }
      if (ln === '') {
        y -= fontSize; // paragraph gap
        continue;
      }
      page.drawText(ln, { x: MARGIN, y, size: fontSize, font });
      y -= fontSize + lineGap;
    }
  }

  const bytes = await pdf.save();
  await fs.writeFile(outPath, Buffer.from(bytes));
  return outPath;
}