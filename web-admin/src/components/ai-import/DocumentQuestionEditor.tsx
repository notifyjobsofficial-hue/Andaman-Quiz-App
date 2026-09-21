import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StagedQuestion,
  Exam,
  Subject,
  Topic,
  ConfidenceLevel,
  AnswerSource,
} from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RotateCcw,
  Undo2,
  Redo2,
  UploadCloud,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Crop,
  Check,
  Copy,
} from 'lucide-react';
import { uploadImage } from '../../firebase/storage';

interface DocumentQuestionEditorProps {
  question: StagedQuestion | null;
  exams: Exam[];
  subjects: Subject[];
  topics: Topic[];
  onChange: (updated: StagedQuestion) => void;
  onCropFromPdfRequest?: () => void;
}

export const DocumentQuestionEditor: React.FC<DocumentQuestionEditorProps> = ({
  question,
  exams,
  subjects,
  topics,
  onChange,
  onCropFromPdfRequest,
}) => {
  // Local edit history for Undo / Redo
  const [history, setHistory] = useState<StagedQuestion[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Original pristine extraction for comparison
  const originalRef = useRef<StagedQuestion | null>(null);

  // Panels visibility
  const [showDetails, setShowDetails] = useState(false);
  const [showOriginalModal, setShowOriginalModal] = useState(false);
  const [isUploadingImg, setIsUploadingImg] = useState(false);

  // Initialize or track question changes
  useEffect(() => {
    if (question) {
      if (!originalRef.current || originalRef.current.id !== question.id) {
        originalRef.current = JSON.parse(JSON.stringify(question));
        setHistory([JSON.parse(JSON.stringify(question))]);
        setHistoryIndex(0);
      }
    }
  }, [question?.id]);

  if (!question) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
        <p className="text-sm font-semibold text-slate-700">No Question Selected</p>
        <p className="text-xs text-slate-400 mt-1">Select a question from the navigator or summary to begin proofreading.</p>
      </div>
    );
  }

  const handleFieldChange = (field: keyof StagedQuestion, val: any) => {
    const updated = { ...question, [field]: val };
    // Record history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(updated)));
    if (newHistory.length > 25) newHistory.shift();

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    onChange(updated);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onChange(JSON.parse(JSON.stringify(prev)));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onChange(JSON.parse(JSON.stringify(next)));
    }
  };

  const handleResetQuestion = () => {
    if (originalRef.current && confirm('Reset all edits back to the initial extracted version?')) {
      const original = JSON.parse(JSON.stringify(originalRef.current));
      setHistory([original]);
      setHistoryIndex(0);
      onChange(original);
    }
  };

  // Safe Clean Formatting: only formatting, double spaces, line wraps, punctuation
  const handleSmartCleanup = () => {
    let cleanText = question.question_text || '';
    // Fix excessive newlines and double spaces
    cleanText = cleanText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Clean options
    const cleanOptA = (question.option_a_text || '').replace(/[ \t]+/g, ' ').replace(/^[\(]?[A-Da-d1-4][\)\.\:\-\s]+/g, '').trim();
    const cleanOptB = (question.option_b_text || '').replace(/[ \t]+/g, ' ').replace(/^[\(]?[A-Da-d1-4][\)\.\:\-\s]+/g, '').trim();
    const cleanOptC = (question.option_c_text || '').replace(/[ \t]+/g, ' ').replace(/^[\(]?[A-Da-d1-4][\)\.\:\-\s]+/g, '').trim();
    const cleanOptD = (question.option_d_text || '').replace(/[ \t]+/g, ' ').replace(/^[\(]?[A-Da-d1-4][\)\.\:\-\s]+/g, '').trim();

    const updated: StagedQuestion = {
      ...question,
      question_text: cleanText,
      option_a_text: cleanOptA,
      option_b_text: cleanOptB,
      option_c_text: cleanOptC,
      option_d_text: cleanOptD,
    };

    handleFieldChange('question_text', cleanText);
    onChange(updated);
  };

  // Check if diagram or image is mentioned
  const mentionsDiagram = useMemo(() => {
    const text = (question.question_text || '').toLowerCase();
    return (
      text.includes('figure') ||
      text.includes('diagram') ||
      text.includes('table') ||
      text.includes('graph') ||
      text.includes('chart') ||
      text.includes('shown below') ||
      text.includes('given below')
    );
  }, [question.question_text]);

  const isImageReviewRequired = mentionsDiagram && !question.question_image_url;

  // Answer Verification Status
  const pdfKey = (question.admin_notes?.match(/SOURCE_ANSWER:([A-D])/)?.[1] || '').toUpperCase();
  const currentAnswer = (question.correct_answer || '').toUpperCase();
  const isAnswerMatched = pdfKey && currentAnswer && pdfKey === currentAnswer;
  const isAnswerMismatch = pdfKey && currentAnswer && pdfKey !== currentAnswer;

  const handleImageFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingImg(true);
      const url = await uploadImage(file, 'question_images');
      handleFieldChange('question_image_url', url);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image.');
    } finally {
      setIsUploadingImg(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Editor Top Utility Bar */}
      <div className="flex flex-wrap items-center justify-between px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-sm">
            Q{question.source_question_number || '—'}
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-[11px] font-mono text-slate-500">
            Source: p.{question.source_page || 1}
          </span>

          {/* Confidence Pill */}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              question.confidence_level === 'HIGH'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : question.confidence_level === 'ERROR'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {question.confidence_level} ({question.confidence_score}%)
          </span>
        </div>

        {/* Quick Utilities: Undo, Redo, Clean Formatting, View Original */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo Edit (Ctrl+Z)"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 disabled:opacity-30 transition"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo Edit (Ctrl+Y)"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 disabled:opacity-30 transition"
          >
            <Redo2 size={14} />
          </button>

          <button
            type="button"
            onClick={handleSmartCleanup}
            title="Safely normalize spaces and line wrapping"
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition flex items-center gap-1 shadow-xs"
          >
            <Sparkles size={12} className="text-brand-600" />
            <span>Clean Formatting</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOriginalModal(true)}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition shadow-xs"
          >
            View Original
          </button>

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition flex items-center gap-1 shadow-xs"
          >
            <span>Details</span>
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Main Scrollable Document Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Banner: Image Review Required */}
        {isImageReviewRequired && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              <div>
                <span className="font-bold block">IMAGE / DIAGRAM REVIEW REQUIRED</span>
                <span className="text-[11px] text-amber-700">
                  This question appears to reference a figure or diagram. Please crop or attach the image.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onCropFromPdfRequest && (
                <button
                  type="button"
                  onClick={onCropFromPdfRequest}
                  className="px-3 py-1.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white transition flex items-center gap-1.5 shadow-xs"
                >
                  <Crop size={13} />
                  <span>Crop from PDF</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Collapsible Metadata Details Panel */}
        {showDetails && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Question Details & Taxonomy
              </span>
              <button
                type="button"
                onClick={handleResetQuestion}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                <RotateCcw size={11} />
                <span>Reset Question</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Target Exam</label>
                <select
                  value={question.exam}
                  onChange={(e) => handleFieldChange('exam', e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white outline-none"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.code}>
                      {ex.name} ({ex.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Subject</label>
                <select
                  value={question.subject}
                  onChange={(e) => handleFieldChange('subject', e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white outline-none"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Topic</label>
                <input
                  type="text"
                  value={question.topic || ''}
                  onChange={(e) => handleFieldChange('topic', e.target.value)}
                  placeholder="e.g. General"
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Difficulty</label>
                <select
                  value={question.difficulty}
                  onChange={(e) => handleFieldChange('difficulty', e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white outline-none"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Compact Answer Verification Card */}
        <div className="p-4 rounded-2xl border bg-slate-50/80 border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                PDF Answer Key:
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-white border border-slate-300 font-mono font-bold text-slate-900 text-sm">
                {pdfKey || 'N/A'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                Current Answer:
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-brand-50 border border-brand-300 font-mono font-bold text-brand-700 text-sm">
                {currentAnswer || 'None'}
              </span>
            </div>

            {/* Match / Mismatch Pill */}
            {isAnswerMatched && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 size={13} />
                MATCH
              </span>
            )}

            {isAnswerMismatch && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                <AlertTriangle size={13} />
                MISMATCH
              </span>
            )}
          </div>

          {/* Quick Resolution Buttons for Mismatch */}
          {isAnswerMismatch && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleFieldChange('correct_answer', pdfKey)}
                className="px-3 py-1 rounded-xl font-bold bg-brand-600 hover:bg-brand-500 text-white transition shadow-xs"
              >
                Use {pdfKey} (PDF Key)
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('answer_source', 'MANUAL')}
                className="px-3 py-1 rounded-xl font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition"
              >
                Keep {currentAnswer}
              </button>
            </div>
          )}
        </div>

        {/* Question Text Editor (Large clean document-style) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Question Statement
            </label>
            {question.is_duplicate && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                <AlertTriangle size={12} />
                Possible Duplicate ({question.duplicate_type || 'MATCH'})
              </span>
            )}
          </div>

          <textarea
            rows={4}
            value={question.question_text || ''}
            onChange={(e) => handleFieldChange('question_text', e.target.value)}
            placeholder="Type or edit the question statement..."
            className="w-full p-4 text-sm font-medium text-slate-900 border border-slate-200 rounded-2xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none leading-relaxed transition resize-y"
          />

          {/* Attached Diagram / Image */}
          {question.question_image_url && (
            <div className="relative inline-block border border-slate-200 rounded-2xl overflow-hidden p-1 bg-slate-50 group">
              <img
                src={question.question_image_url}
                alt="Question Diagram"
                className="max-h-48 max-w-full rounded-xl object-contain"
              />
              <button
                type="button"
                onClick={() => handleFieldChange('question_image_url', undefined)}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-rose-600/90 text-white opacity-0 group-hover:opacity-100 transition shadow-md"
                title="Remove diagram"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Options List (Spacious cards with direct radio selection) */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Answer Options (Click letter to select correct answer)
          </label>

          {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
            const fieldKey = `option_${optKey.toLowerCase()}_text` as keyof StagedQuestion;
            const isSelected = question.correct_answer === optKey;

            return (
              <div
                key={optKey}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-500'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {/* Clickable Radio Button with Shortcut Hint */}
                <button
                  type="button"
                  onClick={() => handleFieldChange('correct_answer', optKey)}
                  className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 transition ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={`Select Option ${optKey} as correct (Alt + ${optKey === 'A' ? 1 : optKey === 'B' ? 2 : optKey === 'C' ? 3 : 4})`}
                >
                  <span className="text-sm leading-none">{optKey}</span>
                  <span className="text-[9px] opacity-70 leading-none mt-0.5">
                    Alt+{optKey === 'A' ? 1 : optKey === 'B' ? 2 : optKey === 'C' ? 3 : 4}
                  </span>
                </button>

                {/* Option Text Input */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={(question[fieldKey] as string) || ''}
                    onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                    placeholder={`Enter option ${optKey} text...`}
                    className="w-full text-sm font-medium text-slate-900 bg-transparent border-0 outline-none p-1 placeholder:text-slate-300"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation Editor */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Detailed Solution & Explanation
          </label>
          <textarea
            rows={3}
            value={question.explanation_text || ''}
            onChange={(e) => handleFieldChange('explanation_text', e.target.value)}
            placeholder="Type or paste the step-by-step mathematical or conceptual explanation..."
            className="w-full p-4 text-sm font-medium text-slate-900 border border-slate-200 rounded-2xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none leading-relaxed transition resize-y"
          />
        </div>
      </div>

      {/* View Original Comparison Modal */}
      {showOriginalModal && originalRef.current && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-3xl w-full rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Original Extraction vs Current Edited Version
              </h3>
              <button
                type="button"
                onClick={() => setShowOriginalModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
                  Original Extracted Text
                </span>
                <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                  {originalRef.current.question_text || '(Empty)'}
                </p>
                <div className="pt-2 border-t border-slate-200 space-y-1 text-slate-600">
                  <div><strong>(A)</strong> {originalRef.current.option_a_text}</div>
                  <div><strong>(B)</strong> {originalRef.current.option_b_text}</div>
                  <div><strong>(C)</strong> {originalRef.current.option_c_text}</div>
                  <div><strong>(D)</strong> {originalRef.current.option_d_text}</div>
                </div>
              </div>

              <div className="p-4 bg-brand-50/50 border border-brand-200 rounded-xl space-y-2">
                <span className="font-bold text-brand-700 uppercase tracking-wider block text-[10px]">
                  Current Version
                </span>
                <p className="whitespace-pre-wrap leading-relaxed text-slate-900">
                  {question.question_text || '(Empty)'}
                </p>
                <div className="pt-2 border-t border-brand-200 space-y-1 text-slate-800">
                  <div><strong>(A)</strong> {question.option_a_text}</div>
                  <div><strong>(B)</strong> {question.option_b_text}</div>
                  <div><strong>(C)</strong> {question.option_c_text}</div>
                  <div><strong>(D)</strong> {question.option_d_text}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  handleResetQuestion();
                  setShowOriginalModal(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
              >
                Reset to Original
              </button>
              <button
                type="button"
                onClick={() => setShowOriginalModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
              >
                Keep Current Edits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
