/**
 * PDF Client Parser & Renderer
 * Powered by pdfjs-dist for in-browser page inspection, page count calculation,
 * text extraction, and high-fidelity canvas rendering for the Human Review Queue.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker
// Using version-pinned Cloudflare CDN worker for production reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PdfInspectionResult {
  totalPages: number;
  isScanned: boolean;
  sampleText: string;
  hasTextLayer: boolean;
}

/**
 * Loads a PDF file and returns the PDFDocumentProxy.
 */
export async function loadPdfDocument(fileOrBuffer: File | ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  const data = fileOrBuffer instanceof File
    ? await fileOrBuffer.arrayBuffer()
    : fileOrBuffer;

  const loadingTask = pdfjsLib.getDocument({ data });
  return await loadingTask.promise;
}

/**
 * Pre-inspects a PDF to determine total pages and whether it is primarily text or scanned.
 */
export async function inspectPdf(file: File): Promise<PdfInspectionResult> {
  const doc = await loadPdfDocument(file);
  const totalPages = doc.numPages;

  let totalSampleWords = 0;
  let sampleTextCombined = '';

  // Sample up to first 3 pages
  const pagesToSample = Math.min(totalPages, 3);
  for (let p = 1; p <= pagesToSample; p++) {
    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ');

    sampleTextCombined += pageText + '\n';
    totalSampleWords += pageText.trim().split(/\s+/).filter(Boolean).length;
  }

  // If average words per page is less than 25, it's likely scanned / image-based
  const avgWords = totalSampleWords / pagesToSample;
  const isScanned = avgWords < 25;

  return {
    totalPages,
    isScanned,
    sampleText: sampleTextCombined.slice(0, 1000),
    hasTextLayer: !isScanned,
  };
}

/**
 * Extracts raw text lines from a specific page.
 */
export async function extractPageText(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  if (pageNumber < 1 || pageNumber > doc.numPages) return '';
  const page = await doc.getPage(pageNumber);
  const textContent = await page.getTextContent();

  return textContent.items
    .map((item: any) => item.str || '')
    .join(' ');
}

/**
 * Renders a PDF page onto an HTMLCanvasElement with high DPR support.
 */
export async function renderPdfPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<{ width: number; height: number }> {
  if (pageNumber < 1 || pageNumber > doc.numPages) {
    throw new Error(`Page number ${pageNumber} out of bounds (1..${doc.numPages})`);
  }

  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not obtain 2D canvas context');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
  return { width: viewport.width, height: viewport.height };
}

/**
 * Renders a PDF page directly to a base64 PNG data URL (useful for vision AI fallback).
 */
export async function renderPdfPageToDataUrl(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number = 1.5
): Promise<string> {
  const canvas = document.createElement('canvas');
  await renderPdfPageToCanvas(doc, pageNumber, canvas, scale);
  return canvas.toDataURL('image/png');
}
