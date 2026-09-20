import React, { useState, useEffect } from 'react';
import {
  StagedQuestion,
  Exam,
  Subject,
  Topic,
  ConfidenceLevel,
  AnswerSource
} from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Image as ImageIcon,
  Save,
  Check,
  SkipForward,
  Trash2,
  ExternalLink,
  Copy,
  ChevronRight,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { uploadImage } from '../../firebase/storage';

interface QuestionEditorPaneProps {
  question: StagedQuestion | null;
  exams: Exam[];
  subjects: Subject[];
  topics: Topic[];
  onSave: (updated: StagedQuestion) => void;
  onApproveAndNext: (updated: StagedQuestion) => void;
  onSkip: () => void;
  onReject: () => void;
  onResolveDuplicate?: () => void;
  isSaving?: boolean;
}

export const QuestionEditorPane: React.FC<QuestionEditorPaneProps> = ({
  question,
  exams,
  subjects,
  topics,
  onSave,
  onApproveAndNext,
  onSkip,
  onReject,
  onResolveDuplicate,
  isSaving = false,
}) => {
  const [form, setForm] = useState<StagedQuestion | null>(question);
  const [isUploadingImg, setIsUploadingImg] = useState(false);

  useEffect(() => {
    setForm(question);
  }, [question]);

  if (!form) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
        <Clock size={36} className="text-slate-600 mb-2" />
        <p className="text-sm font-semibold text-slate-300">No Question Selected</p>
        <p className="text-xs text-slate-500 mt-1">Select a question from the queue or click Next to review.</p>
      </div>
    );
  }

  const handleFieldChange = (field: keyof StagedQuestion, val: any) => {
    setForm((prev) => (prev ? { ...prev, [field]: val } : null));
  };

  const handleImageFilePick = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetField: 'question_image_url' | 'option_a_image_url' | 'option_b_image_url' | 'option_c_image_url' | 'option_d_image_url' | 'explanation_image_url'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingImg(true);
      const url = await uploadImage(file, 'question_images');
      handleFieldChange(targetField, url);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImg(false);
    }
  };

  // Confidence Pill Color
  const getConfidenceBadge = (level: ConfidenceLevel, score: number) => {
    if (level === 'HIGH') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800 flex items-center gap-1.5 shadow-xs">
          <CheckCircle2 size={13} />
          HIGH ({score}%)
        </span>
      );
    }
    if (level === 'MEDIUM') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-400 border border-amber-800 flex items-center gap-1.5 shadow-xs">
          <AlertTriangle size={13} />
          MEDIUM ({score}%)
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-950/80 text-red-400 border border-red-800 flex items-center gap-1.5 shadow-xs">
        <XCircle size={13} />
        LOW / ERROR ({score}%)
      </span>
    );
  };

  // Answer Source Badge
  const getAnswerSourceBadge = (source: AnswerSource) => {
    if (source === 'SOURCE_ANSWER') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700">
          Source Answer Key
        </span>
      );
    }
    if (source === 'AI_INFERRED') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-900/60 text-amber-300 border border-amber-700">
          AI Inferred (Verify)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-900/60 text-red-300 border border-red-700">
        Unresolved Key
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-slate-200">
      {/* Header Info & Badges */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {getConfidenceBadge(form.confidence_level, form.confidence_score)}
          {getAnswerSourceBadge(form.answer_source)}
          {form.is_duplicate && (
            <button
              onClick={onResolveDuplicate}
              className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-900/80 text-purple-300 border border-purple-700 hover:bg-purple-800 transition flex items-center gap-1"
            >
              <Copy size={11} />
              Duplicate ({form.duplicate_type || 'Match'})
            </button>
          )}
        </div>

        {/* Source Traceability Banner */}
        <div className="text-[11px] text-slate-400 font-mono bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
          Source: <span className="text-slate-200 font-semibold">{form.source_pdf}</span> • Page{' '}
          <span className="text-brand-400 font-bold">{form.source_page}</span> • Q#
          <span className="text-emerald-400 font-bold">{form.source_question_number}</span>
        </div>
      </div>

      {/* Validation Warnings Box */}
      {form.validation_warnings && form.validation_warnings.length > 0 && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-300 text-xs flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle size={14} className="text-amber-400" />
            <span>Validation Flags ({form.validation_warnings.length}):</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-200/90 pl-1 text-[11px]">
            {form.validation_warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Question Text */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">
            Question Text <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={3}
            value={form.question_text}
            onChange={(e) => handleFieldChange('question_text', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-brand-500 font-sans leading-relaxed transition"
            placeholder="Type or edit question text..."
          />
        </div>

        {/* Question Image */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
              <ImageIcon size={13} />
              Question Diagram / Image URL (Optional)
            </label>
            <label className="text-[11px] text-brand-400 hover:text-brand-300 cursor-pointer font-semibold">
              <span>+ Upload Image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageFilePick(e, 'question_image_url')}
              />
            </label>
          </div>
          <input
            type="text"
            value={form.question_image_url || ''}
            onChange={(e) => handleFieldChange('question_image_url', e.target.value)}
            placeholder="https://... or uploaded image URL"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
          />
          {form.question_image_url && (
            <div className="mt-2 p-2 bg-slate-950 border border-slate-800 rounded-lg inline-block">
              <img
                src={form.question_image_url}
                alt="Question Preview"
                className="max-h-28 rounded object-contain"
              />
            </div>
          )}
        </div>

        {/* Options A - D */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(['A', 'B', 'C', 'D'] as const).map((opt) => {
            const textField = `option_${opt.toLowerCase()}_text` as keyof StagedQuestion;
            const imgField = `option_${opt.toLowerCase()}_image_url` as keyof StagedQuestion;
            const isCorrect = form.correct_answer === opt;

            return (
              <div
                key={opt}
                className={`p-3 rounded-xl border transition-all ${
                  isCorrect
                    ? 'bg-emerald-950/30 border-emerald-600 shadow-xs'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {opt}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('correct_answer', opt)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                      isCorrect
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {isCorrect ? '✓ Correct Answer' : 'Set Correct'}
                  </button>
                </div>
                <input
                  type="text"
                  value={(form[textField] as string) || ''}
                  onChange={(e) => handleFieldChange(textField, e.target.value)}
                  placeholder={`Option ${opt} text...`}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Explanation / Solution
          </label>
          <textarea
            rows={2}
            value={form.explanation_text || ''}
            onChange={(e) => handleFieldChange('explanation_text', e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-sans"
            placeholder="Detailed explanation, formula, or steps..."
          />
        </div>

        {/* Taxonomy & Metadata Selectors */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Exam</label>
            <input
              type="text"
              value={form.exam || ''}
              onChange={(e) => handleFieldChange('exam', e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Subject</label>
            <input
              type="text"
              value={form.subject || ''}
              onChange={(e) => handleFieldChange('subject', e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Topic</label>
            <input
              type="text"
              value={form.topic || ''}
              onChange={(e) => handleFieldChange('topic', e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Difficulty</label>
            <select
              value={form.difficulty || 'Medium'}
              onChange={(e) => handleFieldChange('difficulty', e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>
      </div>

      {/* Action Buttons Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReject}
            className="px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-950/40 border border-red-900/50 transition flex items-center gap-1.5"
            title="Shortcut: Delete"
          >
            <Trash2 size={14} />
            Reject
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800 transition flex items-center gap-1.5"
            title="Shortcut: Right Arrow"
          >
            <SkipForward size={14} />
            Skip
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5"
            title="Shortcut: Cmd+S / Ctrl+S"
          >
            <Save size={14} />
            Save
          </button>

          <button
            type="button"
            onClick={() => onApproveAndNext(form)}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 transition flex items-center gap-2"
            title="Shortcut: Enter / Cmd+Enter"
          >
            <Check size={16} />
            Approve & Next
          </button>
        </div>
      </div>
    </div>
  );
};
