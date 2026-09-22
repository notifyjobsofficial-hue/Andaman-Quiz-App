import React from 'react';
import { Question, MockTest, LiveTestItem } from '../../types';
import { computeQuestionUsage } from '../../utils/questionUsage';
import {
  X,
  BookOpen,
  FileCheck,
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Layers
} from 'lucide-react';

interface QuestionUsageDrawerProps {
  question: Question | null;
  mockTests: MockTest[];
  liveTests: LiveTestItem[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMock?: (mockId: string) => void;
  onOpenAssignModal?: () => void;
}

export const QuestionUsageDrawer: React.FC<QuestionUsageDrawerProps> = ({
  question,
  mockTests,
  liveTests,
  isOpen,
  onClose,
  onNavigateToMock,
  onOpenAssignModal,
}) => {
  if (!isOpen || !question) return null;

  const usage = computeQuestionUsage(question, mockTests, liveTests);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Question Usage & Lifecycle</h3>
              <p className="text-[10px] font-mono text-slate-400">ID: {question.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Question Excerpt */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Question Excerpt</span>
            <p className="font-medium text-slate-800 line-clamp-3 leading-relaxed">
              {question.question_text || 'No text content available'}
            </p>
          </div>

          {/* Student Availability Status Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            usage.studentAvailable
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/70 border-amber-200 text-amber-900'
          }`}>
            {usage.studentAvailable ? (
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wide">
                {usage.studentAvailable ? 'Available in Student App' : 'Not Available in Student App'}
              </h4>
              <p className="text-xs mt-1 text-slate-600">
                {usage.studentAvailable
                  ? 'This question is published and reachable by students through active Practice or assigned Mock Tests.'
                  : 'This question exists in the Question Bank but is currently unpublished or not assigned to any student-accessible flow.'}
              </p>
            </div>
          </div>

          {/* Practice Flow */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-brand-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Student Practice Flow</h4>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                usage.inPractice ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
              }`}>
                {usage.inPractice ? 'Active in Practice' : 'Not in Practice'}
              </span>
            </div>

            {usage.inPractice ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Exam:</span>
                  <span className="font-bold text-slate-800">{usage.practiceTaxonomy?.exam || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Subject:</span>
                  <span className="font-bold text-slate-800">{usage.practiceTaxonomy?.subject || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Topic:</span>
                  <span className="font-bold text-slate-800">{usage.practiceTaxonomy?.topic || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <span className={`font-bold capitalize ${
                    (question.status || 'published') === 'published' ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {question.status || 'published'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500 font-medium">Student Availability:</span>
                  <span className={`font-bold ${
                    usage.studentAvailable ? 'text-emerald-700' : 'text-slate-500'
                  }`}>
                    {usage.studentAvailable ? 'Available' : 'Not Available'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Question is not configured for student subject practice.
              </p>
            )}
          </div>

          {/* Mock Tests List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck size={16} className="text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Assigned Mock Tests</h4>
              </div>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {usage.mockTests.length} Mocks
              </span>
            </div>

            {usage.mockTests.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                This question is not currently part of any Mock Test.
              </p>
            ) : (
              <div className="space-y-2">
                {usage.mockTests.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between hover:bg-slate-100 transition"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">{m.title}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Exam: {m.examCode}</span>
                    </div>
                    {onNavigateToMock && (
                      <button
                        onClick={() => onNavigateToMock(m.id)}
                        className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                      >
                        <span>Open</span>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Tests */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-rose-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Live Examinations</h4>
              </div>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                {usage.liveTests.length} Live
              </span>
            </div>

            {usage.liveTests.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No active or scheduled live tests reference this question's mock tests.
              </p>
            ) : (
              <div className="space-y-2">
                {usage.liveTests.map((lt) => (
                  <div
                    key={lt.id}
                    className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl text-xs"
                  >
                    <span className="font-bold text-slate-800 block">{lt.title}</span>
                    <span className="text-[10px] text-rose-600 font-semibold">Linked via Mock Test</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          {onOpenAssignModal && (
            <button
              onClick={() => {
                onClose();
                onOpenAssignModal();
              }}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/20 transition flex items-center justify-center gap-2"
            >
              <span>Manage Assignments</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
