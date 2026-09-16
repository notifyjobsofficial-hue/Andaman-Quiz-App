import React, { useEffect, useState } from 'react';
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
  ChevronRight
} from 'lucide-react';
import {
  fetchQuestions,
  deleteQuestion,
  bulkDeleteQuestions,
  fetchExams,
  fetchSubjects
} from '../firebase/firestore';
import { Question, Exam, Subject } from '../types';
import { Badge } from '../components/common/Badge';
import { QuestionPreviewModal } from '../components/questions/QuestionPreviewModal';
import { QuestionFormModal } from '../components/questions/QuestionFormModal';
import { exportQuestionsToCsv } from '../utils/excelParser';

export const QuestionBank: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExam, setSelectedExam] = useState('ALL');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IMAGE_ONLY' | 'TEXT_ONLY'>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Selected for Bulk Action
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [q, e, s] = await Promise.all([fetchQuestions(1000), fetchExams(), fetchSubjects()]);
      setQuestions(q);
      setExams(e);
      setSubjects(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Questions
  const filtered = questions.filter((q) => {
    const matchesSearch =
      q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.topic.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesExam = selectedExam === 'ALL' || q.exam === selectedExam;
    const matchesSubject = selectedSubject === 'ALL' || q.subject === selectedSubject;
    const matchesDiff = selectedDifficulty === 'ALL' || q.difficulty === selectedDifficulty;

    const hasImages = !!(
      q.question_image_url ||
      q.option_a_image_url ||
      q.option_b_image_url ||
      q.option_c_image_url ||
      q.option_d_image_url
    );

    const matchesType =
      typeFilter === 'ALL' ||
      (typeFilter === 'IMAGE_ONLY' && hasImages) ||
      (typeFilter === 'TEXT_ONLY' && !hasImages);

    return matchesSearch && matchesExam && matchesSubject && matchesDiff && matchesType;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedQuestions = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

  const handleBulkDelete = async () => {
    if (confirm(`Delete ${selectedIds.size} selected questions? This cannot be undone.`)) {
      await bulkDeleteQuestions(Array.from(selectedIds));
      setSelectedIds(new Set());
      loadData();
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (confirm('Delete this question from the Question Bank?')) {
      await deleteQuestion(id);
      loadData();
    }
  };

  const handleDuplicate = (q: Question) => {
    const duplicated: Question = {
      ...q,
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      question_text: `(Copy) ${q.question_text}`,
    };
    setEditingQuestion(duplicated);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Question Bank</h1>
          <p className="text-xs text-slate-500 mt-1">
            Central repository of all competitive questions, diagrams, and solution keys.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportQuestionsToCsv(filtered)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
          >
            <Download size={14} /> Export Filtered ({filtered.length})
          </button>
          <button
            onClick={() => {
              setEditingQuestion(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus size={14} /> Add Single Question
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search question text, topic, ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={selectedExam}
              onChange={(e) => {
                setSelectedExam(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs p-2 border border-slate-200 rounded-xl bg-white outline-none"
            >
              <option value="ALL">All Exams</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.code}>{ex.name} ({ex.code})</option>
              ))}
            </select>

            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs p-2 border border-slate-200 rounded-xl bg-white outline-none"
            >
              <option value="ALL">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.name}>{sub.name}</option>
              ))}
            </select>

            <select
              value={selectedDifficulty}
              onChange={(e) => {
                setSelectedDifficulty(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs p-2 border border-slate-200 rounded-xl bg-white outline-none"
            >
              <option value="ALL">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="text-xs p-2 border border-slate-200 rounded-xl bg-white outline-none"
            >
              <option value="ALL">All Question Types</option>
              <option value="IMAGE_ONLY">Has Diagrams / Images</option>
              <option value="TEXT_ONLY">Text Only</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-2.5 bg-brand-50 border border-brand-200 rounded-xl text-xs">
            <span className="font-bold text-brand-900">
              {selectedIds.size} questions selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition"
              >
                <Trash2 size={13} /> Delete Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Questions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <button
              onClick={selectAllOnPage}
              className="p-1 text-slate-500 hover:text-slate-800"
              title="Select all on page"
            >
              {selectedIds.size > 0 && selectedIds.size === paginatedQuestions.length ? (
                <CheckSquare size={16} className="text-brand-600" />
              ) : (
                <Square size={16} />
              )}
            </button>
            <span>Showing {paginatedQuestions.length} of {filtered.length} questions</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Page {currentPage} of {totalPages}</span>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {paginatedQuestions.map((q) => {
            const isChecked = selectedIds.has(q.id);
            const hasImages = !!(q.question_image_url || q.option_a_image_url || q.option_b_image_url || q.option_c_image_url || q.option_d_image_url);

            return (
              <div
                key={q.id}
                className={`p-4 flex items-start gap-3 hover:bg-slate-50 transition ${
                  isChecked ? 'bg-brand-50/30' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSelect(q.id)}
                  className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 mt-1 cursor-pointer"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Badge variant="info">{q.exam}</Badge>
                    <Badge variant="neutral">{q.subject}</Badge>
                    <Badge variant={q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Hard' ? 'danger' : 'warning'}>
                      {q.difficulty}
                    </Badge>
                    {hasImages && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                        <ImageIcon size={10} /> Diagram
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-slate-400 ml-auto">
                      Ans: <span className="text-emerald-700 font-extrabold">{q.correct_answer}</span>
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-900 leading-relaxed line-clamp-2">
                    {q.question_text || '[Image Only Question]'}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-[11px] text-slate-500">
                    <span className={q.correct_answer === 'A' ? 'font-bold text-emerald-700' : ''}>
                      A: {q.option_a_text || (q.option_a_image_url ? '[Img]' : '-')}
                    </span>
                    <span className={q.correct_answer === 'B' ? 'font-bold text-emerald-700' : ''}>
                      B: {q.option_b_text || (q.option_b_image_url ? '[Img]' : '-')}
                    </span>
                    <span className={q.correct_answer === 'C' ? 'font-bold text-emerald-700' : ''}>
                      C: {q.option_c_text || (q.option_c_image_url ? '[Img]' : '-')}
                    </span>
                    <span className={q.correct_answer === 'D' ? 'font-bold text-emerald-700' : ''}>
                      D: {q.option_d_text || (q.option_d_image_url ? '[Img]' : '-')}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1 self-center">
                  <button
                    onClick={() => setPreviewQuestion(q)}
                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                    title="Student CBT Preview"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setEditingQuestion(q);
                      setIsFormOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    title="Edit Question"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDuplicate(q)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    title="Duplicate Question"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteSingle(q.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete Question"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          {paginatedQuestions.length === 0 && !loading && (
            <div className="p-12 text-center text-xs text-slate-400">
              No questions match the current filter criteria.
            </div>
          )}
        </div>
      </div>

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
      />
    </div>
  );
};
