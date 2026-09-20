import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import {
  PdfImportJob,
  StagedQuestion,
  Question,
  Exam,
  Subject,
  Topic,
} from '../../types';
import { PdfPageViewer } from './PdfPageViewer';
import { QuestionEditorPane } from './QuestionEditorPane';
import { BulkApprovalModal } from './BulkApprovalModal';
import { DuplicateResolutionModal } from './DuplicateResolutionModal';
import {
  updateStagedQuestion,
  updateStagedQuestionStatus,
  updateJobState,
} from '../../services/aiImportService';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  CheckSquare
} from 'lucide-react';

interface ReviewQueueTabProps {
  job: PdfImportJob | null;
  pdfDoc: PDFDocumentProxy | null;
  stagedQuestions: StagedQuestion[];
  existingQuestions: Question[];
  exams: Exam[];
  subjects: Subject[];
  topics: Topic[];
  onRefresh: () => void;
}

export const ReviewQueueTab: React.FC<ReviewQueueTabProps> = ({
  job,
  pdfDoc,
  stagedQuestions,
  existingQuestions,
  exams,
  subjects,
  topics,
  onRefresh,
}) => {
  // Navigation
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<
    'ALL' | 'HIGH' | 'NEEDS_REVIEW' | 'ERRORS' | 'MISSING_ANSWER' | 'MISSING_OPTION' | 'IMAGES' | 'DUPLICATES'
  >('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');

  // Modals
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isDupModalOpen, setIsDupModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return stagedQuestions.filter((q) => {
      // 1. Status Filter: Only review items that are 'pending' or 'skipped'
      if (q.review_status === 'approved' || q.review_status === 'rejected') {
        return false;
      }

      // 2. Category Filter Pills
      if (categoryFilter === 'HIGH' && q.confidence_level !== 'HIGH') return false;
      if (categoryFilter === 'NEEDS_REVIEW' && q.confidence_level !== 'MEDIUM') return false;
      if (categoryFilter === 'ERRORS' && q.confidence_level !== 'LOW') return false;
      if (categoryFilter === 'MISSING_ANSWER' && q.correct_answer) return false;
      if (
        categoryFilter === 'MISSING_OPTION' &&
        q.option_a_text &&
        q.option_b_text &&
        q.option_c_text &&
        q.option_d_text
      )
        return false;
      if (categoryFilter === 'IMAGES' && !q.question_image_url) return false;
      if (categoryFilter === 'DUPLICATES' && !q.is_duplicate) return false;

      // 3. Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesText = q.question_text.toLowerCase().includes(term);
        const matchesNum = q.source_question_number.toString().includes(term);
        const matchesTopic = q.topic.toLowerCase().includes(term);
        if (!matchesText && !matchesNum && !matchesTopic) return false;
      }

      // 4. Subject
      if (selectedSubject !== 'ALL' && q.subject !== selectedSubject) return false;

      // 5. Difficulty
      if (selectedDifficulty !== 'ALL' && q.difficulty !== selectedDifficulty) return false;

      return true;
    });
  }, [stagedQuestions, categoryFilter, searchTerm, selectedSubject, selectedDifficulty]);

  // Ensure currentIndex stays within bounds
  useEffect(() => {
    if (currentIndex >= filteredQuestions.length && filteredQuestions.length > 0) {
      setCurrentIndex(filteredQuestions.length - 1);
    }
  }, [filteredQuestions.length, currentIndex]);

  const currentQuestion = filteredQuestions[currentIndex] || null;

  // Question handlers
  const handleSaveQuestion = async (updated: StagedQuestion) => {
    if (!job) return;
    setIsSaving(true);
    try {
      await updateStagedQuestion(job.id, updated);
      onRefresh();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAndNext = async (updated: StagedQuestion) => {
    if (!job || !currentQuestion) return;
    setIsSaving(true);
    try {
      // Save updates and mark approved
      await updateStagedQuestion(job.id, updated);
      await updateStagedQuestionStatus(job.id, currentQuestion.id, 'approved');
      onRefresh();
      // Keep index steady so next question shifts into view
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!job || !currentQuestion) return;
    try {
      await updateStagedQuestionStatus(job.id, currentQuestion.id, 'rejected');
      onRefresh();
    } catch (err) {
      console.error('Reject failed:', err);
    }
  };

  const handleSkip = async () => {
    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Keyboard Shortcuts (Cmd+Enter = Approve & Next, Cmd+S = Save, Left/Right = Prev/Next)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is actively typing in an input or textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (currentQuestion) handleApproveAndNext(currentQuestion);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (currentQuestion) handleSaveQuestion(currentQuestion);
      } else if (!isInput) {
        if (e.key === 'ArrowRight') {
          handleNext();
        } else if (e.key === 'ArrowLeft') {
          handlePrevious();
        } else if (e.key === 'Delete') {
          handleReject();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, currentIndex, filteredQuestions.length]);

  // Bulk Approval Execution
  const handleBulkApproveConfirm = async (eligible: StagedQuestion[]) => {
    if (!job) return;
    setIsSaving(true);
    try {
      for (const q of eligible) {
        await updateStagedQuestionStatus(job.id, q.id, 'approved');
      }
      setIsBulkModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Bulk approve error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate Resolution Execution
  const handleDuplicateResolve = async (action: 'keep_existing' | 'replace_existing' | 'import_anyway') => {
    if (!job || !currentQuestion) return;
    try {
      if (action === 'keep_existing') {
        await updateStagedQuestionStatus(job.id, currentQuestion.id, 'rejected', 'Rejected as duplicate');
      } else if (action === 'replace_existing') {
        await updateStagedQuestion(job.id, {
          ...currentQuestion,
          is_duplicate: false,
          admin_notes: 'Replaces existing question',
        });
      } else {
        await updateStagedQuestion(job.id, {
          ...currentQuestion,
          is_duplicate: false,
          admin_notes: 'Confirmed distinct by admin',
        });
      }
      setIsDupModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Duplicate resolution error:', err);
    }
  };

  const matchedExisting = useMemo(() => {
    if (!currentQuestion?.duplicate_of_id) return null;
    return existingQuestions.find((q) => q.id === currentQuestion.duplicate_of_id) || null;
  }, [currentQuestion, existingQuestions]);

  if (!job) {
    return (
      <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
        <p className="text-sm font-semibold">No Active Job Selected</p>
        <p className="text-xs text-slate-500 mt-1">Please select an import job to inspect the Review Queue.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-3 text-slate-200">
      {/* Top Filter & Control Bar */}
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {[
            { id: 'ALL', label: 'All Pending', count: stagedQuestions.filter((q) => q.review_status === 'pending').length },
            { id: 'HIGH', label: 'High Confidence', count: stagedQuestions.filter((q) => q.review_status === 'pending' && q.confidence_level === 'HIGH').length },
            { id: 'NEEDS_REVIEW', label: 'Needs Review', count: stagedQuestions.filter((q) => q.review_status === 'pending' && q.confidence_level === 'MEDIUM').length },
            { id: 'ERRORS', label: 'Errors / Low', count: stagedQuestions.filter((q) => q.review_status === 'pending' && q.confidence_level === 'LOW').length },
            { id: 'MISSING_ANSWER', label: 'Missing Answer', count: stagedQuestions.filter((q) => q.review_status === 'pending' && !q.correct_answer).length },
            { id: 'MISSING_OPTION', label: 'Missing Option', count: stagedQuestions.filter((q) => q.review_status === 'pending' && (!q.option_a_text || !q.option_b_text || !q.option_c_text || !q.option_d_text)).length },
            { id: 'IMAGES', label: 'Images', count: stagedQuestions.filter((q) => q.review_status === 'pending' && q.question_image_url).length },
            { id: 'DUPLICATES', label: 'Duplicates', count: stagedQuestions.filter((q) => q.review_status === 'pending' && q.is_duplicate).length },
          ].map((pill) => {
            const isActive = categoryFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => {
                  setCategoryFilter(pill.id as any);
                  setCurrentIndex(0);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{pill.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Navigation & Bulk Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Queue:</span>
            <span className="font-bold text-white">
              {filteredQuestions.length > 0 ? currentIndex + 1 : 0}
            </span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{filteredQuestions.length}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 transition"
              title="Previous Question (Arrow Left)"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= filteredQuestions.length - 1}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 transition"
              title="Next Question (Arrow Right)"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => setIsBulkModalOpen(true)}
            disabled={filteredQuestions.length === 0}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition flex items-center gap-1.5"
          >
            <ShieldCheck size={15} className="text-emerald-400" />
            Bulk Approve Safe
          </button>
        </div>
      </div>

      {/* Main Split Screen (50% PDF Canvas + 50% Question Editor) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0">
        {/* Left Pane: High-Res PDF Page Canvas */}
        <PdfPageViewer
          pdfDoc={pdfDoc}
          pageNumber={currentQuestion?.source_page || 1}
          highlightQuestionNum={currentQuestion?.source_question_number}
        />

        {/* Right Pane: Interactive Question Form */}
        <QuestionEditorPane
          question={currentQuestion}
          exams={exams}
          subjects={subjects}
          topics={topics}
          onSave={handleSaveQuestion}
          onApproveAndNext={handleApproveAndNext}
          onSkip={handleSkip}
          onReject={handleReject}
          onResolveDuplicate={() => setIsDupModalOpen(true)}
          isSaving={isSaving}
        />
      </div>

      {/* Modals */}
      <BulkApprovalModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        questions={filteredQuestions}
        onConfirm={handleBulkApproveConfirm}
        isProcessing={isSaving}
      />

      {currentQuestion && (
        <DuplicateResolutionModal
          isOpen={isDupModalOpen}
          onClose={() => setIsDupModalOpen(false)}
          incomingQuestion={currentQuestion}
          existingQuestion={matchedExisting}
          onResolve={handleDuplicateResolve}
        />
      )}
    </div>
  );
};
