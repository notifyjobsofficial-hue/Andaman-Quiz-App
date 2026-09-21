import React, { useState } from 'react';
import { StagedQuestion, PdfImportJob, Question, MockTest, Exam } from '../../types';
import { publishApprovedQuestionsToQuestionBank } from '../../services/aiImportService';
import { PostImportAssignmentModal } from './PostImportAssignmentModal';
import {
  CheckCircle2,
  UploadCloud,
  Loader2,
  BookOpen,
  ArrowRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface ApprovedTabProps {
  job: PdfImportJob | null;
  stagedQuestions: StagedQuestion[];
  mockTests?: MockTest[];
  exams?: Exam[];
  onRefresh: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const ApprovedTab: React.FC<ApprovedTabProps> = ({
  job,
  stagedQuestions,
  mockTests = [],
  exams = [],
  onRefresh,
  onNavigateToTab,
}) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [resultFeedback, setResultFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [publishedQuestionsForModal, setPublishedQuestionsForModal] = useState<Question[] | null>(null);

  const approvedQuestions = stagedQuestions.filter((q) => q.review_status === 'approved');
  const alreadyPublishedCount = approvedQuestions.filter((q) => !!q.published_question_id).length;
  const pendingPublishCount = approvedQuestions.length - alreadyPublishedCount;

  const handlePublish = async () => {
    if (!job || approvedQuestions.length === 0) return;

    setIsPublishing(true);
    setResultFeedback(null);

    try {
      const res = await publishApprovedQuestionsToQuestionBank(job.id, approvedQuestions);
      if (res.errors.length > 0) {
        setResultFeedback({
          type: 'error',
          message: `Published ${res.publishedCount} questions, but encountered errors: ${res.errors.join('; ')}`,
        });
      } else {
        setResultFeedback({
          type: 'success',
          message: `Successfully published ${res.publishedCount} approved questions directly to the public Question Bank!`,
        });
      }
      onRefresh();
      if (res.publishedQuestions && res.publishedQuestions.length > 0) {
        setPublishedQuestionsForModal(res.publishedQuestions);
      }
    } catch (err: any) {
      console.error('Publish error:', err);
      setResultFeedback({
        type: 'error',
        message: err.message || 'Failed to publish questions to Question Bank',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-slate-200 py-4">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
            <h3 className="font-bold text-base text-white">Approved Staging Area</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            These questions have passed human administrator review and are ready for official commitment into the Question Bank.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-400 block text-[10px]">Ready to Publish</span>
            <span className="text-base font-bold text-emerald-400">{pendingPublishCount} Qs</span>
          </div>

          <button
            onClick={handlePublish}
            disabled={pendingPublishCount === 0 || isPublishing}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white shadow-lg shadow-emerald-900/40 transition flex items-center gap-2"
          >
            {isPublishing ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Publishing in Batches...
              </>
            ) : (
              <>
                <UploadCloud size={15} />
                Commit {pendingPublishCount} to Question Bank
              </>
            )}
          </button>
        </div>
      </div>

      {resultFeedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            resultFeedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-red-950/60 border-red-800 text-red-300'
          }`}
        >
          {resultFeedback.type === 'success' ? <Sparkles size={16} /> : <AlertCircle size={16} />}
          <span>{resultFeedback.message}</span>
        </div>
      )}

      {/* List of Approved Questions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h4 className="font-bold text-sm text-white border-b border-slate-800 pb-3">
          Approved Questions List ({approvedQuestions.length})
        </h4>

        {approvedQuestions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No questions approved yet. Head to the Review Queue to review and approve extracted questions.
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {approvedQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-400 font-bold">
                    #{idx + 1} • P.{q.source_page} Q#{q.source_question_number}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                      {q.exam} • {q.subject}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold text-[10px] border border-emerald-800">
                      Answer: {q.correct_answer}
                    </span>
                    {q.published_question_id && (
                      <span className="px-2 py-0.5 rounded bg-brand-950 text-brand-400 font-bold text-[10px] border border-brand-800">
                        Published
                      </span>
                    )}
                  </div>
                </div>

                <p className="font-medium text-slate-200">{q.question_text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Post-Import Assignment Choice Modal */}
      <PostImportAssignmentModal
        isOpen={!!publishedQuestionsForModal}
        onClose={() => setPublishedQuestionsForModal(null)}
        importedQuestions={publishedQuestionsForModal || []}
        mockTests={mockTests}
        exams={exams}
        onNavigateToTab={onNavigateToTab}
        onComplete={() => {
          setPublishedQuestionsForModal(null);
          onRefresh();
        }}
      />
    </div>
  );
};
