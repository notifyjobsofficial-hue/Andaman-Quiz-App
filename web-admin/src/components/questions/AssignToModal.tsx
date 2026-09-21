import React, { useState, useEffect, useMemo } from 'react';
import { Question, MockTest, Exam } from '../../types';
import { Modal } from '../common/Modal';
import {
  computeQuestionUsage,
  assignQuestionToPractice,
  removeQuestionFromPractice,
  assignQuestionsToMockTest,
  removeQuestionsFromMockTest,
} from '../../utils/questionUsage';
import {
  CheckCircle2,
  AlertCircle,
  BookOpen,
  FileCheck,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';

interface AssignToModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  mockTests: MockTest[];
  exams: Exam[];
  onAssigned: () => void;
}

export const AssignToModal: React.FC<AssignToModalProps> = ({
  isOpen,
  onClose,
  questions,
  mockTests,
  exams,
  onAssigned,
}) => {
  const isSingle = questions.length === 1;
  const singleQ = isSingle ? questions[0] : null;

  // Single question initial usage calculation
  const singleUsage = useMemo(() => {
    if (!singleQ) return null;
    return computeQuestionUsage(singleQ, mockTests);
  }, [singleQ, mockTests]);

  // Practice selection state
  const [assignPractice, setAssignPractice] = useState<boolean>(true);

  // Selected mock test IDs
  const [selectedMockIds, setSelectedMockIds] = useState<Set<string>>(new Set());

  // Filter for mock tests in modal
  const [examFilter, setExamFilter] = useState<string>('ALL');
  const [mockSearch, setMockSearch] = useState<string>('');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize selections when modal opens or questions change
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);

    if (singleUsage) {
      setAssignPractice(singleUsage.inPractice);
      setSelectedMockIds(new Set(singleUsage.mockTests.map((m) => m.id)));
      if (singleQ?.exam) {
        setExamFilter(singleQ.exam);
      }
    } else {
      // Bulk default
      setAssignPractice(true);
      setSelectedMockIds(new Set());
      setExamFilter('ALL');
    }
  }, [isOpen, singleUsage, singleQ]);

  // Filtered mock tests for the picker list
  const filteredMocks = useMemo(() => {
    return mockTests.filter((m) => {
      const matchesExam = examFilter === 'ALL' || m.examCode?.toUpperCase() === examFilter.toUpperCase();
      const matchesSearch = !mockSearch.trim() || m.title.toLowerCase().includes(mockSearch.toLowerCase());
      return matchesExam && matchesSearch;
    });
  }, [mockTests, examFilter, mockSearch]);

  const toggleMockSelection = (id: string) => {
    const next = new Set(selectedMockIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMockIds(next);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const qIds = questions.map((q) => q.id);

      // 1. Process Practice Assignment / Removal
      for (const q of questions) {
        const hasTaxonomy = !!(q.exam && q.subject);
        if (assignPractice) {
          if (!hasTaxonomy) {
            throw new Error(`Cannot assign question (${q.id}) to Practice: Missing Exam or Subject taxonomy.`);
          }
          await assignQuestionToPractice(q, selectedMockIds.size > 0);
        } else {
          await removeQuestionFromPractice(q, selectedMockIds.size > 0);
        }
      }

      // 2. Process Mock Test Assignments
      // Identify additions & removals for single question mode
      if (isSingle && singleUsage) {
        const initialMockIds = new Set(singleUsage.mockTests.map((m) => m.id));

        // Newly added mocks
        for (const mId of Array.from(selectedMockIds)) {
          if (!initialMockIds.has(mId)) {
            await assignQuestionsToMockTest(qIds, mId, mockTests, questions);
          }
        }

        // Removed mocks
        for (const mId of Array.from(initialMockIds)) {
          if (!selectedMockIds.has(mId)) {
            await removeQuestionsFromMockTest(qIds, mId, mockTests, questions);
          }
        }
      } else {
        // Bulk mode: assign to all selected mocks
        for (const mId of Array.from(selectedMockIds)) {
          await assignQuestionsToMockTest(qIds, mId, mockTests, questions);
        }
      }

      onAssigned();
      onClose();
    } catch (err: any) {
      console.error('Assignment error:', err);
      setErrorMsg(err?.message || 'Failed to update question assignments.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSingle ? 'Direct Question Assignment' : `Assign ${questions.length} Questions`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isSingle && singleQ && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <span className="text-slate-400 block font-semibold">Question Preview:</span>
            <p className="font-medium text-slate-800 line-clamp-2">{singleQ.question_text || 'No text content'}</p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Exam: {singleQ.exam || 'Unassigned'}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700">Subject: {singleQ.subject || 'Unassigned'}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700">Topic: {singleQ.topic || 'General'}</span>
            </div>
          </div>
        )}

        {/* SECTION 1: Practice Questions */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={assignPractice}
                onChange={(e) => setAssignPractice(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-brand-600" />
                <span className="font-bold text-sm text-slate-900">Student Practice</span>
              </div>
            </label>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              assignPractice ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
            }`}>
              {assignPractice ? 'Eligible for Practice' : 'Excluded from Practice'}
            </span>
          </div>
          <p className="text-xs text-slate-500 pl-6.5">
            When enabled, question(s) become discoverable and solvable inside the student app's "Practice by Subject" module.
          </p>
        </div>

        {/* SECTION 2: Mock Tests */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck size={16} className="text-indigo-600" />
              <span className="font-bold text-sm text-slate-900">Assign to Mock Tests</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {selectedMockIds.size} Selected
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Select one or multiple Mock Tests. Questions are added directly to the mock's section and mock question counts recalculate automatically.
          </p>

          {/* Exam & Search Filters inside modal */}
          <div className="flex flex-wrap gap-2 pt-1">
            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
              className="text-xs font-semibold p-2 border border-slate-200 rounded-lg bg-slate-50"
            >
              <option value="ALL">All Exams</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.code}>
                  {ex.name} ({ex.code})
                </option>
              ))}
            </select>

            <div className="relative flex-1 min-w-[150px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search mock test title..."
                value={mockSearch}
                onChange={(e) => setMockSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Mock Test List */}
          <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {filteredMocks.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No mock tests match the selected filters.
              </div>
            ) : (
              filteredMocks.map((m) => {
                const isSelected = selectedMockIds.has(m.id);
                const currentCount = m.totalQuestions ?? 0;

                return (
                  <label
                    key={m.id}
                    className={`flex items-center justify-between p-2.5 text-xs hover:bg-slate-50 transition cursor-pointer select-none ${
                      isSelected ? 'bg-brand-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMockSelection(m.id)}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">{m.title}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Exam: {m.examCode}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {currentCount} Qs
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/20 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            <span>Save Assignment</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
