import React, { useState, useEffect, useMemo } from 'react';
import { Question, MockTest, Exam, Subject, Topic } from '../../types';
import { Modal } from '../common/Modal';
import { assignQuestionsToMockTest, assignQuestionToPractice } from '../../utils/questionUsage';
import { fetchSubjects, fetchTopics } from '../../firebase/firestore';
import { PracticeDestinationSelector } from '../practice/PracticeDestinationSelector';
import {
  CheckCircle2,
  BookOpen,
  FileCheck,
  Plus,
  Layers,
  ArrowRight,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';

interface PostImportAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  importedQuestions: Question[];
  mockTests: MockTest[];
  exams: Exam[];
  subjects?: Subject[];
  topics?: Topic[];
  onNavigateToTab?: (tab: string) => void;
  onComplete?: () => void;
}

export const PostImportAssignmentModal: React.FC<PostImportAssignmentModalProps> = ({
  isOpen,
  onClose,
  importedQuestions,
  mockTests,
  exams,
  subjects: initialSubjects,
  topics: initialTopics,
  onNavigateToTab,
  onComplete,
}) => {
  // Loaded taxonomy
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects || []);
  const [topics, setTopics] = useState<Topic[]>(initialTopics || []);
  const [loadingTaxonomy, setLoadingTaxonomy] = useState(false);

  // Fetch taxonomy if not provided as props
  useEffect(() => {
    if (!isOpen) return;
    if ((!initialSubjects || initialSubjects.length === 0) || (!initialTopics || initialTopics.length === 0)) {
      setLoadingTaxonomy(true);
      Promise.all([
        fetchSubjects().catch(() => []),
        fetchTopics().catch(() => []),
      ])
        .then(([s, t]) => {
          setSubjects(s);
          setTopics(t);
        })
        .finally(() => setLoadingTaxonomy(false));
    }
  }, [isOpen, initialSubjects, initialTopics]);

  // Exam detection from imported questions (Read-Only)
  const primaryExamCode = useMemo(() => {
    const qWithExam = importedQuestions.find((q) => q.exam && q.exam.trim().length > 0);
    if (qWithExam?.exam) return qWithExam.exam.trim();
    return exams[0]?.code || 'ANCHSL';
  }, [importedQuestions, exams]);

  const primaryExamName = useMemo(() => {
    const found = exams.find(
      (e) => e.code.toLowerCase() === primaryExamCode.toLowerCase() || e.name.toLowerCase() === primaryExamCode.toLowerCase()
    );
    return found ? `${found.name} (${found.code})` : primaryExamCode;
  }, [exams, primaryExamCode]);

  // Assignment selections
  const [assignPractice, setAssignPractice] = useState<boolean>(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  const [assignMock, setAssignMock] = useState<boolean>(false);
  const [selectedMockId, setSelectedMockId] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter available mocks for this exam
  const availableMocks = useMemo(() => {
    return mockTests.filter(
      (m) => !primaryExamCode || m.examCode?.toUpperCase() === primaryExamCode.toUpperCase()
    );
  }, [mockTests, primaryExamCode]);

  const handleApplyAction = async () => {
    setIsProcessing(true);
    setFeedbackMsg(null);

    try {
      const qIds = importedQuestions.map((q) => q.id);

      // Validation if Practice is selected
      if (assignPractice) {
        if (!selectedSubject || !selectedTopic) {
          throw new Error('Practice assignment requires Subject and Topic.');
        }
      }

      // Validation if Mock is selected
      if (assignMock && !selectedMockId) {
        throw new Error('Please select a destination Mock Test.');
      }

      // 1. Process Practice Assignment if chosen
      if (assignPractice && selectedSubject && selectedTopic) {
        for (const q of importedQuestions) {
          await assignQuestionToPractice(q, assignMock, {
            subject: selectedSubject.name,
            subjectId: selectedSubject.id,
            topic: selectedTopic.name,
            topicId: selectedTopic.id,
          });
        }
      }

      // 2. Process Mock Test Assignment if chosen
      if (assignMock && selectedMockId) {
        await assignQuestionsToMockTest(qIds, selectedMockId, mockTests, importedQuestions);
      }

      let successText = `Questions saved to Question Bank!`;
      if (assignPractice && assignMock) {
        successText = `Assigned ${importedQuestions.length} questions to Practice (${selectedTopic?.name}) and Mock Test!`;
      } else if (assignPractice) {
        successText = `Assigned ${importedQuestions.length} questions to Practice (${selectedSubject?.name} → ${selectedTopic?.name})!`;
      } else if (assignMock) {
        successText = `Assigned ${importedQuestions.length} questions to Mock Test!`;
      } else {
        successText = `Retained in Question Bank for future assignment.`;
      }

      setFeedbackMsg({
        type: 'success',
        text: successText,
      });

      setTimeout(() => {
        onClose();
        if (onComplete) onComplete();
        if (assignPractice && onNavigateToTab) {
          onNavigateToTab('practice-questions');
        } else if (assignMock && onNavigateToTab) {
          onNavigateToTab('test-builder');
        }
      }, 1300);
    } catch (err: any) {
      console.error('Post-import assignment error:', err);
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to process assignment.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Complete: Commit & Assign" maxWidth="xl">
      <div className="space-y-6 text-slate-800">
        {/* Success Header */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-emerald-600/25">
            <CheckCircle2 size={26} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-emerald-950">
              {importedQuestions.length} Questions Committed to Question Bank!
            </h3>
            <p className="text-xs text-emerald-700 mt-0.5">
              Every question is safely preserved in the master repository. Now choose optional destinations.
            </p>
          </div>
        </div>

        {feedbackMsg && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* 1. Practice Destination Assignment Option */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3.5">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={assignPractice}
              onChange={(e) => {
                setAssignPractice(e.target.checked);
                setFeedbackMsg(null);
              }}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
            />
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-brand-600" />
              <span className="font-bold text-sm text-slate-900">Assign to Student Practice</span>
            </div>
          </label>

          <p className="text-xs text-slate-500 pl-6.5">
            Organizes questions into the Exam → Subject → Topic hierarchy for student practice.
          </p>

          {assignPractice && (
            <div className="pt-2 border-t border-slate-100">
              {loadingTaxonomy ? (
                <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Loading subjects & topics...</span>
                </div>
              ) : (
                <PracticeDestinationSelector
                  examCode={primaryExamCode}
                  examName={primaryExamName}
                  selectedSubjectId={selectedSubjectId}
                  selectedTopicId={selectedTopicId}
                  onSubjectChange={(sub) => {
                    setSelectedSubject(sub);
                    setSelectedSubjectId(sub ? sub.id : '');
                    setSelectedTopic(null);
                    setSelectedTopicId('');
                    setFeedbackMsg(null);
                  }}
                  onTopicChange={(top) => {
                    setSelectedTopic(top);
                    setSelectedTopicId(top ? top.id : '');
                    setFeedbackMsg(null);
                  }}
                  subjects={subjects}
                  topics={topics}
                  required={true}
                />
              )}
            </div>
          )}
        </div>

        {/* 2. Mock Test Assignment Option */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3.5">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={assignMock}
              onChange={(e) => {
                setAssignMock(e.target.checked);
                setFeedbackMsg(null);
              }}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <div className="flex items-center gap-2">
              <FileCheck size={16} className="text-indigo-600" />
              <span className="font-bold text-sm text-slate-900">Assign to Existing Mock Test</span>
            </div>
          </label>

          <p className="text-xs text-slate-500 pl-6.5">
            Attaches questions directly to an existing mock test exam paper.
          </p>

          {assignMock && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-bold text-slate-700">Select Mock Test *</label>
              <select
                value={selectedMockId}
                onChange={(e) => {
                  setSelectedMockId(e.target.value);
                  setFeedbackMsg(null);
                }}
                className="w-full text-xs font-semibold p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="">-- Select Existing Mock Test --</option>
                {availableMocks.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.totalQuestions || 0} Qs)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onComplete) onComplete();
            }}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition"
          >
            Keep in Question Bank Only
          </button>

          <button
            type="button"
            onClick={handleApplyAction}
            disabled={
              isProcessing ||
              (assignPractice && (!selectedSubjectId || !selectedTopicId)) ||
              (assignMock && !selectedMockId)
            }
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing && <Loader2 size={14} className="animate-spin" />}
            <span>Confirm & Complete Assignment</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
