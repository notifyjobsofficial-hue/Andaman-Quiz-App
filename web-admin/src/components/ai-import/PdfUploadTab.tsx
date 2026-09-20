import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  Settings,
  Sparkles,
  Layers,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { Exam, Subject, Topic, ImportMode, PdfImportJob } from '../../types';
import { inspectPdf } from '../../utils/pdfParser';
import { uploadImage } from '../../firebase/storage';
import { createImportJob } from '../../services/aiImportService';
import { auth } from '../../firebase/config';

interface PdfUploadTabProps {
  exams: Exam[];
  subjects: Subject[];
  topics: Topic[];
  onJobCreated: (job: PdfImportJob, file: File) => void;
}

export const PdfUploadTab: React.FC<PdfUploadTabProps> = ({
  exams,
  subjects,
  topics,
  onJobCreated,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspection, setInspection] = useState<{
    totalPages: number;
    isScanned: boolean;
    sampleText: string;
  } | null>(null);

  // Defaults Form
  const [exam, setExam] = useState('ANCHSL');
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('General Awareness');
  const [chapter, setChapter] = useState('');
  const [topic, setTopic] = useState('General');
  const [language, setLanguage] = useState<'en' | 'hi' | 'both'>('both');
  const [importMode, setImportMode] = useState<ImportMode>('questions_key');

  // Extraction Engine Mode (Free Local by default, ₹0 API usage)
  const [extractionMode, setExtractionMode] = useState<'free_local' | 'ai_assisted'>('free_local');

  // Feature Toggles
  const [autoDetectTaxonomy, setAutoDetectTaxonomy] = useState(true);
  const [autoDetectDifficulty, setAutoDetectDifficulty] = useState(true);
  const [extractImages, setExtractImages] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (selected: File) => {
    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid .pdf file.');
      return;
    }

    setError(null);
    setFile(selected);
    setIsInspecting(true);

    try {
      const res = await inspectPdf(selected);
      setInspection(res);
    } catch (err: any) {
      console.error('Inspection failed:', err);
      setError('Failed to inspect PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setIsInspecting(false);
    }
  };

  const handleStartImport = async () => {
    if (!file || !inspection) return;

    setIsCreating(true);
    setError(null);

    try {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      // Upload PDF to Firebase Storage
      const storagePath = `admin_pdf_uploads/${jobId}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      let uploadedUrl = '';
      try {
        uploadedUrl = await uploadImage(file, 'admin_pdf_uploads');
      } catch {
        // If storage upload encounters rules in development, proceed with storagePath reference
        uploadedUrl = storagePath;
      }

      const newJob: Omit<PdfImportJob, 'createdAt' | 'updatedAt'> = {
        id: jobId,
        fileName: file.name,
        storagePath: uploadedUrl,
        fileSize: file.size,
        totalPages: inspection.totalPages,
        status: 'pending',
        importMode,
        defaults: {
          exam,
          category,
          subject,
          chapter,
          topic,
          language,
          difficulty: 'Medium',
          positiveMarks: 2.0,
          negativeMarks: 0.5,
        },
        config: {
          extractionMode,
          autoDetectTaxonomy,
          autoDetectDifficulty,
          extractImages,
          ocrEnabled: inspection.isScanned,
        },
        progress: {
          currentBatch: 0,
          totalBatches: Math.ceil(inspection.totalPages / 5),
          processedPages: 0,
          totalPages: inspection.totalPages,
        },
        metrics: {
          detectedQuestions: 0,
          highConfidence: 0,
          needsReview: 0,
          errors: 0,
          approved: 0,
          rejected: 0,
          pendingReview: 0,
          duplicates: 0,
        },
        createdBy: auth.currentUser?.email || 'admin',
      };

      const created = await createImportJob(newJob);
      onJobCreated(created, file);
    } catch (err: any) {
      console.error('Job creation failed:', err);
      setError(err.message || 'Failed to initialize import job');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-slate-200 py-4">
      {/* Upload Box */}
      <div
        className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all ${
          file
            ? 'bg-slate-900/60 border-brand-500/80 shadow-lg shadow-brand-900/10'
            : 'bg-slate-900/40 border-slate-700 hover:border-slate-600'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = e.dataTransfer.files[0];
          if (dropped) handleFileChange(dropped);
        }}
      >
        <input
          type="file"
          id="pdf-input"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) handleFileChange(selected);
          }}
        />

        {file ? (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-950 border border-brand-800 flex items-center justify-center text-brand-400 mb-3 shadow-inner">
              <FileText size={32} />
            </div>
            <h3 className="font-bold text-base text-white">{file.name}</h3>
            <p className="text-xs text-slate-400 mt-1">
              {(file.size / (1024 * 1024)).toFixed(2)} MB •{' '}
              {isInspecting ? (
                <span className="inline-flex items-center gap-1 text-brand-400">
                  <Loader2 size={12} className="animate-spin" /> Inspecting document structure...
                </span>
              ) : inspection ? (
                <span className="text-emerald-400 font-semibold">
                  {inspection.totalPages} Pages Detected ({inspection.isScanned ? 'Scanned / OCR' : 'Searchable Text'})
                </span>
              ) : (
                'Ready for inspection'
              )}
            </p>

            <label
              htmlFor="pdf-input"
              className="mt-3 text-xs text-brand-400 hover:text-brand-300 font-semibold cursor-pointer underline underline-offset-4"
            >
              Choose different PDF
            </label>
          </div>
        ) : (
          <label htmlFor="pdf-input" className="cursor-pointer block">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <UploadCloud size={32} />
            </div>
            <h3 className="font-bold text-sm text-white">Upload Question Bank / Exam PDF</h3>
            <p className="text-xs text-slate-400 mt-1">
              Supports large documents up to 5,000 questions (Drag & Drop or Click to browse)
            </p>
            <span className="mt-4 inline-block px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white shadow-md">
              Select PDF File
            </span>
          </label>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Pre-Inspection & Batch Estimate Card */}
      {inspection && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sparkles size={18} className="text-brand-400" />
            <h4 className="font-bold text-sm text-white">Document Pre-Flight Analysis</h4>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Total Pages</span>
              <span className="text-base font-bold text-white font-mono">{inspection.totalPages}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Page Slices (5-pg batches)</span>
              <span className="text-base font-bold text-brand-400 font-mono">
                {Math.ceil(inspection.totalPages / 5)} Batches
              </span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Format Classification</span>
              <span className="text-xs font-bold text-emerald-400 mt-1 block">
                {inspection.isScanned ? 'Image/Scanned Pages' : 'Digital Selectable Text'}
              </span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px]">AI Safety & Staging</span>
              <span className="text-xs font-bold text-amber-400 mt-1 block">
                Human Review Staging Only
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Configuration & Defaults */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Settings size={18} className="text-brand-400" />
          <h4 className="font-bold text-sm text-white">Import Configuration & Taxonomy Defaults</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-bold mb-1">Import Mode</label>
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as ImportMode)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            >
              <option value="questions_key">Questions + Answer Key</option>
              <option value="questions_answers_explanations">Questions + Answers + Explanations</option>
              <option value="previous_year">Previous Year Paper (PYQ)</option>
              <option value="question_bank">Question Bank (Practice Questions)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Default Exam</label>
            <select
              value={exam}
              onChange={(e) => setExam(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.code}>
                  {ex.name} ({ex.code})
                </option>
              ))}
              <option value="ANCHSL">AN CHSL</option>
              <option value="ANCGL">AN CGL</option>
              <option value="ANMTS">AN MTS</option>
              <option value="POLICE">Police Executive</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Default Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.name}>
                  {sub.name}
                </option>
              ))}
              <option value="General Awareness">General Awareness</option>
              <option value="General Intelligence">General Intelligence / Reasoning</option>
              <option value="Quantitative Aptitude">Quantitative Aptitude / Maths</option>
              <option value="English Language">English Language</option>
              <option value="Andaman & Nicobar GK">Andaman & Nicobar GK</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Default Chapter (Optional)</label>
            <input
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Ancient History"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Default Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Rivers & Geography"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            >
              <option value="both">Bilingual (English & Hindi)</option>
              <option value="en">English Only</option>
              <option value="hi">Hindi Only</option>
            </select>
          </div>
        </div>

        {/* Extraction Engine Mode Setting */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles size={14} className="text-brand-400" />
              Extraction Engine Mode
            </label>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
              ₹0 Cost-First Architecture
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label
              className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                extractionMode === 'free_local'
                  ? 'bg-brand-950/30 border-brand-500/80 shadow-xs'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">Free Local</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    PDF.js text parsing + Tesseract.js client OCR. 100% private, runs directly in browser.
                  </p>
                </div>
                <input
                  type="radio"
                  name="extractionMode"
                  value="free_local"
                  checked={extractionMode === 'free_local'}
                  onChange={() => setExtractionMode('free_local')}
                  className="mt-0.5 accent-brand-500"
                />
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-emerald-400 font-medium">
                <span>₹0 API Usage</span>
                <span>No API Key Required</span>
              </div>
            </label>

            <label
              className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                extractionMode === 'ai_assisted'
                  ? 'bg-brand-950/30 border-brand-500/80 shadow-xs'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white">AI Assisted</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">
                      Optional
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Google Gemini cloud model enhancement. Requires server-side GEMINI_API_KEY.
                  </p>
                </div>
                <input
                  type="radio"
                  name="extractionMode"
                  value="ai_assisted"
                  checked={extractionMode === 'ai_assisted'}
                  onChange={() => setExtractionMode('ai_assisted')}
                  className="mt-0.5 accent-brand-500"
                />
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-purple-400 font-medium">
                <span>External Cloud AI</span>
                <span>Optional Key Required</span>
              </div>
            </label>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-950 p-3 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              checked={autoDetectTaxonomy}
              onChange={(e) => setAutoDetectTaxonomy(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-0 bg-slate-800 border-slate-700"
            />
            <span>Auto-detect Subjects / Topics</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-950 p-3 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              checked={autoDetectDifficulty}
              onChange={(e) => setAutoDetectDifficulty(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-0 bg-slate-800 border-slate-700"
            />
            <span>Auto-detect Difficulty</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-950 p-3 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              checked={extractImages}
              onChange={(e) => setExtractImages(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-0 bg-slate-800 border-slate-700"
            />
            <span>Extract Diagram Images</span>
          </label>
        </div>

        {/* CTA Button */}
        <div className="pt-4 flex justify-end">
          <button
            type="button"
            disabled={!file || !inspection || isCreating}
            onClick={handleStartImport}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white shadow-lg shadow-brand-900/40 transition flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Initializing Staging Job...
              </>
            ) : (
              <>
                <ArrowRight size={16} />
                Initialize Import Job & Begin Batches
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
