import { getDocumentProxy } from 'npm:unpdf@1.6.0';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

import type { ParsedPdfDocument, PdfPage, TextQuality } from './engine/types.ts';

const MAX_PAGES_PER_DOCUMENT = 160;
const MAX_TEXT_CHARS_PER_PAGE = 30_000;

type PdfProxy = {
  numPages: number;
  getPage: (number: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>;
  destroy?: () => Promise<void>;
};

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes)
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

export const sha256 = async (bytes: Uint8Array) => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', copy.buffer)));
};

const normalizeExtractedText = (value: string) => value
  .split('\u0000').join('')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{4,}/g, '\n\n\n')
  .trim()
  .slice(0, MAX_TEXT_CHARS_PER_PAGE);

const textQualityFor = (pages: PdfPage[]): TextQuality => {
  if (pages.length === 0) return 'none';
  const usefulPages = pages.filter((page) => page.characterCount >= 80).length;
  const totalCharacters = pages.reduce((sum, page) => sum + page.characterCount, 0);
  const ratio = usefulPages / pages.length;
  if (totalCharacters < 80) return 'none';
  if (ratio >= 0.75 && totalCharacters >= pages.length * 250) return 'good';
  if (ratio >= 0.35) return 'partial';
  return 'poor';
};

const extractPageText = async (page: {
  getTextContent: () => Promise<{ items: unknown[] }>;
}) => {
  const content = await page.getTextContent();
  let text = '';
  for (const item of content.items) {
    if (!item || typeof item !== 'object' || !('str' in item)) continue;
    const textItem = item as { str?: unknown; hasEOL?: unknown };
    if (typeof textItem.str !== 'string') continue;
    text += textItem.str;
    text += textItem.hasEOL ? '\n' : ' ';
  }
  return normalizeExtractedText(text);
};

export const parsePdfDocument = async (
  file: File,
  fileId: string,
): Promise<ParsedPdfDocument> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await sha256(bytes);
  const pages: PdfPage[] = [];
  let extractionError: string | null = null;
  let pdf: PdfProxy | null = null;

  try {
    pdf = await getDocumentProxy(bytes.slice()) as PdfProxy;
    if (!pdf) throw new Error('PDF sem estrutura legível.');
    if (pdf.numPages > MAX_PAGES_PER_DOCUMENT) {
      throw new Error(`PDF excede o limite defensivo de ${MAX_PAGES_PER_DOCUMENT} páginas.`);
    }

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const text = await extractPageText(page);
      pages.push({
        page: pageNumber,
        text,
        characterCount: text.replace(/\s/g, '').length,
      });
    }
  } catch (error) {
    extractionError = error instanceof Error ? error.message : 'Falha na camada textual do PDF.';
    if (pages.length === 0) {
      try {
        const fallbackPdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
        const pageCount = fallbackPdf.getPageCount();
        if (pageCount > MAX_PAGES_PER_DOCUMENT) {
          throw new Error(`PDF excede o limite defensivo de ${MAX_PAGES_PER_DOCUMENT} páginas.`);
        }
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          pages.push({ page: pageNumber, text: '', characterCount: 0 });
        }
      } catch {
        // Keep the original parser error; the caller will return a review warning.
      }
    }
  } finally {
    await pdf?.destroy?.().catch(() => undefined);
  }

  return {
    fileId,
    fileName: file.name.slice(0, 180),
    hash,
    bytes,
    pages,
    textQuality: textQualityFor(pages),
    extractionError,
  };
};

export const createPdfSubset = async (
  source: Uint8Array,
  pageNumbers: number[],
) => {
  const sourcePdf = await PDFDocument.load(source, { ignoreEncryption: false });
  const outputPdf = await PDFDocument.create();
  const validIndexes = Array.from(new Set(pageNumbers))
    .filter((page) => Number.isInteger(page) && page >= 1 && page <= sourcePdf.getPageCount())
    .map((page) => page - 1);
  const pages = await outputPdf.copyPages(sourcePdf, validIndexes);
  pages.forEach((page) => outputPdf.addPage(page));
  return new Uint8Array(await outputPdf.save({ useObjectStreams: false }));
};

export const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};
