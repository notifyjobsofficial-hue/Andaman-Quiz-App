import React, { useState, useEffect, useMemo } from 'react';
import { Question, MockTest, Exam, Subject, Topic } from '../../types';
import { Modal } from '../common/Modal';
import {
  computeQuestionUsage,
  assignQuestionToPractice,
  removeQuestionFromPractice,
  assignQuestionsToMockTest,
  removeQuestionsFromMockTest,
} from '../../utils/questionUsage';
import { PracticeDestinationSelector } from '../practice/PracticeDestinationSelector';
import {
  CheckCircle2,
  AlertCircle,
  BookOpen,
  FileCheck,
  Search,
  Filter,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface AssignToModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  mockTests: MockTest[];
  exams: Exam[];
  subjects: Subject[];
  topics: Topic[];
  onAssigned: () => void;
  onOpenSubjectsTopics?: () => void;
}

export const AssignToModal: React.FC<AssignToModalProps> = ({
  isOpen,
  onClose,
  questions,
  mockTests,
  exams,
  subjects,
  topics,
  onAssigned,
  onOpenSubjectsTopics,
}) => {
  const isSingle = questions.length === 1;
  const singleQ = isSingle ? questions[0] : null;

  // Single question initial usage calculation
  const singleUsage = useMemo(() => {
    if (!singleQ) return null;
    return computeQuestionUsage(singleQ, mockTests);
  }, [singleQ, mockTests]);

  // Distinct Exams in selection (for bulk safety check)
  const distinctExams = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      const code = (q.exam || '').trim();
      if (code) set.add(code);
    });
    return Array.from(set);
  }, [questions]);

  const hasMixedExams = distinctExams.length > 1;
  const primaryExamCode = useMemo(() => {
    if (isSingle && singleQ?.exam) return singleQ.exam.trim();
    if (distinctExams.length === 1) return distinctExams[0];
    return exams[0]?.code || 'ANCHSL';
  }, [isSingle, singleQ, distinctExams, exams]);

  const primaryExamName = useMemo(() => {
    const found = exams.find(
      (e) => e.code.toLowerCase() === primaryExamCode.toLowerCase() || e.name.toLowerCase() === primaryExamCode.toLowerCase()
    );
    return found ? `${found.name} (${found.code})` : primaryExamCode;
  }, [exams, primaryExamCode]);

  // Practice selection state
  const [assignPractice, setAssignPractice] = useState<boolean>(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

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

    if (singleQ) {
      const inPrac = singleUsage ? singleUsage.inPractice : true;
      setAssignPractice(inPrac);

      // Resolve existing subject
      let subId = singleQ.subjectId || '';
      let subObj = subjects.find((s) => s.id === subId);
      if (!subObj && singleQ.subject) {
        subObj = subjects.find(
          (s) => s.name.trim().toLowerCase() === singleQ.subject.trim().toLowerCase()
        );
        if (subObj) subId = subObj.id;
      }
      setSelectedSubjectId(subId);
      setSelectedSubject(subObj || null);

      // Resolve existing topic
      let topId = singleQ.topicId || '';
      let topObj = topics.find((t) => t.id === topId);
      if (!topObj && singleQ.topic && subId) {
        topObj = topics.find(
          (t) =>
            t.subjectId === subId &&
            t.name.trim().toLowerCase() === singleQ.topic.trim().toLowerCase()
        );
        if (topObj) topId = topObj.id;
      }
      setSelectedTopicId(topId);
      setSelectedTopic(topObj || null);

      if (singleUsage) {
        setSelectedMockIds(new Set(singleUsage.mockTests.map((m) => m.id)));
      } else {
        setSelectedMockIds(new Set());
      }

      if (singleQ.exam) {
        setExamFilter(singleQ.exam);
      }
    } else {
      // Bulk default
      if (hasMixedExams) {
        setAssignPractice(false);
      } else {
        setAssignPractice(true);
      }
      setSelectedSubjectId('');
      setSelectedSubject(null);
      setSelectedTopicId('');
      setSelectedTopic(null);
      setSelectedMockIds(new Set());
      setExamFilter('ALL');
    }
  }, [isOpen, singleQ, singleUsage, subjects, topics, hasMixedExams]);

  // Handle Subject selection from PracticeDestinationSelector
  const handleSubjectChange = (sub: Subject | null) => {
    setSelectedSubject(sub);
    setSelectedSubjectId(sub ? sub.id : '');
    setSelectedTopic(null);
    setSelectedTopicId('');
    setErrorMsg(null);
  };

  // Handle Topic selection from PracticeDestinationSelector
  const handleTopicChange = (top: Topic | null) => {
    setSelectedTopic(top);
    setSelectedTopicId(top ? top.id : '');
    setErrorMsg(null);
  };

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
      // 1. Validation for Practice Assignment
      if (assignPractice) {
        if (hasMixedExams) {
          throw new Error(
            'Selected questions belong to multiple Exams. Practice Subject/Topic assignment can only be applied to questions from the same Exam. Filter or select questions from one Exam first.'
          );
        }

        if (!selectedSubject) {
          throw new Error('Please select an existing Subject for Practice assignment.');
        }

        if (!selectedTopic) {
          throw new Error('Please select an existing Topic for Practice assignment.');
        }
      }

      const qIds = questions.map((q) => q.id);

      // 2. Process Practice Assignment or Removal on canonical Question records
      for (const q of questions) {
        // Evaluate future mock presence for this question
        const willBeInMocks = isSingle
          ? selectedMockIds.size > 0
          : selectedMockIds.size > 0 || mockTests.some((m) => m.sections?.some((sec) => sec.questionIds?.includes(q.id)));

        if (assignPractice && selectedSubject && selectedTopic) {
          // Assign to Practice hierarchy while preserving status and ID
          await assignQuestionToPractice(q, willBeInMocks, {
            subject: selectedSubject.name,
            subjectId: selectedSubject.id,
            topic: selectedTopic.name,
            topicId: selectedTopic.id,
          });
        } else {
          // Remove from Practice: recalculates true mock relationship
          // If in >= 1 mock -> MOCK. If in 0 mocks -> NOT_USED.
          // NEVER deletes question.
          await removeQuestionFromPractice(q, willBeInMocks);
        }
      }

      // 3. Process Mock Test Assignments via canonical mock.sections[].questionIds
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
        // Bulk mode: assign selected questions to all checked mocks
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

  const hasDraftQuestions = isSingle
    ? singleQ?.status === 'draft'
    : questions.some((q) => q.status === 'draft');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSingle ? 'Direct Question Assignment' : `Assign ${questions.length} Questions`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Question Preview for Single Question */}
        {isSingle && singleQ && (
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
            <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
              Question Preview:
            </span>
            <p className="font-medium text-slate-800 line-clamp-2 leading-relaxed">
              {singleQ.question_text || '(Image / Diagram Question)'}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Exam: {singleQ.exam || 'Unassigned'}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700">Current Subject: {singleQ.subject || 'None'}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700">Current Topic: {singleQ.topic || 'None'}</span>
              <span>•</span>
              <span className={`px-2 py-0.2 rounded font-bold uppercase text-[10px] ${
                singleQ.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {singleQ.status || 'published'}
              </span>
            </div>
          </div>
        )}

        {/* SECTION 1: Practice Questions */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <label className={`flex items-center gap-2.5 ${hasMixedExams ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer select-none'}`}>
              <input
                type="checkbox"
                checked={assignPractice}
                disabled={hasMixedExams}
                onChange={(e) => {
                  if (!hasMixedExams) {
                    setAssignPractice(e.target.checked);
                    setErrorMsg(null);
                  }
                }}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-brand-600" />
                <span className="font-bold text-sm text-slate-900">Assign to Student Practice</span>
              </div>
            </label>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              assignPractice && !hasMixedExams
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {assignPractice && !hasMixedExams ? 'Eligible for Practice' : 'Excluded from Practice'}
            </span>
          </div>

          {/* Mixed-Exam Bulk Safety Guard */}
          {hasMixedExams && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">
                  Selected questions belong to multiple Exams: {distinctExams.join(', ')}
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Practice Subject/Topic assignment can only be applied to questions from the same Exam.
                  Filter or select questions from one Exam first. You may still assign these questions to Mock Tests below.
                </p>
              </div>
            </div>
          )}

          {/* Practice Destination Selector (Shown when Practice is enabled and exams are uniform) */}
          {assignPractice && !hasMixedExams && (
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <PracticeDestinationSelector
                examCode={primaryExamCode}
                examName={primaryExamName}
                selectedSubjectId={selectedSubjectId}
                selectedTopicId={selectedTopicId}
                onSubjectChange={handleSubjectChange}
                onTopicChange={handleTopicChange}
                subjects={subjects}
                topics={topics}
                required={true}
                onOpenSubjectsTopics={onOpenSubjectsTopics}
              />
            </div>
          )}

          {/* Draft Status Notice (Publication Independence) */}
          {assignPractice && hasDraftQuestions && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Publication Independence: Status is Draft</span>
                <span className="text-[11px] text-amber-700 leading-relaxed block mt-0.5">
                  Assigning to Practice organizes where this question belongs, but will NOT automatically publish it.
                  It will become available in the student app only once its status is explicitly set to Published.
                </span>
              </div>
            </div>
          )}
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
            Select one or multiple Mock Tests. Canonical section references (<code>mock.sections[].questionIds</code>) will be updated without duplicating question records.
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
          <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
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
            disabled={isSaving || (assignPractice && !hasMixedExams && (!selectedSubjectId || !selectedTopicId))}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            <span>Save Assignment</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
