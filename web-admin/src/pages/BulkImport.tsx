import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Layers,
  ArrowRight,
  RefreshCw,
  FolderArchive,
  Image as ImageIcon
} from 'lucide-react';
import { parseSpreadsheetFile } from '../utils/excelParser';
import { validateQuestionRows, ValidationSummary } from '../utils/validator';
import { fetchQuestions, fetchExams, fetchSubjects, batchInsertQuestions } from '../firebase/firestore';
import { uploadImage } from '../firebase/storage';
import { Question, Exam, Subject } from '../types';
import { Badge } from '../components/common/Badge';

export const BulkImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [existingQuestions, setExistingQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Validation State
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Bulk Local Image Upload State
  const [localImageFiles, setLocalImageFiles] = useState<Map<string, File>>(new Map());
  const [uploadedImageUrls, setUploadedImageUrls] = useState<Map<string, string>>(new Map());
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);

  // Insertion state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importCompleted, setImportCompleted] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    Promise.all([fetchQuestions(1000), fetchExams(), fetchSubjects()]).then(([q, e, s]) => {
      setExistingQuestions(q);
      setExams(e);
      setSubjects(s);
    });
  }, []);

  const handleFileDrop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setActionFeedback(null);
    setFile(selected);
    setIsParsing(true);
    setSummary(null);
    setImportCompleted(false);

    try {
      const rawRows = await parseSpreadsheetFile(selected);
      const valSummary = validateQuestionRows(rawRows, existingQuestions);
      setSummary(valSummary);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: 'Failed to parse file: ' + err.message });
    } finally {
      setIsParsing(false);
    }
  };

  // Bulk local image file selection
  const handleLocalImagesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileMap = new Map<string, File>();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      fileMap.set(f.name.toLowerCase(), f);
    }
    setLocalImageFiles(fileMap);
  };

  // Upload local matched images to Firebase Storage
  const handleUploadMatchedImages = async () => {
    if (localImageFiles.size === 0 || !summary) return;

    setActionFeedback(null);
    setIsUploadingImages(true);
    setImageUploadProgress(0);
    const urlMap = new Map<string, string>();

    const total = localImageFiles.size;
    let done = 0;

    for (const [filename, fileObj] of localImageFiles.entries()) {
      try {
        const url = await uploadImage(fileObj, 'question_images');
        urlMap.set(filename, url);
        done++;
        setImageUploadProgress(Math.round((done / total) * 100));
      } catch (err) {
        console.error('Failed to upload image ' + filename, err);
      }
    }

    setUploadedImageUrls(urlMap);
    setIsUploadingImages(false);

    // Replace filenames in summary.validQuestions with the actual URLs!
    const updatedValid = summary.validQuestions.map((q) => {
      const updated = { ...q };
      if (updated.question_image_url && urlMap.has(updated.question_image_url.toLowerCase())) {
        updated.question_image_url = urlMap.get(updated.question_image_url.toLowerCase())!;
      }
      if (updated.option_a_image_url && urlMap.has(updated.option_a_image_url.toLowerCase())) {
        updated.option_a_image_url = urlMap.get(updated.option_a_image_url.toLowerCase())!;
      }
      if (updated.option_b_image_url && urlMap.has(updated.option_b_image_url.toLowerCase())) {
        updated.option_b_image_url = urlMap.get(updated.option_b_image_url.toLowerCase())!;
      }
      if (updated.option_c_image_url && urlMap.has(updated.option_c_image_url.toLowerCase())) {
        updated.option_c_image_url = urlMap.get(updated.option_c_image_url.toLowerCase())!;
      }
      if (updated.option_d_image_url && urlMap.has(updated.option_d_image_url.toLowerCase())) {
        updated.option_d_image_url = urlMap.get(updated.option_d_image_url.toLowerCase())!;
      }
      if (updated.explanation_image_url && urlMap.has(updated.explanation_image_url.toLowerCase())) {
        updated.explanation_image_url = urlMap.get(updated.explanation_image_url.toLowerCase())!;
      }
      return updated;
    });

    setSummary({
      ...summary,
      validQuestions: updatedValid,
    });

    setActionFeedback({
      type: 'success',
      message: `Successfully uploaded and linked ${urlMap.size} images to question records!`
    });
  };

  const handleStartImport = async () => {
    if (!summary || summary.validQuestions.length === 0) return;

    setActionFeedback(null);
    let toImport = summary.validQuestions;
    if (skipDuplicates && summary.duplicates.length > 0) {
      const dupRows = new Set(summary.duplicates.map((d) => d.rowNumber));
      toImport = toImport.filter((_, idx) => !dupRows.has(idx + 2));
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: toImport.length });

    try {
      await batchInsertQuestions(toImport, (current, total) => {
        setImportProgress({ current, total });
      });
      setImportCompleted(true);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: 'Import failed: ' + err.message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setActionFeedback(null);
    setFile(null);
    setSummary(null);
    setImportCompleted(false);
  };

  return (
    <div className="space-y-8">
      {/* Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs px-2 py-0.5 rounded hover:bg-black/5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Bulk Question Importer</h1>
          <p className="text-xs text-slate-500 mt-1">
            Import hundreds of competitive questions via CSV or Excel (.xlsx) with pre-insertion validation and image mapping.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/sample_questions_template.csv"
            download="andaman_quiz_questions_sample.csv"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
          >
            <Download size={14} /> Sample CSV
          </a>
          <a
            href="/sample_questions_template.xlsx"
            download="andaman_quiz_questions_sample.xlsx"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition border border-emerald-200"
          >
            <Download size={14} /> Sample Excel (.xlsx)
          </a>
        </div>
      </div>

      {/* Step 1: Upload Box */}
      {!summary && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs text-center space-y-6">
          <div className="max-w-md mx-auto">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-10 cursor-pointer hover:border-brand-500 hover:bg-brand-50/20 transition">
              <UploadCloud size={48} className="text-brand-600 mb-3" />
              <h3 className="text-sm font-bold text-slate-800">
                {isParsing ? 'Parsing & Validating Spreadsheet...' : 'Choose CSV or Excel Spreadsheet'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Supports .csv, .xlsx, and .xls files containing question text, options, answer keys, and image links.
              </p>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                disabled={isParsing}
                onChange={handleFileDrop}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-500 pt-4 border-t border-slate-100">
            <span className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-emerald-600" /> Auto-validates correct answers (A/B/C/D)
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-emerald-600" /> Duplicate question detection
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-emerald-600" /> Supports HTTPS diagrams & image URLs
            </span>
          </div>
        </div>
      )}

      {/* Step 2: Validation Results Screen */}
      {summary && !importCompleted && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Total Rows</span>
              <div className="text-2xl font-black text-slate-800 mt-1">{summary.totalRows}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{file?.name}</div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase">Valid Questions</span>
              <div className="text-2xl font-black text-emerald-800 mt-1">{summary.validQuestions.length}</div>
              <div className="text-[11px] text-emerald-600 mt-0.5">Ready for insertion</div>
            </div>

            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase">Errors / Problem Rows</span>
              <div className="text-2xl font-black text-rose-800 mt-1">{summary.errors.length}</div>
              <div className="text-[11px] text-rose-600 mt-0.5">Will be skipped</div>
            </div>

            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 uppercase">Duplicates Detected</span>
              <div className="text-2xl font-black text-amber-800 mt-1">{summary.duplicates.length}</div>
              <div className="text-[11px] text-amber-600 mt-0.5">Matches existing questions</div>
            </div>
          </div>

          {/* Bulk Local Images Upload Section (Optional Helper) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon size={16} className="text-brand-600" /> Optional: Match & Upload Local Question Images
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  If your spreadsheet contains local image filenames (e.g. `q101.webp`), select them here to upload to Firebase Storage automatically.
                </p>
              </div>
              <label className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition">
                <span>Select Image Files</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleLocalImagesSelect}
                  className="hidden"
                />
              </label>
            </div>

            {localImageFiles.size > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  {localImageFiles.size} images chosen • {uploadedImageUrls.size} uploaded to Firebase Storage
                </span>
                <button
                  type="button"
                  disabled={isUploadingImages}
                  onClick={handleUploadMatchedImages}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold text-xs disabled:opacity-50 transition"
                >
                  {isUploadingImages ? `Uploading (${imageUploadProgress}%)...` : 'Upload & Map Images'}
                </button>
              </div>
            )}
          </div>

          {/* Errors / Warnings List (Row-by-Row validation table) */}
          {summary.errors.length > 0 && (
            <div className="bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-rose-50/70 border-b border-rose-100 flex items-center gap-2 text-xs font-bold text-rose-800">
                <AlertTriangle size={16} /> Validation Issues ({summary.errors.length} Rows with Errors)
              </div>
              <div className="divide-y divide-rose-100 max-h-60 overflow-y-auto">
                {summary.errors.map((err, i) => (
                  <div key={i} className="p-3 text-xs flex items-start gap-3">
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[11px] shrink-0">
                      Row {err.rowNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 truncate">{err.questionSnippet}</div>
                      <div className="text-rose-600 text-[11px] mt-0.5 font-medium">{err.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                />
                <span>Skip potential duplicate questions</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Cancel & Upload New File
              </button>

              <button
                type="button"
                disabled={isImporting || summary.validQuestions.length === 0}
                onClick={handleStartImport}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/30 transition disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Writing {importProgress.current} / {importProgress.total}...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Import {summary.validQuestions.length} Questions</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Success Completion Screen */}
      {importCompleted && (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={36} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Bulk Import Successful!</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Successfully saved <span className="font-bold text-emerald-700">{importProgress.total}</span> questions into the Cloud Firestore Question Bank. The Android application will immediately have access to these questions when mock tests are started.
          </p>

          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
