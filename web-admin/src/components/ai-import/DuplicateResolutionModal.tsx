import React from 'react';
import { StagedQuestion, Question } from '../../types';
import { AlertTriangle, Copy, X, Check, ArrowRight } from 'lucide-react';

interface DuplicateResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  incomingQuestion: StagedQuestion;
  existingQuestion?: Question | StagedQuestion | null;
  onResolve: (action: 'keep_existing' | 'replace_existing' | 'import_anyway') => void;
}

export const DuplicateResolutionModal: React.FC<DuplicateResolutionModalProps> = ({
  isOpen,
  onClose,
  incomingQuestion,
  existingQuestion,
  onResolve,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 text-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400">
              <Copy size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base">Duplicate Question Resolution</h3>
              <p className="text-xs text-slate-400">
                Compare incoming extracted question with existing question in the system.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Side-by-Side Comparison */}
        <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Existing Question */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
              <span className="font-bold text-slate-300">Existing Question In Bank</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px] font-mono">
                ID: {existingQuestion?.id || 'Unknown'}
              </span>
            </div>

            <p className="font-semibold text-slate-200 mb-3 bg-slate-900/60 p-2.5 rounded-lg">
              {existingQuestion?.question_text || '(No text available)'}
            </p>

            <div className="space-y-1.5 flex-1">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const optKey = `option_${opt.toLowerCase()}_text` as keyof typeof existingQuestion;
                const isCorrect = existingQuestion?.correct_answer === opt;
                return (
                  <div
                    key={opt}
                    className={`p-2 rounded-lg border ${
                      isCorrect
                        ? 'bg-emerald-950/40 border-emerald-700 text-emerald-200'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="font-bold mr-2">{opt}:</span>
                    <span>{(existingQuestion as any)?.[optKey] || '-'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Incoming Staged Question */}
          <div className="bg-slate-950 p-4 rounded-xl border border-brand-800/60 flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
              <span className="font-bold text-brand-400">Incoming Question (PDF Import)</span>
              <span className="px-2 py-0.5 rounded bg-brand-950 text-brand-400 text-[11px] font-mono border border-brand-800">
                P.{incomingQuestion.source_page} • Q#{incomingQuestion.source_question_number}
              </span>
            </div>

            <p className="font-semibold text-slate-200 mb-3 bg-slate-900/60 p-2.5 rounded-lg border border-brand-900/40">
              {incomingQuestion.question_text}
            </p>

            <div className="space-y-1.5 flex-1">
              {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                const optKey = `option_${opt.toLowerCase()}_text` as keyof StagedQuestion;
                const isCorrect = incomingQuestion.correct_answer === opt;
                return (
                  <div
                    key={opt}
                    className={`p-2 rounded-lg border ${
                      isCorrect
                        ? 'bg-emerald-950/40 border-emerald-700 text-emerald-200'
                        : 'bg-slate-900/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="font-bold mr-2">{opt}:</span>
                    <span>{(incomingQuestion as any)?.[optKey] || '-'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Choices */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => onResolve('keep_existing')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition"
          >
            Keep Existing (Reject Incoming)
          </button>

          <button
            type="button"
            onClick={() => onResolve('replace_existing')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-900/60 text-amber-300 hover:bg-amber-800 border border-amber-700 transition"
          >
            Replace Existing with Incoming
          </button>

          <button
            type="button"
            onClick={() => onResolve('import_anyway')}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md transition"
          >
            Import Anyway (Keep Both)
          </button>
        </div>
      </div>
    </div>
  );
};
