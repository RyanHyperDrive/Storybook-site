// Build a downloadable PDF for a book entirely in the browser, using a single
// fixed-page-template design so every page has identical dimensions, margins,
// and typography. Images are CONTAINED (never cropped) on a paper-colored
// background, matching the on-screen reader.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PdfPageInput = {
  pageNumber: number;
  text: string;
  imageUrl: string | null;
};

export type BuildPdfInput = {
  title: string;
  childName: string | null;
  dedication: string | null;
  coverUrl: string | null;
  pages: PdfPageInput[];
};

// US Letter portrait, in points.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
// Every page uses the SAME 4:5 PORTRAIT illustration block, the full content
// width wide. Generated images are also 4:5 so they fill this block edge to
// edge with no empty letterbox bands. Text sits in a clean band below it.
const IMG_W = PAGE_W - MARGIN * 2; // 516
const IMG_H = Math.round(IMG_W * 5 / 4); // 645  (4:5 portrait)
const PAPER = rgb(0.98, 0.96, 0.92); // warm paper tone
const INK = rgb(0.12, 0.1, 0.08);
const MUTED = rgb(0.45, 0.42, 0.4);

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function embedImage(
  doc: PDFDocument,
  bytes: Uint8Array,
): Promise<{ width: number; height: number; draw: (page: PDFPage, x: number, y: number, w: number, h: number) => void } | null> {
  // Detect by magic bytes.
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  try {
    const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    return {
      width: img.width,
      height: img.height,
      draw: (page, x, y, w, h) => page.drawImage(img, { x, y, width: w, height: h }),
    };
  } catch {
    // Try the other format as a fallback.
    try {
      const img = isPng ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
      return {
        width: img.width,
        height: img.height,
        draw: (page, x, y, w, h) => page.drawImage(img, { x, y, width: w, height: h }),
      };
    } catch {
      return null;
    }
  }
}

function fillPaper(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });
}

function drawContainedImage(
  page: PDFPage,
  img: { width: number; height: number; draw: (page: PDFPage, x: number, y: number, w: number, h: number) => void } | null,
  box: { x: number; y: number; w: number; h: number },
) {
  if (!img) return;
  const scale = Math.min(box.w / img.width, box.h / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = box.x + (box.w - w) / 2;
  const y = box.y + (box.h - h) / 2;
  img.draw(page, x, y, w, h);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const w = font.widthOfTextAtSize(candidate, size);
    if (w <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  topY: number,
  maxWidth: number,
  color = INK,
  lineHeight = 1.4,
) {
  const lines = wrapText(text, font, size, maxWidth);
  const lh = size * lineHeight;
  lines.forEach((line, i) => {
    page.drawText(line, { x, y: topY - (i + 1) * lh + lh * 0.25, size, font, color });
  });
}

export async function buildBookPdf(input: BuildPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const textWidth = PAGE_W - MARGIN * 2;

  // --- Cover page ---
  {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    fillPaper(page);
    const coverBytes = input.coverUrl ? await fetchBytes(input.coverUrl) : null;
    const coverImg = coverBytes ? await embedImage(doc, coverBytes) : null;
    drawContainedImage(page, coverImg, {
      x: MARGIN,
      y: PAGE_H - MARGIN - IMG_H,
      w: IMG_W,
      h: IMG_H,
    });
    const titleSize = 22;
    const titleLines = wrapText(input.title, serifBold, titleSize, textWidth);
    let cursorY = PAGE_H - MARGIN - IMG_H - 22;
    titleLines.forEach((line) => {
      const w = serifBold.widthOfTextAtSize(line, titleSize);
      page.drawText(line, { x: (PAGE_W - w) / 2, y: cursorY, size: titleSize, font: serifBold, color: INK });
      cursorY -= titleSize * 1.2;
    });
    if (input.childName) {
      const sub = `Starring ${input.childName}`;
      const subSize = 12;
      const w = serif.widthOfTextAtSize(sub, subSize);
      page.drawText(sub, { x: (PAGE_W - w) / 2, y: cursorY - 4, size: subSize, font: serif, color: MUTED });
    }
  }


  // --- Dedication page ---
  {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    fillPaper(page);
    const label = "Dedication";
    page.drawText(label, { x: MARGIN, y: PAGE_H - MARGIN - 16, size: 10, font: serifBold, color: MUTED });
    const dedication =
      input.dedication?.trim() ||
      `For ${input.childName ?? "you"} — may every page feel like home.`;
    const size = 18;
    const lines = wrapText(dedication, serif, size, textWidth);
    const totalH = lines.length * size * 1.5;
    const startY = PAGE_H / 2 + totalH / 2;
    lines.forEach((line, i) => {
      const w = serif.widthOfTextAtSize(line, size);
      page.drawText(line, {
        x: (PAGE_W - w) / 2,
        y: startY - i * size * 1.5,
        size,
        font: serif,
        color: INK,
      });
    });
  }

  // --- Story pages ---
  for (const p of input.pages) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    fillPaper(page);
    const bytes = p.imageUrl ? await fetchBytes(p.imageUrl) : null;
    const img = bytes ? await embedImage(doc, bytes) : null;
    drawContainedImage(page, img, {
      x: MARGIN,
      y: PAGE_H - MARGIN - IMG_AREA_H,
      w: textWidth,
      h: IMG_AREA_H,
    });
    const text = (p.text ?? "").trim();
    drawWrappedText(
      page,
      text,
      serif,
      14,
      MARGIN,
      PAGE_H - MARGIN - IMG_AREA_H - 24,
      textWidth,
    );
    const pageLabel = `${p.pageNumber}`;
    const w = serif.widthOfTextAtSize(pageLabel, 10);
    page.drawText(pageLabel, {
      x: PAGE_W - MARGIN - w,
      y: MARGIN - 16,
      size: 10,
      font: serif,
      color: MUTED,
    });
  }

  // --- The End ---
  {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    fillPaper(page);
    const msg = `The end. With love, for ${input.childName ?? "you"}.`;
    const size = 22;
    const lines = wrapText(msg, serif, size, textWidth);
    const totalH = lines.length * size * 1.5;
    const startY = PAGE_H / 2 + totalH / 2;
    lines.forEach((line, i) => {
      const w = serif.widthOfTextAtSize(line, size);
      page.drawText(line, {
        x: (PAGE_W - w) / 2,
        y: startY - i * size * 1.5,
        size,
        font: serif,
        color: INK,
      });
    });
  }

  return await doc.save();
}

export function triggerPdfDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "").trim() || "storybook";
}
