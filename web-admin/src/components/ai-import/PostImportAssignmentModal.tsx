import React, { useState } from 'react';
import { Question, MockTest, Exam } from '../../types';
import { Modal } from '../common/Modal';
import { assignQuestionsToMockTest, assignQuestionToPractice } from '../../utils/questionUsage';
import {
  CheckCircle2,
  BookOpen,
  FileCheck,
  Plus,
  Layers,
  ArrowRight,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface PostImportAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  importedQuestions: Question[];
  mockTests: MockTest[];
  exams: Exam[];
  onNavigateToTab?: (tab: string) => void;
  onComplete?: () => void;
}

export const PostImportAssignmentModal: React.FC<PostImportAssignmentModalProps> = ({
  isOpen,
  onClose,
  importedQuestions,
  mockTests,
  exams,
  onNavigateToTab,
  onComplete,
}) => {
  const [selectedAction, setSelectedAction] = useState<
    'NONE' | 'PRACTICE' | 'EXISTING_MOCK' | 'NEW_MOCK'
  >('NONE');

  const [selectedExam, setSelectedExam] = useState<string>(exams[0]?.code || 'ANCHSL');
  const [selectedMockId, setSelectedMockId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const availableMocks = mockTests.filter(
    (m) => !selectedExam || m.examCode?.toUpperCase() === selectedExam.toUpperCase()
  );

  const handleApplyAction = async () => {
    setIsProcessing(true);
    setFeedbackMsg(null);

    try {
      const qIds = importedQuestions.map((q) => q.id);

      if (selectedAction === 'PRACTICE') {
        for (const q of importedQuestions) {
          await assignQuestionToPractice(q, false);
        }
        setFeedbackMsg({
          type: 'success',
          text: `Successfully configured ${importedQuestions.length} questions for Student Practice!`,
        });
        setTimeout(() => {
          onClose();
          if (onComplete) onComplete();
          if (onNavigateToTab) onNavigateToTab('practice-questions');
        }, 1200);
      } else if (selectedAction === 'EXISTING_MOCK') {
        if (!selectedMockId) {
          throw new Error('Please select a destination Mock Test.');
        }
        const res = await assignQuestionsToMockTest(qIds, selectedMockId, mockTests, importedQuestions);
        setFeedbackMsg({
          type: 'success',
          text: `Successfully assigned ${res.newlyAssignedCount} questions to "${res.updatedMock.title}"! (Total now: ${res.updatedMock.totalQuestions} Qs)`,
        });
        setTimeout(() => {
          onClose();
          if (onComplete) onComplete();
          if (onNavigateToTab) onNavigateToTab('test-builder');
        }, 1500);
      } else if (selectedAction === 'NEW_MOCK') {
        onClose();
        if (onNavigateToTab) onNavigateToTab('tests');
      } else {
        onClose();
        if (onComplete) onComplete();
      }
    } catch (err: any) {
      console.error('Post-import action error:', err);
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to process assignment.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Complete" maxWidth="xl">
      <div className="space-y-6 text-slate-800">
        {/* Success Header */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-emerald-600/25">
            <CheckCircle2 size={26} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-emerald-950">
              {importedQuestions.length} Questions Added to Question Bank!
            </h3>
            <p className="text-xs text-emerald-700 mt-0.5">
              Every question has been committed to the central master repository.
            </p>
          </div>
        </div>

        {feedbackMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Action Choice Prompt */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            What do you want to do with these questions?
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. Add to Practice */}
            <label
              className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 select-none ${
                selectedAction === 'PRACTICE'
                  ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="postImportAction"
                checked={selectedAction === 'PRACTICE'}
                onChange={() => setSelectedAction('PRACTICE')}
                className="mt-1 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-brand-600" />
                  <span>Add to Practice</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Publish immediately to student app's subject practice modules.
                </p>
              </div>
            </label>

            {/* 2. Add to Existing Mock Test */}
            <label
              className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 select-none ${
                selectedAction === 'EXISTING_MOCK'
                  ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="postImportAction"
                checked={selectedAction === 'EXISTING_MOCK'}
                onChange={() => setSelectedAction('EXISTING_MOCK')}
                className="mt-1 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <FileCheck size={14} className="text-indigo-600" />
                  <span>Add to Existing Mock</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Attach questions directly to an existing mock test exam.
                </p>
              </div>
            </label>

            {/* 3. Create New Mock Test */}
            <label
              className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 select-none ${
                selectedAction === 'NEW_MOCK'
                  ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="postImportAction"
                checked={selectedAction === 'NEW_MOCK'}
                onChange={() => setSelectedAction('NEW_MOCK')}
                className="mt-1 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Plus size={14} className="text-emerald-600" />
                  <span>Create New Mock Test</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Navigate to Mock Tests to construct a fresh test series.
                </p>
              </div>
            </label>

            {/* 4. Keep in Question Bank Only */}
            <label
              className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-start gap-3 select-none ${
                selectedAction === 'NONE'
                  ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="postImportAction"
                checked={selectedAction === 'NONE'}
                onChange={() => setSelectedAction('NONE')}
                className="mt-1 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Layers size={14} className="text-slate-600" />
                  <span>Question Bank Only</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Keep in master repository for later assignment or assembly.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Dynamic Selectors for Existing Mock Test */}
        {selectedAction === 'EXISTING_MOCK' && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-fadeIn text-xs">
            <span className="font-bold text-slate-700 block">Select Destination Mock Test</span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Target Exam</label>
                <select
                  value={selectedExam}
                  onChange={(e) => {
                    setSelectedExam(e.target.value);
                    setSelectedMockId('');
                  }}
                  className="w-full p-2 border border-slate-200 rounded-xl bg-white outline-none font-semibold"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.code}>
                      {ex.name} ({ex.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Mock Test</label>
                <select
                  value={selectedMockId}
                  onChange={(e) => setSelectedMockId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl bg-white outline-none font-semibold"
                >
                  <option value="">-- Choose Mock Test --</option>
                  {availableMocks.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.totalQuestions || 0} Qs)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
          >
            Skip / Done
          </button>

          <button
            type="button"
            onClick={handleApplyAction}
            disabled={isProcessing}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/25 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing && <Loader2 size={14} className="animate-spin" />}
            <span>Confirm & Continue</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Modal>
  );
};
