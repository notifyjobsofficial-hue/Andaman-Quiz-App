import React from 'react';
import { StagedQuestion } from '../../types';
import { ShieldCheck, AlertTriangle, X, Check } from 'lucide-react';

interface BulkApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: StagedQuestion[];
  onConfirm: (eligibleQuestions: StagedQuestion[]) => void;
  isProcessing?: boolean;
}

export const BulkApprovalModal: React.FC<BulkApprovalModalProps> = ({
  isOpen,
  onClose,
  questions,
  onConfirm,
  isProcessing = false,
}) => {
  if (!isOpen) return null;

  // Strict Deterministic Safety Filter:
  // ONLY questions that are HIGH confidence, have exactly 4 options, valid correct answer,
  // NO answer conflicts/inferences, NO duplicates, and ZERO critical warnings.
  const eligibleQuestions = questions.filter((q) => {
    if (q.confidence_level !== 'HIGH') return false;
    if (!['A', 'B', 'C', 'D'].includes(q.correct_answer)) return false;
    if (q.answer_source !== 'SOURCE_ANSWER') return false;
    if (q.is_duplicate) return false;
    if (!q.option_a_text || !q.option_b_text || !q.option_c_text || !q.option_d_text) return false;
    if (q.validation_warnings && q.validation_warnings.length > 0) return false;
    return true;
  });

  const excludedCount = questions.length - eligibleQuestions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base">Safe Bulk Approval</h3>
              <p className="text-xs text-slate-400">Deterministic Safety Verification Guard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Counts & Information */}
        <div className="py-4 space-y-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">Total Filtered Questions:</span>
            <span className="font-bold text-white font-mono">{questions.length} questions</span>
          </div>

          <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-800/80 flex items-center justify-between text-emerald-300">
            <div>
              <span className="font-bold block">Safe Candidates Eligible:</span>
              <span className="text-[11px] text-emerald-400/80">
                100% complete, verified answer key, zero warnings
              </span>
            </div>
            <span className="font-bold text-base font-mono text-emerald-400">
              {eligibleQuestions.length}
            </span>
          </div>

          {excludedCount > 0 && (
            <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-800/80 flex items-center justify-between text-amber-300">
              <div>
                <span className="font-bold block">Excluded (Requires Manual Review):</span>
                <span className="text-[11px] text-amber-400/80">
                  Missing answers, duplicates, or extraction warnings
                </span>
              </div>
              <span className="font-bold text-base font-mono text-amber-400">
                {excludedCount}
              </span>
            </div>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            By confirming, <strong className="text-white">{eligibleQuestions.length} questions</strong> will
            be marked as <span className="text-emerald-400 font-bold">Approved</span> in staging. They will NOT be
            published to the public app until you choose to commit them to the Question Bank.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white border border-slate-800 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={eligibleQuestions.length === 0 || isProcessing}
            onClick={() => onConfirm(eligibleQuestions)}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-900/40 transition flex items-center gap-1.5"
          >
            <Check size={16} />
            Approve {eligibleQuestions.length} Safe Questions
          </button>
        </div>
      </div>
    </div>
  );
};
