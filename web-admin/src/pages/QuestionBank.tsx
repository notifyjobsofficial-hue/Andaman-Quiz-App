import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Eye,
  Download,
  Image as ImageIcon,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  FileCheck,
  Radio,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Calendar,
  ArrowUpDown,
  Archive,
  Layers,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import {
  fetchQuestions,
  deleteQuestion,
  bulkDeleteQuestions,
  fetchExams,
  fetchSubjects,
  fetchTopics,
  fetchMockTests,
  fetchLiveTests,
  saveQuestion,
} from '../firebase/firestore';
import { Question, Exam, Subject, Topic, MockTest, LiveTestItem, QuestionUsageSummary } from '../types';
import { Badge } from '../components/common/Badge';
import { QuestionPreviewModal } from '../components/questions/QuestionPreviewModal';
import { QuestionFormModal } from '../components/questions/QuestionFormModal';
import { AssignToModal } from '../components/questions/AssignToModal';
import { QuestionUsageDrawer } from '../components/questions/QuestionUsageDrawer';
import { exportQuestionsToCsv } from '../utils/excelParser';
import { computeQuestionUsage } from '../utils/questionUsage';

interface QuestionBankProps {
  mode?: 'all' | 'practice';
  onNavigateToMock?: (mockId: string) => void;
}

export const QuestionBank: React.FC<QuestionBankProps> = ({ mode = 'all', onNavigateToMock }) => {
  const isPracticeMode = mode === 'practice';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [liveTests, setLiveTests] = useState<LiveTestItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExam, setSelectedExam] = useState('ALL');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IMAGE_ONLY' | 'TEXT_ONLY'>('ALL');

  // Advanced Usage Filters
  const [usageFilter, setUsageFilter] = useState<
    'ALL' | 'PRACTICE' | 'MOCK' | 'BOTH' | 'NOT_USED' | 'SPECIFIC_MOCK'
  >(isPracticeMode ? 'PRACTICE' : 'ALL');
  const [selectedMockId, setSelectedMockId] = useState<string>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'AVAILABLE' | 'NOT_AVAILABLE'>('ALL');

  // Date Filter & Sorting
  const [dateFilter, setDateFilter] = useState<
    'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH' | 'CUSTOM'
  >('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'RECENTLY_UPDATED'>('NEWEST');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Selected for Bulk Action
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Drawers
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Assignment Modal
  const [assignModalQuestions, setAssignModalQuestions] = useState<Question[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Usage Drawer
  const [usageDrawerQuestion, setUsageDrawerQuestion] = useState<Question | null>(null);

  // Deletion Warning Modal
  const [deleteWarningTarget, setDeleteWarningTarget] = useState<{
    question: Question;
    usage: QuestionUsageSummary;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [q, e, s, t, m, lt] = await Promise.all([
        fetchQuestions(3000),
        fetchExams().catch(() => []),
        fetchSubjects().catch(() => []),
        fetchTopics().catch(() => []),
        fetchMockTests().catch(() => []),
        fetchLiveTests().catch(() => []),
      ]);
      setQuestions(q);
      setExams(e);
      setSubjects(s);
      setTopics(t);
      setMockTests(m);
      setLiveTests(lt);
    } catch (err) {
      console.error('QuestionBank loadData error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Precompute question usages for swift filtering & rendering
  const questionUsages = useMemo(() => {
    const map = new Map<string, QuestionUsageSummary>();
    questions.forEach((q) => {
      map.set(q.id, computeQuestionUsage(q, mockTests, liveTests));
    });
    return map;
  }, [questions, mockTests, liveTests]);

  // Dashboard Stats
  const stats = useMemo(() => {
    const total = questions.length;
    let availableInApp = 0;
    let practiceCount = 0;
    let mockOnlyCount = 0;
    let notUsedCount = 0;
    let draftCount = 0;
    let addedToday = 0;
    let addedThisWeek = 0;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    questions.forEach((q) => {
      const usage = questionUsages.get(q.id);
      if (usage?.studentAvailable) availableInApp++;
      if (usage?.inPractice) practiceCount++;
      if (usage?.statusBadge === 'MOCK') mockOnlyCount++;
      if (usage?.statusBadge === 'NOT_USED') notUsedCount++;
      if (q.status === 'draft') draftCount++;

      if (q.created_at) {
        const t = new Date(q.created_at).getTime();
        if (!isNaN(t)) {
          if (t >= startOfToday) addedToday++;
          if (t >= sevenDaysAgo) addedThisWeek++;
        }
      }
    });

    return {
      total,
      availableInApp,
      practiceCount,
      mockOnlyCount,
      notUsedCount,
      draftCount,
      addedToday,
      addedThisWeek,
    };
  }, [questions, questionUsages]);

  // Clear all filters back to defaults
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedExam('ALL');
    setSelectedSubject('ALL');
    setSelectedDifficulty('ALL');
    setSelectedStatus('ALL');
    setTypeFilter('ALL');
    setUsageFilter(isPracticeMode ? 'PRACTICE' : 'ALL');
    setSelectedMockId('');
    setAvailabilityFilter('ALL');
    setDateFilter('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setSortBy('NEWEST');
    setCurrentPage(1);
  };

  // Filtered Questions
  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const customStart = customStartDate ? new Date(customStartDate).getTime() : 0;
    const customEnd = customEndDate ? new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;

    return questions.filter((q) => {
      const usage = questionUsages.get(q.id);

      // 1. Text & ID Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesText = q.question_text?.toLowerCase().includes(term);
        const matchesId = q.id?.toLowerCase().includes(term);
        const matchesTopic = q.topic?.toLowerCase().includes(term);
        if (!matchesText && !matchesId && !matchesTopic) return false;
      }

      // 2. Exam, Subject, Difficulty, Status
      if (selectedExam !== 'ALL' && q.exam !== selectedExam) return false;
      if (selectedSubject !== 'ALL' && q.subject !== selectedSubject) return false;
      if (selectedDifficulty !== 'ALL' && q.difficulty !== selectedDifficulty) return false;
      if (selectedStatus !== 'ALL' && q.status !== selectedStatus) return false;

      // 3. Image / Text Type
      const hasImages = !!(
        q.question_image_url ||
        q.option_a_image_url ||
        q.option_b_image_url ||
        q.option_c_image_url ||
        q.option_d_image_url
      );
      if (typeFilter === 'IMAGE_ONLY' && !hasImages) return false;
      if (typeFilter === 'TEXT_ONLY' && hasImages) return false;

      // 4. Usage Filter
      if (usageFilter === 'PRACTICE' && !usage?.inPractice) return false;
      if (usageFilter === 'MOCK' && (usage?.mockTests.length ?? 0) === 0) return false;
      if (usageFilter === 'BOTH' && !(usage?.inPractice && (usage?.mockTests.length ?? 0) > 0)) return false;
      if (usageFilter === 'NOT_USED' && (usage?.inPractice || (usage?.mockTests.length ?? 0) > 0)) return false;
      if (usageFilter === 'SPECIFIC_MOCK') {
        if (!selectedMockId || !usage?.mockTests.some((m) => m.id === selectedMockId)) return false;
      }

      // 5. Student Availability
      if (availabilityFilter === 'AVAILABLE' && !usage?.studentAvailable) return false;
      if (availabilityFilter === 'NOT_AVAILABLE' && usage?.studentAvailable) return false;

      // 6. Date Filter
      if (dateFilter !== 'ALL') {
        if (!q.created_at) return false; // Legacy questions excluded from strict date ranges
        const createdMs = new Date(q.created_at).getTime();
        if (isNaN(createdMs)) return false;

        if (dateFilter === 'TODAY' && createdMs < startOfToday) return false;
        if (dateFilter === 'YESTERDAY' && (createdMs < startOfYesterday || createdMs >= startOfToday)) return false;
        if (dateFilter === 'LAST_7' && createdMs < sevenDaysAgo) return false;
        if (dateFilter === 'LAST_30' && createdMs < thirtyDaysAgo) return false;
        if (dateFilter === 'THIS_MONTH' && createdMs < startOfThisMonth) return false;
        if (dateFilter === 'CUSTOM' && (createdMs < customStart || createdMs > customEnd)) return false;
      }

      return true;
    });
  }, [
    questions,
    questionUsages,
    searchTerm,
    selectedExam,
    selectedSubject,
    selectedDifficulty,
    selectedStatus,
    typeFilter,
    usageFilter,
    selectedMockId,
    availabilityFilter,
    dateFilter,
    customStartDate,
    customEndDate,
  ]);

  // Sorted Questions
  const sortedQuestions = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      if (sortBy === 'NEWEST') {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'OLDEST') {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : Infinity;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : Infinity;
        return timeA - timeB;
      }
      if (sortBy === 'RECENTLY_UPDATED') {
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });
    return list;
  }, [filtered, sortBy]);

  const totalPages = Math.ceil(sortedQuestions.length / pageSize) || 1;
  const paginatedQuestions = sortedQuestions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllOnPage = () => {
    if (selectedIds.size === paginatedQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedQuestions.map((q) => q.id)));
    }
  };

  // Safe Deletion Handler
  const initiateDeleteSingle = (q: Question) => {
    const usage = questionUsages.get(q.id) || computeQuestionUsage(q, mockTests, liveTests);
    if (usage.inPractice || usage.mockTests.length > 0) {
      setDeleteWarningTarget({ question: q, usage });
    } else {
      if (confirm(`Delete question "${(q.question_text || q.id).slice(0, 40)}..."? This cannot be undone.`)) {
        handleExecuteDelete(q.id);
      }
    }
  };

  const handleExecuteDelete = async (questionId: string) => {
    try {
      await deleteQuestion(questionId);
      setQuestions((prev) => prev.filter((item) => item.id !== questionId));
      setDeleteWarningTarget(null);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete question.');
    }
  };

  const handleArchiveQuestion = async (q: Question) => {
    try {
      const updated: Question = {
        ...q,
        status: 'archived',
        updated_at: new Date().toISOString(),
      };
      await saveQuestion(updated);
      setQuestions((prev) => prev.map((item) => (item.id === q.id ? updated : item)));
      setDeleteWarningTarget(null);
    } catch (err) {
      console.error('Archive error:', err);
      alert('Failed to archive question.');
    }
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (confirm(`Delete ${selectedIds.size} selected questions? This cannot be undone.`)) {
      await bulkDeleteQuestions(Array.from(selectedIds));
      setQuestions((prev) => prev.filter((q) => !selectedIds.has(q.id)));
      setSelectedIds(new Set());
    }
  };

  const handleBulkSetStatus = async (newStatus: 'published' | 'draft' | 'archived') => {
    for (const id of Array.from(selectedIds)) {
      const q = questions.find((item) => item.id === id);
      if (q) {
        await saveQuestion({ ...q, status: newStatus, updated_at: new Date().toISOString() });
      }
    }
    await loadData();
    setSelectedIds(new Set());
  };

  const handleBulkSetUsage = async (newUsage: 'PRACTICE' | 'MOCK' | 'BOTH') => {
    for (const id of Array.from(selectedIds)) {
      const q = questions.find((item) => item.id === id);
      if (q) {
        await saveQuestion({
          ...q,
          usageType: newUsage,
          usage_type: newUsage,
          updated_at: new Date().toISOString(),
        });
      }
    }
    await loadData();
    setSelectedIds(new Set());
  };

  // Format Helper for Date Added
  const formatDateAdded = (iso?: string) => {
    if (!iso) return 'Legacy / Date unavailable';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Legacy / Date unavailable';
    return (
      d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            {isPracticeMode ? (
              <>
                <BookOpen className="text-brand-600" size={24} />
                <span>Practice Questions Management</span>
              </>
            ) : (
              <>
                <Layers className="text-brand-600" size={24} />
                <span>Question Bank Master Control</span>
              </>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isPracticeMode
              ? 'Manage exam practice questions directly. Changes reflect dynamically in the student app.'
              : 'Single source of truth for all student questions, practice sets, and mock tests.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportQuestionsToCsv(filtered)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition flex items-center gap-2 shadow-xs"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setEditingQuestion(null);
              setIsFormOpen(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-500/20 transition flex items-center gap-2"
          >
            <Plus size={16} />
            <span>{isPracticeMode ? 'Add Practice Question' : 'Add Question'}</span>
          </button>
        </div>
      </div>

      {/* Top Dashboard Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {isPracticeMode ? (
          <>
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Practice
              </span>
              <span className="text-xl font-black text-slate-900 mt-1 block">{stats.practiceCount}</span>
            </div>
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                Published
              </span>
              <span className="text-xl font-black text-emerald-600 mt-1 block">
                {questions.filter((q) => q.status === 'published' && questionUsages.get(q.id)?.inPractice).length}
              </span>
            </div>
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Draft / Unpub
              </span>
              <span className="text-xl font-black text-slate-700 mt-1 block">
                {questions.filter((q) => q.status !== 'published' && (q.usageType === 'PRACTICE' || q.usage_type === 'PRACTICE')).length}
              </span>
            </div>
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                Added Today
              </span>
              <span className="text-xl font-black text-indigo-600 mt-1 block">{stats.addedToday}</span>
            </div>
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                This Week
              </span>
              <span className="text-xl font-black text-indigo-600 mt-1 block">{stats.addedThisWeek}</span>
            </div>
            <div
              onClick={() => setUsageFilter('NOT_USED')}
              className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl shadow-xs cursor-pointer hover:bg-amber-100/60 transition"
            >
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                Unassigned
              </span>
              <span className="text-xl font-black text-amber-700 mt-1 block">{stats.notUsedCount}</span>
            </div>
          </>
        ) : (
          <>
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Questions
              </span>
              <span className="text-xl font-black text-slate-900 mt-1 block">{stats.total}</span>
            </div>
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                Available in App
              </span>
              <span className="text-xl font-black text-emerald-600 mt-1 block">{stats.availableInApp}</span>
            </div>
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider block">
                In Practice
              </span>
              <span className="text-xl font-black text-brand-600 mt-1 block">{stats.practiceCount}</span>
            </div>
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                In Mock Tests
              </span>
              <span className="text-xl font-black text-indigo-600 mt-1 block">
                {questions.filter((q) => (questionUsages.get(q.id)?.mockTests.length ?? 0) > 0).length}
              </span>
            </div>
            <div
              onClick={() => setUsageFilter('NOT_USED')}
              className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl shadow-xs cursor-pointer hover:bg-amber-100/60 transition"
              title="Click to filter questions not used anywhere"
            >
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                Not Used Anywhere
              </span>
              <span className="text-xl font-black text-amber-700 mt-1 block">{stats.notUsedCount}</span>
            </div>
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Draft</span>
              <span className="text-xl font-black text-slate-700 mt-1 block">{stats.draftCount}</span>
            </div>
          </>
        )}
      </div>

      {/* Filter Toolbar Container */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
        {/* Row 1: Search, Exam, Subject, Difficulty, Type */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search question text, topic, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
            />
          </div>

          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            className="text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none"
          >
            <option value="ALL">All Exams</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.code}>
                {ex.name} ({ex.code})
              </option>
            ))}
          </select>

          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none max-w-[160px] truncate"
          >
            <option value="ALL">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none"
          >
            <option value="ALL">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="IMAGE_ONLY">Images Only</option>
            <option value="TEXT_ONLY">Text Only</option>
          </select>
        </div>

        {/* Row 2: Usage, Specific Mock, Student Availability, Date Range, Sort */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Usage Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold text-[11px]">Usage:</span>
            <select
              value={usageFilter}
              onChange={(e) => setUsageFilter(e.target.value as any)}
              className="text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 outline-none"
            >
              <option value="ALL">All Usages</option>
              <option value="PRACTICE">Practice Only / In Practice</option>
              <option value="MOCK">Any Mock Test</option>
              <option value="BOTH">Practice + Mock</option>
              <option value="NOT_USED">Not Used Anywhere</option>
              <option value="SPECIFIC_MOCK">Specific Mock Test...</option>
            </select>
          </div>

          {usageFilter === 'SPECIFIC_MOCK' && (
            <select
              value={selectedMockId}
              onChange={(e) => setSelectedMockId(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 border border-brand-300 rounded-lg bg-brand-50/50 text-brand-900 outline-none max-w-[200px] truncate"
            >
              <option value="">-- Choose Mock Test --</option>
              {mockTests.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.examCode})
                </option>
              ))}
            </select>
          )}

          {/* Student Availability Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold text-[11px]">Student Availability:</span>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as any)}
              className="text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 outline-none"
            >
              <option value="ALL">All</option>
              <option value="AVAILABLE">Available in App</option>
              <option value="NOT_AVAILABLE">Not Available in App</option>
            </select>
          </div>

          {/* Date Added Filter */}
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-slate-400" />
            <span className="text-slate-400 font-semibold text-[11px]">Date Added:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 outline-none"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7">Last 7 Days</option>
              <option value="LAST_30">Last 30 Days</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="CUSTOM">Custom Range...</option>
            </select>
          </div>

          {dateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-[11px] bg-transparent outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-[11px] bg-transparent outline-none"
              />
            </div>
          )}

          {/* Sorting */}
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown size={13} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs font-semibold px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 outline-none"
            >
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
              <option value="RECENTLY_UPDATED">Recently Updated</option>
            </select>

            <button
              onClick={handleClearFilters}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition flex items-center gap-1"
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Showing <strong className="text-slate-900">{filtered.length}</strong> of{' '}
            <strong className="text-slate-900">{questions.length}</strong> Questions
          </span>

          {selectedIds.size > 0 && (
            <span className="font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
              {selectedIds.size} questions selected
            </span>
          )}
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="bg-brand-600 px-2.5 py-1 rounded-lg">{selectedIds.size} Selected</span>
            <span className="text-slate-300">Bulk Actions:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => {
                const selectedQs = questions.filter((q) => selectedIds.has(q.id));
                setAssignModalQuestions(selectedQs);
                setIsAssignModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition flex items-center gap-1.5"
            >
              <Layers size={14} />
              <span>Assign To...</span>
            </button>

            <button
              onClick={() => handleBulkSetUsage('PRACTICE')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
            >
              Set Practice Only
            </button>

            <button
              onClick={() => handleBulkSetUsage('BOTH')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
            >
              Set Practice + Mock
            </button>

            <button
              onClick={() => handleBulkSetStatus('published')}
              className="px-3 py-1.5 rounded-xl bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200 font-semibold transition"
            >
              Publish
            </button>

            <button
              onClick={() => handleBulkSetStatus('archived')}
              className="px-3 py-1.5 rounded-xl bg-amber-800/60 hover:bg-amber-700 text-amber-200 font-semibold transition"
            >
              Archive
            </button>

            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 rounded-xl bg-rose-800/60 hover:bg-rose-700 text-rose-200 font-bold transition flex items-center gap-1.5"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table View */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 w-10">
                  <button onClick={selectAllOnPage} className="p-1 hover:text-slate-900">
                    {selectedIds.size === paginatedQuestions.length && paginatedQuestions.length > 0 ? (
                      <CheckSquare size={16} className="text-brand-600" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4 min-w-[280px]">Question</th>
                <th className="py-3 px-4">Taxonomy</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 min-w-[160px]">Used In</th>
                <th className="py-3 px-4">Student Availability</th>
                <th className="py-3 px-4 whitespace-nowrap">Date Added</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedQuestions.map((q, idx) => {
                const isSelected = selectedIds.has(q.id);
                const usage = questionUsages.get(q.id) || computeQuestionUsage(q, mockTests, liveTests);
                const rowNum = (currentPage - 1) * pageSize + idx + 1;

                return (
                  <tr
                    key={q.id}
                    className={`hover:bg-slate-50/70 transition ${isSelected ? 'bg-brand-50/40' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-4">
                      <button onClick={() => toggleSelect(q.id)} className="p-1 text-slate-400 hover:text-slate-900">
                        {isSelected ? <CheckSquare size={16} className="text-brand-600" /> : <Square size={16} />}
                      </button>
                    </td>

                    {/* Question Excerpt */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-400 font-bold">#{rowNum}</span>
                          <span className="text-[10px] font-mono text-slate-400">ID: {q.id}</span>
                          {q.question_image_url && (
                            <span className="p-0.5 rounded bg-brand-50 text-brand-600" title="Contains diagram/image">
                              <ImageIcon size={12} />
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-800 line-clamp-2 leading-relaxed">
                          {q.question_text || '(No text — image question)'}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>Ans: <strong className="text-brand-600 font-bold">{q.correct_answer || 'None'}</strong></span>
                          <span>•</span>
                          <span>Diff: <span className="font-medium text-slate-600">{q.difficulty}</span></span>
                        </div>
                      </div>
                    </td>

                    {/* Taxonomy */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-800 block">{q.exam || 'Unassigned'}</span>
                        <span className="text-slate-500 block text-[11px]">{q.subject || 'No Subject'}</span>
                        <span className="text-slate-400 block text-[10px] italic">{q.topic || 'General'}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Badge
                        variant={
                          q.status === 'published' ? 'success' : q.status === 'draft' ? 'warning' : 'neutral'
                        }
                      >
                        {q.status}
                      </Badge>
                    </td>

                    {/* USED IN */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {usage.inPractice && (
                          <span
                            onClick={() => setUsageDrawerQuestion(q)}
                            className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition"
                          >
                            PRACTICE
                          </span>
                        )}

                        {usage.mockTests.slice(0, 2).map((m) => (
                          <span
                            key={m.id}
                            onClick={() => setUsageDrawerQuestion(q)}
                            className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 max-w-[130px] truncate cursor-pointer hover:bg-indigo-100 transition"
                            title={m.title}
                          >
                            {m.title}
                          </span>
                        ))}

                        {usage.mockTests.length > 2 && (
                          <button
                            onClick={() => setUsageDrawerQuestion(q)}
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                          >
                            +{usage.mockTests.length - 2} more
                          </button>
                        )}

                        {!usage.inPractice && usage.mockTests.length === 0 && (
                          <span
                            onClick={() => setUsageDrawerQuestion(q)}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 cursor-pointer hover:bg-slate-200 transition"
                          >
                            NOT USED
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Student Availability */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {usage.studentAvailable ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} /> Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                          <XCircle size={11} /> Not Available
                        </span>
                      )}
                    </td>

                    {/* Date Added */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                      {formatDateAdded(q.created_at)}
                    </td>

                    {/* Row Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setAssignModalQuestions([q]);
                            setIsAssignModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                          title="Direct Assignment"
                        >
                          <Layers size={15} />
                        </button>
                        <button
                          onClick={() => setPreviewQuestion(q)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                          title="Preview Question"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingQuestion(q);
                            setIsFormOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                          title="Edit Question"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => initiateDeleteSingle(q)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete / Archive Question"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedQuestions.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-xs text-slate-400">
                    No questions match the current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Page <strong className="text-slate-900">{currentPage}</strong> of{' '}
            <strong className="text-slate-900">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Safety Deletion Warning Modal */}
      {deleteWarningTarget && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              <ShieldAlert size={24} />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Question is Currently in Active Use</h3>
              <p className="text-xs text-slate-600 mt-1">
                Deleting this question may break student mock tests or active practice modules.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-slate-700 block">Where this question is used:</span>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                {deleteWarningTarget.usage.inPractice && (
                  <li>
                    <strong>Student Practice:</strong> {deleteWarningTarget.usage.practiceTaxonomy?.exam} •{' '}
                    {deleteWarningTarget.usage.practiceTaxonomy?.subject}
                  </li>
                )}
                {deleteWarningTarget.usage.mockTests.map((m) => (
                  <li key={m.id}>
                    <strong>Mock Test:</strong> {m.title} ({m.examCode})
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[11px] text-slate-500">
              We recommend <strong>Archiving</strong> instead of deleting, which preserves test continuity while hiding it from future assignments.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteWarningTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleArchiveQuestion(deleteWarningTarget.question)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition flex items-center gap-1.5"
              >
                <Archive size={14} />
                <span>Archive Question</span>
              </button>
              <button
                type="button"
                onClick={() => handleExecuteDelete(deleteWarningTarget.question.id)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
              >
                Force Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CBT Student Preview Modal */}
      <QuestionPreviewModal
        question={previewQuestion}
        isOpen={!!previewQuestion}
        onClose={() => setPreviewQuestion(null)}
      />

      {/* Add / Edit Question Form Modal */}
      <QuestionFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        questionToEdit={editingQuestion}
        onSaved={() => loadData()}
        exams={exams}
        subjects={subjects}
        defaultUsage={isPracticeMode ? 'PRACTICE' : 'BOTH'}
      />

      {/* Direct Assignment Modal */}
      <AssignToModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        questions={assignModalQuestions}
        mockTests={mockTests}
        exams={exams}
        subjects={subjects}
        topics={topics}
        onAssigned={() => loadData()}
      />

      {/* Usage Details Drawer */}
      <QuestionUsageDrawer
        isOpen={!!usageDrawerQuestion}
        onClose={() => setUsageDrawerQuestion(null)}
        question={usageDrawerQuestion}
        mockTests={mockTests}
        liveTests={liveTests}
        onNavigateToMock={(mId) => {
          setUsageDrawerQuestion(null);
          if (onNavigateToMock) onNavigateToMock(mId);
        }}
        onOpenAssignModal={() => {
          if (usageDrawerQuestion) {
            setAssignModalQuestions([usageDrawerQuestion]);
            setIsAssignModalOpen(true);
          }
        }}
      />
    </div>
  );
};
