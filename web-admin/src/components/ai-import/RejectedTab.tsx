import React from 'react';
import { StagedQuestion, PdfImportJob } from '../../types';
import { updateStagedQuestionStatus } from '../../services/aiImportService';
import { XCircle, RotateCcw, AlertTriangle } from 'lucide-react';

interface RejectedTabProps {
  job: PdfImportJob | null;
  stagedQuestions: StagedQuestion[];
  onRefresh: () => void;
}

export const RejectedTab: React.FC<RejectedTabProps> = ({
  job,
  stagedQuestions,
  onRefresh,
}) => {
  const rejectedQuestions = stagedQuestions.filter((q) => q.review_status === 'rejected');

  const handleRestore = async (questionId: string) => {
    if (!job) return;
    try {
      await updateStagedQuestionStatus(job.id, questionId, 'pending', 'Restored to review queue');
      onRefresh();
    } catch (err) {
      console.error('Failed to restore question:', err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-slate-200 py-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center text-red-400">
            <XCircle size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Rejected / Incomplete Questions</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Questions that failed validation or were manually rejected by an administrator.
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-xl bg-red-950 text-red-400 font-mono font-bold text-sm border border-red-800">
          {rejectedQuestions.length} Rejected
        </span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        {rejectedQuestions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No rejected questions in this import job.
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {rejectedQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 bg-slate-950 rounded-xl border border-red-950/60 text-xs space-y-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 font-bold">
                      #{idx + 1} • P.{q.source_page} Q#{q.source_question_number}
                    </span>
                    {q.admin_notes && (
                      <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 text-[10px] font-semibold border border-red-800">
                        {q.admin_notes}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-slate-300">{q.question_text}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestore(q.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RotateCcw size={13} />
                  Restore to Queue
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
