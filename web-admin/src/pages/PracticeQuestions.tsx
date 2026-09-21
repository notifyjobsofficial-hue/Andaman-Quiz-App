import React, { useEffect, useState, useMemo } from 'react';
import {
  BookOpen,
  FolderTree,
  ChevronRight,
  ArrowLeft,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  Eye,
  Edit2,
  Trash2,
  ArrowRightLeft,
  UploadCloud,
  CheckSquare,
  Square,
  MinusCircle,
  HelpCircle,
  Filter,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import {
  fetchQuestions,
  fetchExams,
  fetchSubjects,
  fetchTopics,
  fetchMockTests,
  saveQuestion,
} from '../firebase/firestore';
import { Question, Exam, Subject, Topic, MockTest } from '../types';
import { Badge } from '../components/common/Badge';
import { QuestionPreviewModal } from '../components/questions/QuestionPreviewModal';
import { QuestionFormModal } from '../components/questions/QuestionFormModal';
import { AssignFromBankModal } from '../components/practice/AssignFromBankModal';
import { MoveToTopicModal } from '../components/practice/MoveToTopicModal';
import { AddTopicModal } from '../components/practice/AddTopicModal';
import {
  isPracticeQuestion,
  isNeedsOrganization,
  getSubjectQuestions,
  getTopicQuestions,
  calculateTopicMetrics,
  calculateSubjectMetrics,
  calculateGlobalPracticeMetrics,
  bulkUpdateQuestionStatus,
  bulkRemoveFromPractice,
} from '../utils/practiceQuestions';

type PracticeView = 'EXAM_HOME' | 'SUBJECT' | 'TOPIC' | 'UNASSIGNED';

interface PracticeQuestionsProps {
  onNavigateToTab?: (tab: string) => void;
}

export const PracticeQuestions: React.FC<PracticeQuestionsProps> = ({ onNavigateToTab }) => {
  const [view, setView] = useState<PracticeView>('EXAM_HOME');
  const [selectedExamCode, setSelectedExamCode] = useState<string>('ALL');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  // Core Data State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | 'Easy' | 'Medium' | 'Hard'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'published' | 'draft' | 'archived'>('ALL');

  // Selected Question IDs for Bulk Actions
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Modals
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [isQuestionFormOpen, setIsQuestionFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isAddTopicModalOpen, setIsAddTopicModalOpen] = useState(false);

  // Feedback Notification
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [q, e, s, t, m] = await Promise.all([
        fetchQuestions(3000),
        fetchExams().catch(() => []),
        fetchSubjects().catch(() => []),
        fetchTopics().catch(() => []),
        fetchMockTests().catch(() => []),
      ]);
      setQuestions(q);
      setExams(e);
      setSubjects(s);
      setTopics(t);
      setMockTests(m);
    } catch (err) {
      console.error('Failed to load practice questions data:', err);
      setActionFeedback({ type: 'error', message: 'Failed to load database records.' });
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (type: 'success' | 'info' | 'error', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Top-level Global Metrics
  const globalMetrics = useMemo(() => {
    return calculateGlobalPracticeMetrics(questions);
  }, [questions]);

  // Filtered Subjects by Selected Exam
  const examFilteredSubjects = useMemo(() => {
    if (selectedExamCode === 'ALL') return subjects;
    return subjects.filter(
      (s) => !s.examCodes || s.examCodes.length === 0 || s.examCodes.includes(selectedExamCode)
    );
  }, [subjects, selectedExamCode]);

  // Active Questions for Current Topic (Level 3)
  const currentTopicQuestions = useMemo(() => {
    if (!selectedSubject || !selectedTopic) return [];
    let qs = getTopicQuestions(selectedTopic, selectedSubject, questions);

    if (difficultyFilter !== 'ALL') {
      qs = qs.filter((q) => q.difficulty === difficultyFilter);
    }

    if (statusFilter !== 'ALL') {
      qs = qs.filter((q) => (q.status || 'published') === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      qs = qs.filter(
        (q) =>
          q.question_text?.toLowerCase().includes(term) ||
          q.id.toLowerCase().includes(term) ||
          q.explanation_text?.toLowerCase().includes(term)
      );
    }

    return qs;
  }, [questions, selectedSubject, selectedTopic, difficultyFilter, statusFilter, searchTerm]);

  // Active Questions for Unassigned View (Level 4)
  const unassignedQuestions = useMemo(() => {
    return questions.filter(isNeedsOrganization);
  }, [questions]);

  // Handlers for Navigation
  const navigateToHome = () => {
    setView('EXAM_HOME');
    setSelectedSubject(null);
    setSelectedTopic(null);
    setSelectedQuestionIds(new Set());
    setSearchTerm('');
  };

  const navigateToSubject = (subject: Subject) => {
    setSelectedSubject(subject);
    setSelectedTopic(null);
    setView('SUBJECT');
    setSelectedQuestionIds(new Set());
    setSearchTerm('');
  };

  const navigateToTopic = (topic: Topic) => {
    setSelectedTopic(topic);
    setView('TOPIC');
    setSelectedQuestionIds(new Set());
    setSearchTerm('');
  };

  const navigateToUnassigned = () => {
    setView('UNASSIGNED');
    setSelectedQuestionIds(new Set());
    setSearchTerm('');
  };

  // Bulk Question Selection Helpers
  const toggleSelectQuestion = (id: string) => {
    const next = new Set(selectedQuestionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedQuestionIds(next);
  };

  const toggleSelectAllTopicQuestions = () => {
    if (selectedQuestionIds.size === currentTopicQuestions.length) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(currentTopicQuestions.map((q) => q.id)));
    }
  };

  // Bulk Operations
  const handleBulkStatusChange = async (newStatus: 'published' | 'draft' | 'archived') => {
    if (selectedQuestionIds.size === 0) return;
    try {
      const ids = Array.from(selectedQuestionIds);
      const updated = await bulkUpdateQuestionStatus(ids, newStatus, questions);
      const idMap = new Map(updated.map((u) => [u.id, u]));
      setQuestions((prev) => prev.map((q) => idMap.get(q.id) || q));
      setSelectedQuestionIds(new Set());
      showFeedback('success', `Updated ${ids.length} question(s) to ${newStatus}.`);
    } catch (err: any) {
      console.error('Bulk status error:', err);
      showFeedback('error', 'Failed to update status.');
    }
  };

  const handleBulkRemoveFromPractice = async () => {
    if (selectedQuestionIds.size === 0) return;
    const confirm = window.confirm(
      `Remove ${selectedQuestionIds.size} question(s) from student practice?\n\nNote: The questions will NOT be deleted from the Question Bank. Only practice assignment is removed.`
    );
    if (!confirm) return;

    try {
      const ids = Array.from(selectedQuestionIds);
      const updated = await bulkRemoveFromPractice(ids, questions, mockTests);
      const idMap = new Map(updated.map((u) => [u.id, u]));
      setQuestions((prev) => prev.map((q) => idMap.get(q.id) || q));
      setSelectedQuestionIds(new Set());
      showFeedback('success', `Removed ${ids.length} question(s) from practice.`);
    } catch (err: any) {
      console.error('Bulk remove from practice error:', err);
      showFeedback('error', 'Failed to remove from practice.');
    }
  };

  const handleSingleRemoveFromPractice = async (question: Question) => {
    const confirm = window.confirm(
      `Remove this question from practice?\n\nIt will remain safely in the Question Bank.`
    );
    if (!confirm) return;

    try {
      const updated = await bulkRemoveFromPractice([question.id], questions, mockTests);
      if (updated[0]) {
        setQuestions((prev) => prev.map((q) => (q.id === question.id ? updated[0] : q)));
        showFeedback('success', 'Question removed from practice.');
      }
    } catch (err: any) {
      console.error('Single remove error:', err);
      showFeedback('error', 'Failed to remove question.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : actionFeedback.type === 'info'
              ? 'bg-brand-50 border-brand-200 text-brand-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600" />
            ) : actionFeedback.type === 'info' ? (
              <Sparkles size={16} className="text-brand-600" />
            ) : (
              <AlertTriangle size={16} className="text-rose-600" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-xs px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* BREADCRUMB & NAVIGATION BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Root Link */}
          <button
            onClick={navigateToHome}
            className={`flex items-center gap-1.5 font-bold transition ${
              view === 'EXAM_HOME'
                ? 'text-slate-900 cursor-default'
                : 'text-brand-600 hover:text-brand-800 hover:underline'
            }`}
          >
            <BookOpen size={16} className="text-brand-600" />
            <span>Practice Questions</span>
          </button>

          {/* Exam Tag */}
          {selectedExamCode !== 'ALL' && (
            <>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                {selectedExamCode}
              </span>
            </>
          )}

          {/* Subject Link */}
          {selectedSubject && (
            <>
              <ChevronRight size={14} className="text-slate-400" />
              <button
                onClick={() => navigateToSubject(selectedSubject)}
                className={`font-semibold transition ${
                  view === 'SUBJECT'
                    ? 'text-slate-900 cursor-default'
                    : 'text-brand-600 hover:text-brand-800 hover:underline'
                }`}
              >
                {selectedSubject.name}
              </button>
            </>
          )}

          {/* Topic Tag */}
          {selectedTopic && (
            <>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-bold text-slate-900 bg-brand-50 text-brand-700 px-2.5 py-0.5 rounded-md border border-brand-200">
                {selectedTopic.name}
              </span>
            </>
          )}

          {/* Needs Organization View */}
          {view === 'UNASSIGNED' && (
            <>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                <AlertTriangle size={12} />
                Needs Organization
              </span>
            </>
          )}
        </div>

        {/* Back Button for Sub-Views */}
        {view !== 'EXAM_HOME' && (
          <button
            onClick={() => {
              if (view === 'TOPIC') setView('SUBJECT');
              else navigateToHome();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
        )}
      </div>

      {/* TOP SUMMARY KPI BAR (Always visible for clarity) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Total Practice */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Practice
            </div>
            <div className="text-2xl font-black text-slate-800 mt-1">
              {globalMetrics.totalPractice}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Syllabus-assigned</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <BookOpen size={20} />
          </div>
        </div>

        {/* Metric 2: Live / Published */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              Live to Students
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {globalMetrics.publishedPractice}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Published & Available</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Metric 3: Draft */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
              Draft / Staged
            </div>
            <div className="text-2xl font-black text-amber-700 mt-1">
              {globalMetrics.draftPractice}
            </div>
            <div className="text-[11px] text-amber-600 mt-0.5">Hidden from App</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        {/* Metric 4: Needs Organization */}
        <div
          onClick={navigateToUnassigned}
          className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition ${
            globalMetrics.needsOrganization > 0
              ? 'bg-rose-50/50 border-rose-200 hover:bg-rose-50'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
              <span>Needs Org</span>
              {globalMetrics.needsOrganization > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </div>
            <div className="text-2xl font-black text-rose-700 mt-1">
              {globalMetrics.needsOrganization}
            </div>
            <div className="text-[11px] text-rose-600 mt-0.5 font-medium">
              {globalMetrics.needsOrganization > 0 ? 'Click to organize →' : 'All organized'}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LEVEL 1: EXAM / HOME VIEW                                                 */}
      {/* ========================================================================= */}
      {view === 'EXAM_HOME' && (
        <div className="space-y-6">
          {/* Header Controls Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>Topic-Wise Practice Syllabus</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
                  Hierarchy
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Select an exam and subject to browse and manage questions by topic.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center flex-wrap gap-2.5">
              <button
                onClick={() => {
                  setEditingQuestion(null);
                  setIsQuestionFormOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Plus size={16} />
                <span>Add Question</span>
              </button>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('import')}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  <UploadCloud size={16} />
                  <span>Bulk Upload</span>
                </button>
              )}
            </div>
          </div>

          {/* Exam Filter Chips & Subject Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Exam Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedExamCode('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  selectedExamCode === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Exams
              </button>
              {exams.map((ex) => {
                const isSelected = selectedExamCode === ex.code;
                return (
                  <button
                    key={ex.id}
                    onClick={() => setSelectedExamCode(ex.code)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {ex.name} ({ex.code})
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search subject or topic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          {/* Subject Cards Grid */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="animate-spin text-brand-600" size={18} />
              <span>Loading syllabus subjects...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {examFilteredSubjects
                .filter((s) => {
                  if (!searchTerm.trim()) return true;
                  const term = searchTerm.toLowerCase();
                  return (
                    s.name.toLowerCase().includes(term) ||
                    (s.hindiName && s.hindiName.toLowerCase().includes(term))
                  );
                })
                .map((subject) => {
                  const metrics = calculateSubjectMetrics(subject, topics, questions);

                  return (
                    <div
                      key={subject.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-brand-300 hover:shadow-md transition flex flex-col justify-between group"
                    >
                      <div>
                        {/* Subject Top Info */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-sm font-extrabold text-slate-900 group-hover:text-brand-600 transition">
                              {subject.name}
                            </h2>
                            {subject.hindiName && (
                              <p className="text-xs text-slate-400 font-medium mt-0.5">
                                {subject.hindiName}
                              </p>
                            )}
                          </div>
                          {subject.isAndamanSpecial && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              Island GK
                            </span>
                          )}
                        </div>

                        {/* Exam Tags */}
                        {subject.examCodes && subject.examCodes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2.5">
                            {subject.examCodes.map((code) => (
                              <span
                                key={code}
                                className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Counts Pill */}
                        <div className="mt-4 flex items-center gap-2 text-xs">
                          <span className="font-extrabold text-slate-800">
                            {metrics.totalQuestions} Questions
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-emerald-600 font-semibold">
                            {metrics.published} Live
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-amber-600 font-semibold">
                            {metrics.draft} Draft
                          </span>
                        </div>

                        {/* Topic Previews List */}
                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Topics Preview ({metrics.topicCount})
                          </div>
                          {metrics.topicsBreakdown.length === 0 ? (
                            <div className="text-xs text-slate-400 italic py-1">
                              No topics created yet.
                            </div>
                          ) : (
                            metrics.topicsBreakdown.slice(0, 4).map(({ topic, count }) => (
                              <div
                                key={topic.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSubject(subject);
                                  navigateToTopic(topic);
                                }}
                                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 cursor-pointer transition text-slate-700 hover:text-brand-600"
                              >
                                <span className="truncate pr-2 font-medium">{topic.name}</span>
                                <span className="font-bold text-slate-500 text-[11px] shrink-0 bg-slate-100 px-2 py-0.5 rounded-full">
                                  {count}
                                </span>
                              </div>
                            ))
                          )}
                          {metrics.topicsBreakdown.length > 4 && (
                            <div className="text-[11px] font-semibold text-brand-600 pt-1">
                              + {metrics.topicsBreakdown.length - 4} more topics...
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Action */}
                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">
                          {metrics.topicCount} Topic{metrics.topicCount !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={() => navigateToSubject(subject)}
                          className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 transition py-1 px-2 rounded-lg hover:bg-brand-50"
                        >
                          <span>Manage Subject</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 2: SUBJECT VIEW (Topic Cards)                                       */}
      {/* ========================================================================= */}
      {view === 'SUBJECT' && selectedSubject && (
        <div className="space-y-6">
          {/* Subject Banner Header */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-700">
                  Subject
                </span>
                {selectedSubject.isAndamanSpecial && (
                  <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Island GK Special
                  </span>
                )}
              </div>
              <h1 className="text-lg font-black text-slate-900 mt-1">
                {selectedSubject.name}
              </h1>
              {selectedSubject.hindiName && (
                <p className="text-xs text-slate-400 font-medium">{selectedSubject.hindiName}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center flex-wrap gap-2.5">
              <button
                onClick={() => setIsAddTopicModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
              >
                <Plus size={16} />
                <span>Add Topic</span>
              </button>
              <button
                onClick={() => {
                  setEditingQuestion(null);
                  setIsQuestionFormOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Plus size={16} />
                <span>Add Question to Subject</span>
              </button>
            </div>
          </div>

          {/* Topics List Header & Search */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Syllabus Topics
            </h2>
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Filter topics..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          {/* Topics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topics
              .filter((t) => t.subjectId === selectedSubject.id)
              .filter((t) => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return (
                  t.name.toLowerCase().includes(term) ||
                  (t.hindiName && t.hindiName.toLowerCase().includes(term))
                );
              })
              .map((topic) => {
                const metrics = calculateTopicMetrics(topic, selectedSubject, questions);

                return (
                  <div
                    key={topic.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-brand-300 hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{topic.name}</h3>
                          {topic.hindiName && (
                            <p className="text-xs text-slate-400 mt-0.5">{topic.hindiName}</p>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                            metrics.total > 0
                              ? 'bg-brand-50 text-brand-700 border border-brand-200'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {metrics.total} Questions
                        </span>
                      </div>

                      {/* Status Breakdown Pills */}
                      <div className="flex items-center gap-2 mt-4 text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                          {metrics.published} Live
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold">
                          {metrics.draft} Draft
                        </span>
                        {metrics.archived > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                            {metrics.archived} Archived
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setEditingQuestion(null);
                          setSelectedTopic(topic);
                          setIsQuestionFormOpen(true);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 rounded hover:bg-slate-50 transition"
                      >
                        + Add Q
                      </button>
                      <button
                        onClick={() => navigateToTopic(topic)}
                        className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 transition py-1 px-3 rounded-xl bg-brand-50 hover:bg-brand-100"
                      >
                        <span>Manage Questions</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 3: TOPIC VIEW (Clean Table, No Redundant Columns)                   */}
      {/* ========================================================================= */}
      {view === 'TOPIC' && selectedSubject && selectedTopic && (
        <div className="space-y-5">
          {/* Topic Header Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{selectedSubject.name}</span>
                <ChevronRight size={12} />
                <span className="font-bold text-brand-600">Practice Topic</span>
              </div>
              <h1 className="text-lg font-black text-slate-900 mt-1">
                {selectedTopic.name}
              </h1>
              {selectedTopic.hindiName && (
                <p className="text-xs text-slate-400">{selectedTopic.hindiName}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center flex-wrap gap-2.5">
              <button
                onClick={() => setIsAssignModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition shadow-2xs"
              >
                <Layers size={15} />
                <span>Assign from Question Bank</span>
              </button>
              <button
                onClick={() => {
                  setEditingQuestion(null);
                  setIsQuestionFormOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Plus size={16} />
                <span>Add Question</span>
              </button>
            </div>
          </div>

          {/* Filters & Search Row */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center flex-wrap gap-2.5 flex-1">
              {/* Text Search */}
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search questions in this topic..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              {/* Difficulty Filter */}
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value as any)}
                className="py-1.5 px-3 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-700"
              >
                <option value="ALL">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="py-1.5 px-3 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-700"
              >
                <option value="ALL">All Status</option>
                <option value="published">Published (Live)</option>
                <option value="draft">Draft (Hidden)</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-semibold px-1">
              Showing {currentTopicQuestions.length} questions
            </div>
          </div>

          {/* Bulk Selection Bar (Sticky / Highlighted when active) */}
          {selectedQuestionIds.size > 0 && (
            <div className="bg-slate-900 text-white rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in">
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="bg-brand-500 px-2.5 py-0.5 rounded-full text-white font-bold">
                  {selectedQuestionIds.size} Selected
                </span>
                <span>Bulk actions for topic:</span>
              </div>

              <div className="flex items-center flex-wrap gap-2 text-xs">
                <button
                  onClick={() => handleBulkStatusChange('published')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition"
                >
                  Publish All
                </button>
                <button
                  onClick={() => handleBulkStatusChange('draft')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition"
                >
                  Set as Draft
                </button>
                <button
                  onClick={() => setIsMoveModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition flex items-center gap-1.5"
                >
                  <ArrowRightLeft size={14} />
                  <span>Move to Topic...</span>
                </button>
                <button
                  onClick={handleBulkRemoveFromPractice}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition flex items-center gap-1.5"
                >
                  <MinusCircle size={14} />
                  <span>Remove from Practice</span>
                </button>
              </div>
            </div>
          )}

          {/* Simplified Question Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-10">
                    <button
                      onClick={toggleSelectAllTopicQuestions}
                      className="hover:text-brand-600 transition pt-1"
                    >
                      {selectedQuestionIds.size > 0 &&
                      selectedQuestionIds.size === currentTopicQuestions.length ? (
                        <CheckSquare size={16} className="text-brand-600" />
                      ) : (
                        <Square size={16} className="text-slate-300" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Question</th>
                  <th className="py-3 px-4 w-28">Difficulty</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 w-32">Updated</th>
                  <th className="py-3 px-4 w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {currentTopicQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <BookOpen size={28} className="text-slate-300" />
                        <span>No questions in this topic matching filters.</span>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => setIsAssignModalOpen(true)}
                            className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl font-bold transition text-xs"
                          >
                            Assign from Question Bank
                          </button>
                          <button
                            onClick={() => {
                              setEditingQuestion(null);
                              setIsQuestionFormOpen(true);
                            }}
                            className="px-3 py-1.5 bg-brand-600 text-white hover:bg-brand-700 rounded-xl font-bold transition text-xs"
                          >
                            Add New Question
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentTopicQuestions.map((q) => {
                    const isSelected = selectedQuestionIds.has(q.id);
                    const isPublished = (q.status || 'published') === 'published';
                    const isDraft = q.status === 'draft';

                    return (
                      <tr
                        key={q.id}
                        className={`hover:bg-slate-50/80 transition ${
                          isSelected ? 'bg-brand-50/40' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleSelectQuestion(q.id)}
                            className="text-slate-400 hover:text-brand-600 pt-0.5"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-brand-600" />
                            ) : (
                              <Square size={16} className="text-slate-300" />
                            )}
                          </button>
                        </td>

                        {/* Question Text */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800 line-clamp-2 leading-relaxed">
                              {q.question_text || '(Diagram / Visual Question)'}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                              <span>ID: {q.id.slice(0, 10)}...</span>
                              {q.question_image_url && (
                                <span className="flex items-center gap-1 text-brand-600 font-sans">
                                  <ImageIcon size={12} />
                                  <span>Has Image</span>
                                </span>
                              )}
                              <span>• Correct: [{q.correct_answer}]</span>
                            </div>
                          </div>
                        </td>

                        {/* Difficulty */}
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              q.difficulty === 'Easy'
                                ? 'bg-emerald-50 text-emerald-700'
                                : q.difficulty === 'Hard'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {q.difficulty || 'Medium'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          {isPublished ? (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>Live</span>
                            </span>
                          ) : isDraft ? (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span>Draft</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              <span>Archived</span>
                            </span>
                          )}
                        </td>

                        {/* Updated Date */}
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {q.updated_at
                            ? new Date(q.updated_at).toLocaleDateString()
                            : q.created_at
                            ? new Date(q.created_at).toLocaleDateString()
                            : 'Legacy'}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setPreviewQuestion(q)}
                              title="Preview in Student CBT view"
                              className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100 transition"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingQuestion(q);
                                setIsQuestionFormOpen(true);
                              }}
                              title="Edit Question"
                              className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedQuestionIds(new Set([q.id]));
                                setIsMoveModalOpen(true);
                              }}
                              title="Move to another topic"
                              className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-slate-100 transition"
                            >
                              <ArrowRightLeft size={15} />
                            </button>
                            <button
                              onClick={() => handleSingleRemoveFromPractice(q)}
                              title="Remove from Practice (remains in Question Bank)"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                            >
                              <MinusCircle size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 4: UNASSIGNED / NEEDS ORGANIZATION VIEW                             */}
      {/* ========================================================================= */}
      {view === 'UNASSIGNED' && (
        <div className="space-y-5">
          {/* Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Organization Action Required
                </span>
              </div>
              <h1 className="text-lg font-black text-amber-950 mt-1">
                Questions Needing Topic Assignment ({unassignedQuestions.length})
              </h1>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                These questions are enabled for student practice, but lack a specific Subject or Topic (e.g. topic is &quot;General&quot; or missing).
                Organize them so students can find them in syllabus practice.
              </p>
            </div>

            {selectedQuestionIds.size > 0 && (
              <button
                onClick={() => setIsMoveModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold transition shadow-xs shrink-0"
              >
                <FolderTree size={16} />
                <span>Assign {selectedQuestionIds.size} to Topic...</span>
              </button>
            )}
          </div>

          {/* Unassigned Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-10">
                    <button
                      onClick={() => {
                        if (selectedQuestionIds.size === unassignedQuestions.length) {
                          setSelectedQuestionIds(new Set());
                        } else {
                          setSelectedQuestionIds(new Set(unassignedQuestions.map((q) => q.id)));
                        }
                      }}
                      className="hover:text-brand-600 transition pt-1"
                    >
                      {selectedQuestionIds.size > 0 &&
                      selectedQuestionIds.size === unassignedQuestions.length ? (
                        <CheckSquare size={16} className="text-brand-600" />
                      ) : (
                        <Square size={16} className="text-slate-300" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Question</th>
                  <th className="py-3 px-4 w-36">Current Taxonomy</th>
                  <th className="py-3 px-4 w-28">Status</th>
                  <th className="py-3 px-4 w-40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {unassignedQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                        <span className="font-bold text-slate-700 text-sm">
                          All Practice Questions are Organized!
                        </span>
                        <span className="text-xs text-slate-400">
                          Every practice question has a valid Subject and Topic assigned.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  unassignedQuestions.map((q) => {
                    const isSelected = selectedQuestionIds.has(q.id);

                    return (
                      <tr
                        key={q.id}
                        className={`hover:bg-slate-50/80 transition ${
                          isSelected ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <button
                            onClick={() => toggleSelectQuestion(q.id)}
                            className="text-slate-400 hover:text-brand-600 pt-0.5"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-brand-600" />
                            ) : (
                              <Square size={16} className="text-slate-300" />
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800 line-clamp-2">
                            {q.question_text || '(Diagram / Image Question)'}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {q.id}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-[11px] space-y-0.5">
                            <div>
                              <span className="text-slate-400 font-medium">Subject:</span>{' '}
                              <span className="font-semibold text-slate-700">
                                {q.subject || 'Missing'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-medium">Topic:</span>{' '}
                              <span className="font-bold text-amber-700">
                                {q.topic || 'Missing'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <Badge
                            variant={q.status === 'published' ? 'success' : 'warning'}
                          >
                            {q.status || 'published'}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedQuestionIds(new Set([q.id]));
                                setIsMoveModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition"
                            >
                              Assign Topic
                            </button>
                            <button
                              onClick={() => handleSingleRemoveFromPractice(q)}
                              title="Remove from Practice"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition"
                            >
                              <MinusCircle size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS & DRAWERS                                                          */}
      {/* ========================================================================= */}

      {/* 1. CBT Preview Modal */}
      <QuestionPreviewModal
        question={previewQuestion}
        isOpen={!!previewQuestion}
        onClose={() => setPreviewQuestion(null)}
      />

      {/* 2. Add / Edit Question Modal */}
      {isQuestionFormOpen && (
        <QuestionFormModal
          isOpen={isQuestionFormOpen}
          onClose={() => {
            setIsQuestionFormOpen(false);
            setEditingQuestion(null);
          }}
          questionToEdit={editingQuestion}
          exams={exams}
          subjects={subjects}
          defaultUsage="PRACTICE"
          defaultExam={selectedExamCode !== 'ALL' ? selectedExamCode : exams[0]?.code}
          defaultSubject={selectedSubject?.name}
          defaultSubjectId={selectedSubject?.id}
          defaultTopic={selectedTopic?.name}
          defaultTopicId={selectedTopic?.id}
          onSaved={(savedQ) => {
            setQuestions((prev) => {
              const idx = prev.findIndex((q) => q.id === savedQ.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = savedQ;
                return next;
              }
              return [savedQ, ...prev];
            });
            setIsQuestionFormOpen(false);
            setEditingQuestion(null);
            showFeedback('success', 'Question saved successfully!');
          }}
        />
      )}

      {/* 3. Assign from Question Bank Modal */}
      {isAssignModalOpen && selectedTopic && selectedSubject && (
        <AssignFromBankModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          targetTopic={selectedTopic}
          targetSubject={selectedSubject}
          targetExamCode={selectedExamCode !== 'ALL' ? selectedExamCode : exams[0]?.code || 'CGL'}
          allQuestions={questions}
          allSubjects={subjects}
          allMockTests={mockTests}
          onAssigned={(assignedQuestions) => {
            const map = new Map(assignedQuestions.map((q) => [q.id, q]));
            setQuestions((prev) => prev.map((q) => map.get(q.id) || q));
            showFeedback(
              'success',
              `Assigned ${assignedQuestions.length} question(s) to ${selectedTopic.name}.`
            );
          }}
        />
      )}

      {/* 4. Move Questions to Topic Modal */}
      {isMoveModalOpen && (
        <MoveToTopicModal
          isOpen={isMoveModalOpen}
          onClose={() => setIsMoveModalOpen(false)}
          questionIds={Array.from(selectedQuestionIds)}
          currentSubject={selectedSubject}
          allSubjects={subjects}
          allTopics={topics}
          allQuestions={questions}
          onMoved={(movedQuestions) => {
            const map = new Map(movedQuestions.map((q) => [q.id, q]));
            setQuestions((prev) => prev.map((q) => map.get(q.id) || q));
            setSelectedQuestionIds(new Set());
            showFeedback('success', `Moved ${movedQuestions.length} question(s) successfully.`);
          }}
        />
      )}

      {/* 5. Add Topic Modal */}
      {isAddTopicModalOpen && selectedSubject && (
        <AddTopicModal
          isOpen={isAddTopicModalOpen}
          onClose={() => setIsAddTopicModalOpen(false)}
          subject={selectedSubject}
          onTopicCreated={(newTopic) => {
            setTopics((prev) => [...prev, newTopic]);
            showFeedback('success', `Created topic "${newTopic.name}".`);
          }}
        />
      )}
    </div>
  );
};
