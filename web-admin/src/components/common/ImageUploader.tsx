import React, { useState } from 'react';
import { Upload, Link as LinkIcon, X, Check, Loader2, AlertCircle } from 'lucide-react';
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
  const [progress, setProgress] = useState(0);
  const [urlInput, setUrlInput] = useState(value || '');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadError(null);
      setIsUploading(true);
      setProgress(0);
      const downloadUrl = await uploadImage(file, folder, (p) => setProgress(p));
      onChange(downloadUrl);
      setUrlInput(downloadUrl);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload image to Firebase Storage.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyUrl = () => {
    setUploadError(null);
    onChange(urlInput.trim());
  };

  const handleClear = () => {
    setUploadError(null);
    onChange('');
    setUrlInput('');
  };

  return (
    <div className="space-y-2">
      {uploadError && (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
          <AlertCircle size={13} className="shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label} (Optional)</span>
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-2 py-0.5 rounded-md transition ${mode === 'upload' ? 'bg-white shadow-xs text-brand-700 font-bold' : 'text-slate-500'}`}
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-2 py-0.5 rounded-md transition ${mode === 'url' ? 'bg-white shadow-xs text-brand-700 font-bold' : 'text-slate-500'}`}
          >
            Image URL
          </button>
        </div>
      </div>

      {value ? (
        <div className="relative group border border-slate-200 rounded-xl p-2 bg-slate-50 flex items-center gap-3">
          <img
            src={value}
            alt={label}
            className="w-16 h-16 object-contain rounded-lg bg-white border border-slate-200"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 truncate">{value}</p>
            <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
              <Check size={12} /> Ready
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            title="Remove Image"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div>
          {mode === 'upload' ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-brand-500 hover:bg-brand-50/20 transition bg-white">
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-brand-600" size={24} />
                  <span className="text-xs text-slate-600 font-medium">Uploading to Storage ({progress}%)...</span>
                  <div className="w-32 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-brand-600 h-full transition-all duration-200" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : (
                <>
                  <Upload size={20} className="text-slate-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-700">Click to upload image</span>
                  <span className="text-[10px] text-slate-400">PNG, JPG, WebP (Max 5MB)</span>
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
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="url"
                  placeholder="https://example.com/image.webp"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyUrl}
                className="px-3 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
