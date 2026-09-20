import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './config';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
}

/**
 * Uploads an image to Firebase Storage with error handling and progress reporting.
 */
export async function uploadImage(
  file: File,
  folder: string = 'question_images',
  onProgress?: (percent: number) => void
): Promise<string> {
  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${folder}/${Date.now()}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(Math.round(progress));
      },
      (error) => {
        console.error('Storage upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (urlErr) {
          console.error('Error obtaining download URL:', urlErr);
          reject(urlErr);
        }
      }
    );
  });
}

/**
 * Uploads a PDF binary to Firebase Storage with:
 * - Proper 'application/pdf' contentType metadata
 * - Resilient timeout (default 20 seconds) with explicit task cancellation
 * - Safe download URL resolution with fallback to storagePath
 * - Live progress callback
 * - Never hangs indefinitely
 */
export async function uploadPdfFile(
  file: File,
  folder: string = 'admin_pdf_uploads',
  onProgress?: (progress: UploadProgress) => void,
  timeoutMs: number = 20000
): Promise<{ downloadUrl: string; storagePath: string }> {
  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${folder}/${Date.now()}_${cleanName}`;
  const storageRef = ref(storage, storagePath);
  const metadata = {
    contentType: file.type || 'application/pdf',
    customMetadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  };

  const uploadTask = uploadBytesResumable(storageRef, file, metadata);

  return new Promise((resolve, reject) => {
    let completed = false;

    // Timeout guard: cancel task and reject if taking longer than timeoutMs
    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        try {
          uploadTask.cancel();
        } catch (cancelErr) {
          console.warn('Failed to cancel storage upload on timeout:', cancelErr);
        }
        reject(new Error(`Storage upload timed out after ${Math.round(timeoutMs / 1000)}s`));
      }
    }, timeoutMs);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (completed) return;
        const total = snapshot.totalBytes > 0 ? snapshot.totalBytes : file.size || 1;
        const percent = Math.min(100, Math.round((snapshot.bytesTransferred / total) * 100));
        onProgress?.({
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: total,
          percent,
        });
      },
      (error) => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          console.error('Storage upload error:', error);
          reject(error);
        }
      },
      async () => {
        if (completed) return;
        clearTimeout(timer);
        completed = true;
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ downloadUrl, storagePath });
        } catch (urlErr) {
          console.warn('Could not resolve getDownloadURL, falling back to storagePath reference:', urlErr);
          // Fallback to storagePath reference so import pipeline is not broken
          resolve({ downloadUrl: storagePath, storagePath });
        }
      }
    );
  });
}
