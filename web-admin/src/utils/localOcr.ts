/**
 * Local Browser-Side OCR Service
 * Powered by Tesseract.js (Wasm / Web Worker) for 100% free, client-side OCR.
 * Eliminates mandatory third-party vision APIs for scanned question papers.
 */

import { createWorker, Worker } from 'tesseract.js';

let sharedWorker: Worker | null = null;
let isInitializing = false;

/**
 * Initializes or returns the shared Tesseract worker.
 */
export async function getOcrWorker(
  onProgress?: (progress: number, status: string) => void
): Promise<Worker> {
  if (sharedWorker) return sharedWorker;

  if (isInitializing) {
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (sharedWorker) return sharedWorker;
  }

  isInitializing = true;
  try {
    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const p = Math.round((m.progress || 0) * 100);
          onProgress?.(p, m.status);
        }
      },
    });
    sharedWorker = worker;
    return worker;
  } finally {
    isInitializing = false;
  }
}

/**
 * Performs local optical character recognition on an HTMLCanvasElement or base64 image string.
 */
export async function recognizePageImage(
  imageSource: HTMLCanvasElement | string,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  try {
    const worker = await getOcrWorker(onProgress);
    const result = await worker.recognize(imageSource);
    return result.data.text || '';
  } catch (err: any) {
    console.error('Local Tesseract.js OCR error:', err);
    throw err;
  }
}

/**
 * Safely terminates the background Tesseract Web Worker to release browser memory.
 */
export async function terminateOcrWorker(): Promise<void> {
  if (sharedWorker) {
    try {
      await sharedWorker.terminate();
    } catch (e) {
      console.warn('Error terminating OCR worker:', e);
    }
    sharedWorker = null;
  }
}
