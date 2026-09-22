import React, { useState, useEffect } from 'react';
import { Upload, Link as LinkIcon, Check, Loader2, AlertCircle, RefreshCw, Trash2, X } from 'lucide-react';
import { uploadImage } from '../../firebase/storage';

interface ImageUploaderProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label,
  value,
  onChange,
  folder = 'question_images',
}) => {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [progress, setProgress] = useState(0);
  const [urlInput, setUrlInput] = useState(value || '');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);

  useEffect(() => {
    setUrlInput(value || '');
    setImageError(false);
    if (!value) {
      setIsReplacing(false);
    }
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadError(null);
      setIsUploading(true);
      setProgress(0);
      const downloadUrl = await uploadImage(file, folder, (p) => setProgress(p));
      setImageError(false);
      setIsReplacing(false);
      onChange(downloadUrl);
      setUrlInput(downloadUrl);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload image to Firebase Storage.');
    } finally {
      setIsUploading(false);
    }
  };

  const probeDirectImage = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      let finished = false;

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          resolve(false);
        }
      }, 7000);

      img.onload = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          // Verify it decoded genuine image dimensions
          resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
        }
      };

      img.onerror = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(false);
        }
      };

      img.src = url;
    });
  };

  const handleApplyUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setUploadError('Please enter an image URL.');
      return;
    }

    // 1. Reject local paths, blob:, file://, windows drive paths
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith('blob:') ||
      lower.startsWith('file:') ||
      lower.includes(':\\') ||
      lower.startsWith('\\')
    ) {
      setUploadError('Local file and blob paths cannot be saved. Upload the file or provide an HTTPS image URL.');
      return;
    }

    // 2. Enforce HTTPS only
    if (!lower.startsWith('https://')) {
      setUploadError('Only secure HTTPS image URLs are supported.');
      return;
    }

    // 3. Probe that the URL actually resolves to an image binary, not a webpage or broken link
    setUploadError(null);
    setIsValidatingUrl(true);

    try {
      const isValidImage = await probeDirectImage(trimmed);
      if (!isValidImage) {
        setUploadError('This URL is not a direct image. Upload the image or use a direct image URL.');
        return;
      }

      setImageError(false);
      setIsReplacing(false);
      onChange(trimmed);
    } catch {
      setUploadError('This URL is not a direct image. Upload the image or use a direct image URL.');
    } finally {
      setIsValidatingUrl(false);
    }
  };

  const handleClear = () => {
    setUploadError(null);
    setImageError(false);
    setIsReplacing(false);
    setUrlInput('');
    onChange('');
  };

  const hasImage = Boolean(value && value.trim().length > 0);

  return (
    <div className="space-y-2">
      {uploadError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span className="flex-1">{uploadError}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label} (Optional)</span>
        {(!hasImage || isReplacing) && (
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`px-2 py-0.5 rounded-md transition ${
                mode === 'upload' ? 'bg-white shadow-xs text-brand-700 font-bold' : 'text-slate-500'
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              className={`px-2 py-0.5 rounded-md transition ${
                mode === 'url' ? 'bg-white shadow-xs text-brand-700 font-bold' : 'text-slate-500'
              }`}
            >
              Image URL
            </button>
          </div>
        )}
      </div>

      {hasImage && !isReplacing ? (
        <div className="relative group border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center gap-3">
          <div className="w-16 h-16 shrink-0 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
            <img
              src={value}
              alt={label}
              className="max-w-full max-h-full object-contain"
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 truncate" title={value}>
              {value}
            </p>
            {imageError ? (
              <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                <AlertCircle size={12} /> Image could not be loaded
              </p>
            ) : (
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                <Check size={12} /> Ready
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsReplacing(true)}
              className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 transition flex items-center gap-1"
              title="Replace this image"
            >
              <RefreshCw size={12} />
              <span>Replace</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1 text-xs font-semibold bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 text-rose-600 transition flex items-center gap-1"
              title="Remove this image"
            >
              <Trash2 size={12} />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div>
          {mode === 'upload' ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-brand-500 hover:bg-brand-50/20 transition bg-white">
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-brand-600" size={24} />
                  <span className="text-xs text-slate-600 font-medium">
                    Uploading to Storage ({progress}%)...
                  </span>
                  <div className="w-32 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-600 h-full transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <Upload size={20} className="text-slate-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-700">Click to upload image</span>
                  <span className="text-[10px] text-slate-400">PNG, JPG, WebP, SVG (Max 5MB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </>
              )}
            </label>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="url"
                    placeholder="https://example.com/image.webp"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyUrl();
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={isValidatingUrl}
                  onClick={handleApplyUrl}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isValidatingUrl ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Apply</span>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Must be a direct image URL (PNG, JPG, WebP, SVG). Webpage / share URLs are not supported.
              </p>
            </div>
          )}

          {isReplacing && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsReplacing(false)}
                className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1"
              >
                <X size={12} />
                <span>Cancel Replace</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
