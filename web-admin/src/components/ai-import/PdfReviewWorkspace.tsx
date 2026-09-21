import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import {
  PdfImportJob,
  StagedQuestion,
  Question,
  Exam,
  Subject,
  Topic,
  ReviewStatus,
} from '../../types';
import { PdfPageViewer } from './PdfPageViewer';
import { DocumentQuestionEditor } from './DocumentQuestionEditor';
import {
  updateStagedQuestion,
  updateStagedQuestionStatus,
} from '../../services/aiImportService';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  Search,
  Filter,
  Columns,
  Maximize2,
  FileText,
  Clock,
  Plus,
  ArrowRight,
  Check,
  RotateCcw,
  SlidersHorizontal,
  X,
  Keyboard,
} from 'lucide-react';

interface PdfReviewWorkspaceProps {
  job: PdfImportJob;
  pdfDoc: PDFDocumentProxy | null;
  stagedQuestions: StagedQuestion[];
  exams: Exam[];
  subjects: Subject[];
  topics: Topic[];
  initialQuestionIndex?: number;
  initialProblemsOnly?: boolean;
  onExitReview: () => void;
  onRefresh: () => void;
  onOpenImportScreen: () => void;
}

export const PdfReviewWorkspace: React.FC<PdfReviewWorkspaceProps> = ({
  job,
  pdfDoc,
  stagedQuestions,
  exams,
  subjects,
  topics,
  initialQuestionIndex = 0,
  initialProblemsOnly = false,
  onExitReview,
  onRefresh,
  onOpenImportScreen,
}) => {
  // View Mode: 'split' (40/60) | 'pdf' | 'editor'
  const [viewMode, setViewMode] = useState<'split' | 'pdf' | 'editor'>(() => {
    return (localStorage.getItem('andaman_review_view_mode') as any) || 'split';
  });

  // Filter Mode: Problems Only toggle
  const [problemsOnly, setProblemsOnly] = useState<boolean>(initialProblemsOnly);

  // Quick Filters
  const [quickFilter, setQuickFilter] = useState<
    'ALL' | 'PROBLEMS' | 'UNREVIEWED' | 'READY' | 'ANSWERS' | 'OCR' | 'DUPLICATES' | 'IMAGES' | 'APPROVED' | 'REJECTED'
  >('ALL');

  // Navigator open / collapse
  const [isNavigatorOpen, setIsNavigatorOpen] = useState<boolean>(false);
  const [navigatorSearch, setNavigatorSearch] = useState<string>('');

  // Missing question modal
  const [isAddMissingOpen, setIsAddMissingOpen] = useState<boolean>(false);
  const [missingQText, setMissingQText] = useState<string>('');
  const [missingOptA, setMissingOptA] = useState<string>('');
  const [missingOptB, setMissingOptB] = useState<string>('');
  const [missingOptC, setMissingOptC] = useState<string>('');
  const [missingOptD, setMissingOptD] = useState<string>('');
  const [missingAns, setMissingAns] = useState<'A' | 'B' | 'C' | 'D'>('A');

  // Autosave Status: 'idle' | 'saving' | 'saved'
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const pendingSaveTimerRef = useRef<any>(null);
  const pendingQuestionRef = useRef<StagedQuestion | null>(null);

  // Resizable split width (Left PDF width percentage, default 40%)
  const [pdfWidthPercent, setPdfWidthPercent] = useState<number>(40);
  const isDraggingSplitRef = useRef<boolean>(false);

  // Smart Priority Sorting Helper
  const getProblemPriorityScore = useCallback((q: StagedQuestion) => {
    // High score = higher priority for review
    let score = 0;
    if (q.confidence_level === 'ERROR') score += 100;
    if (q.confidence_level === 'LOW') score += 80;

    const pdfKey = (q.admin_notes?.match(/SOURCE_ANSWER:([A-D])/)?.[1] || '').toUpperCase();
    if (pdfKey && q.correct_answer && pdfKey !== q.correct_answer) score += 90; // Answer Mismatch
    if (!q.correct_answer) score += 70; // Missing Answer
    if (q.is_duplicate) score += 60; // Duplicate
    if (!q.option_a_text || !q.option_b_text || !q.option_c_text || !q.option_d_text) score += 50; // Missing option
    if (q.confidence_level === 'REVIEW') score += 40;
    if (q.validation_warnings && q.validation_warnings.length > 0) score += 30;

    return score;
  }, []);

  // Filtered Questions Queue based on problemsOnly & quickFilter
  const queueQuestions = useMemo(() => {
    return stagedQuestions.filter((q) => {
      const priority = getProblemPriorityScore(q);
      const isProblem = priority > 0;

      // 1. Problems Only Master Switch
      if (problemsOnly && !isProblem) return false;

      // 2. Quick Filter
      if (quickFilter === 'PROBLEMS' && !isProblem) return false;
      if (quickFilter === 'UNREVIEWED' && q.review_status !== 'pending') return false;
      if (quickFilter === 'READY' && (isProblem || q.review_status !== 'pending')) return false;
      if (quickFilter === 'APPROVED' && q.review_status !== 'approved') return false;
      if (quickFilter === 'REJECTED' && q.review_status !== 'rejected') return false;
      if (quickFilter === 'DUPLICATES' && !q.is_duplicate) return false;
      if (quickFilter === 'IMAGES' && !q.question_image_url) return false;
      if (quickFilter === 'ANSWERS') {
        const pdfKey = (q.admin_notes?.match(/SOURCE_ANSWER:([A-D])/)?.[1] || '').toUpperCase();
        if (!(pdfKey && q.correct_answer && pdfKey !== q.correct_answer) && q.correct_answer) return false;
      }
      if (quickFilter === 'OCR' && q.confidence_level !== 'REVIEW' && q.confidence_level !== 'LOW') return false;

      return true;
    });
  }, [stagedQuestions, problemsOnly, quickFilter, getProblemPriorityScore]);

  // Current Active Question Pointer
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    const saved = localStorage.getItem(`andaman_review_idx_${job.id}`);
    const parsed = saved ? parseInt(saved, 10) : initialQuestionIndex;
    return isNaN(parsed) ? 0 : parsed;
  });

  // Clamp current index if queue changes
  useEffect(() => {
    if (currentIndex >= queueQuestions.length && queueQuestions.length > 0) {
      setCurrentIndex(queueQuestions.length - 1);
    }
  }, [queueQuestions.length, currentIndex]);

  const currentQuestion = queueQuestions[currentIndex] || null;

  // Persist session checkpoint
  useEffect(() => {
    if (job.id) {
      localStorage.setItem(`andaman_review_idx_${job.id}`, currentIndex.toString());
    }
  }, [currentIndex, job.id]);

  const handleSetViewMode = (mode: 'split' | 'pdf' | 'editor') => {
    setViewMode(mode);
    localStorage.setItem('andaman_review_view_mode', mode);
  };

  // Immediate Save Function
  const savePendingImmediately = useCallback(async () => {
    if (pendingSaveTimerRef.current) {
      clearTimeout(pendingSaveTimerRef.current);
      pendingSaveTimerRef.current = null;
    }
    if (pendingQuestionRef.current && job.id) {
      const qToSave = pendingQuestionRef.current;
      pendingQuestionRef.current = null;
      setSaveStatus('saving');
      try {
        await updateStagedQuestion(job.id, qToSave);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Autosave error:', err);
        setSaveStatus('idle');
      }
    }
  }, [job.id]);

  // Debounced Autosave on Change
  const handleQuestionChange = (updated: StagedQuestion) => {
    pendingQuestionRef.current = updated;
    setSaveStatus('saving');

    if (pendingSaveTimerRef.current) {
      clearTimeout(pendingSaveTimerRef.current);
    }

    pendingSaveTimerRef.current = setTimeout(async () => {
      await savePendingImmediately();
    }, 700);
  };

  // Navigation Handlers
  const handleGoNext = useCallback(async () => {
    await savePendingImmediately();
    if (currentIndex < queueQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, queueQuestions.length, savePendingImmediately]);

  const handleGoPrev = useCallback(async () => {
    await savePendingImmediately();
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex, savePendingImmediately]);

  // Primary Action: Approve & Next
  const handleApproveAndNext = useCallback(async () => {
    if (!currentQuestion) return;

    await savePendingImmediately();
    setSaveStatus('saving');

    try {
      // 1. Mark status approved in Firestore
      await updateStagedQuestionStatus(job.id, currentQuestion.id, 'approved');
      currentQuestion.review_status = 'approved';

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);

      // 2. Advance to next question
      if (currentIndex < queueQuestions.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        onRefresh();
      }
    } catch (err) {
      console.error('Approve error:', err);
      alert('Failed to approve question.');
      setSaveStatus('idle');
    }
  }, [currentQuestion, job.id, currentIndex, queueQuestions.length, onRefresh, savePendingImmediately]);

  // Needs Review Action
  const handleMarkNeedsReview = useCallback(async () => {
    if (!currentQuestion) return;
    await savePendingImmediately();
    try {
      await updateStagedQuestion(job.id, {
        ...currentQuestion,
        confidence_level: 'REVIEW',
        review_status: 'pending',
      });
      handleGoNext();
    } catch (err) {
      console.error('Mark review error:', err);
    }
  }, [currentQuestion, job.id, handleGoNext, savePendingImmediately]);

  // Reject Action
  const handleReject = useCallback(async () => {
    if (!currentQuestion) return;
    await savePendingImmediately();
    try {
      await updateStagedQuestionStatus(job.id, currentQuestion.id, 'rejected');
      currentQuestion.review_status = 'rejected';
      handleGoNext();
    } catch (err) {
      console.error('Reject error:', err);
    }
  }, [currentQuestion, job.id, handleGoNext, savePendingImmediately]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement)?.isContentEditable;

      // Ctrl + Enter: Approve & Next (Works anywhere, even inside inputs)
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleApproveAndNext();
        return;
      }

      // Ctrl + S: Manual Save
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        savePendingImmediately();
        return;
      }

      // Alt + ArrowRight: Next
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleGoNext();
        return;
      }

      // Alt + ArrowLeft: Previous
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleGoPrev();
        return;
      }

      // Alt + 1, 2, 3, 4: Set Option A, B, C, D
      if (e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, 'A' | 'B' | 'C' | 'D'> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        if (currentQuestion) {
          handleQuestionChange({ ...currentQuestion, correct_answer: map[e.key] });
        }
        return;
      }

      // 'r' key for Needs Review (Only when not focused on an input)
      if (!isInput && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleMarkNeedsReview();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleApproveAndNext, handleGoNext, handleGoPrev, savePendingImmediately, currentQuestion, handleMarkNeedsReview]);

  // Resizable Split Dragging Logic
  const handleSplitMouseDown = () => {
    isDraggingSplitRef.current = true;
    document.body.style.cursor = 'col-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplitRef.current) return;
      const percent = (e.clientX / window.innerWidth) * 100;
      if (percent >= 20 && percent <= 75) {
        setPdfWidthPercent(Math.round(percent));
      }
    };

    const handleMouseUp = () => {
      if (isDraggingSplitRef.current) {
        isDraggingSplitRef.current = false;
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Reviewed counts
  const totalCount = stagedQuestions.length;
  const reviewedCount = stagedQuestions.filter((q) => q.review_status !== 'pending').length;
  const approvedCount = stagedQuestions.filter((q) => q.review_status === 'approved').length;

  // Handle Add Missing Question Submission
  const handleCreateMissingQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missingQText.trim()) return;

    const newQ: StagedQuestion = {
      id: `q_manual_${Date.now()}`,
      jobId: job.id,
      batchId: 'manual',
      question_text: missingQText.trim(),
      option_a_text: missingOptA.trim(),
      option_b_text: missingOptB.trim(),
      option_c_text: missingOptC.trim(),
      option_d_text: missingOptD.trim(),
      correct_answer: missingAns,
      explanation_text: '',
      exam: currentQuestion?.exam || 'ANCHSL',
      subject: currentQuestion?.subject || 'General Awareness',
      topic: currentQuestion?.topic || 'General',
      difficulty: 'Medium',
      positive_marks: 2.0,
      negative_marks: 0.5,
      language: 'both',
      source_pdf: job.fileName,
      source_page: currentQuestion?.source_page || 1,
      source_question_number: `+${stagedQuestions.length + 1}`,
      confidence_score: 100,
      confidence_level: 'HIGH',
      review_status: 'approved',
      answer_source: 'MANUAL',
      validation_warnings: [],
      is_duplicate: false,
    };

    try {
      await updateStagedQuestion(job.id, newQ);
      stagedQuestions.push(newQ);
      setIsAddMissingOpen(false);
      setMissingQText('');
      setMissingOptA('');
      setMissingOptB('');
      setMissingOptC('');
      setMissingOptD('');
      onRefresh();
    } catch (err) {
      console.error('Failed to create missing question:', err);
      alert('Could not save missing question.');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-100 flex flex-col overflow-hidden text-slate-900 animate-fadeIn">
      {/* 1. Permanent Top Navigation & Status Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 shrink-0 shadow-xs z-30">
        {/* Left: Back & Question Progress */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExitReview}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 text-xs font-bold transition flex items-center gap-1.5"
          >
            <ChevronLeft size={16} />
            <span>Summary</span>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          {/* Current Question Position */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-900">
              Question {queueQuestions.length > 0 ? currentIndex + 1 : 0} of {queueQuestions.length}
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              (Reviewed: {reviewedCount}/{totalCount})
            </span>
          </div>

          {/* Navigator Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsNavigatorOpen(true)}
            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg text-xs font-bold transition flex items-center gap-1"
            title="Open Question Navigator"
          >
            <SlidersHorizontal size={14} />
            <span>Jump</span>
          </button>
        </div>

        {/* Center: Problems Only Toggle & Autosave Indicator */}
        <div className="flex items-center gap-3">
          {/* Problems Only Toggle Pill */}
          <label className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 cursor-pointer select-none text-xs">
            <input
              type="checkbox"
              checked={problemsOnly}
              onChange={(e) => {
                setProblemsOnly(e.target.checked);
                setCurrentIndex(0);
              }}
              className="w-3.5 h-3.5 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
            />
            <span className={`font-bold ${problemsOnly ? 'text-brand-700' : 'text-slate-600'}`}>
              Problems Only
            </span>
          </label>

          {/* Autosave Status Pill */}
          <div className="flex items-center gap-1 text-[11px] font-medium min-w-[70px]">
            {saveStatus === 'saving' && (
              <span className="text-amber-600 font-bold flex items-center gap-1 animate-pulse">
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Check size={13} /> Saved ✓
              </span>
            )}
            {saveStatus === 'idle' && (
              <span className="text-slate-400">Autosaved ✓</span>
            )}
          </div>
        </div>

        {/* Right: View Modes, Add Missing, Ready to Import */}
        <div className="flex items-center gap-2">
          {/* Split / Focus Mode Buttons */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => handleSetViewMode('split')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                viewMode === 'split' ? 'bg-white text-brand-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Split
            </button>
            <button
              onClick={() => handleSetViewMode('pdf')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                viewMode === 'pdf' ? 'bg-white text-brand-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              PDF
            </button>
            <button
              onClick={() => handleSetViewMode('editor')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                viewMode === 'editor' ? 'bg-white text-brand-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Editor
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAddMissingOpen(true)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition flex items-center gap-1"
          >
            <Plus size={14} />
            <span>Add Missing</span>
          </button>

          <button
            type="button"
            onClick={onOpenImportScreen}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <CheckCircle2 size={14} />
            <span>Import ({approvedCount})</span>
          </button>
        </div>
      </header>

      {/* 2. Workspace Body (Split or Focus) */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3 relative">
        {/* LEFT PANEL: Source PDF */}
        {(viewMode === 'split' || viewMode === 'pdf') && (
          <div
            style={{ width: viewMode === 'split' ? `${pdfWidthPercent}%` : '100%' }}
            className="h-full flex flex-col shrink-0 transition-all duration-75"
          >
            <PdfPageViewer
              pdfDoc={pdfDoc}
              pageNumber={currentQuestion?.source_page || 1}
              highlightQuestionNum={currentQuestion?.source_question_number}
              onPageChange={(newPage) => {
                if (currentQuestion) {
                  handleQuestionChange({ ...currentQuestion, source_page: newPage });
                }
              }}
              onCropImage={(dataUrl) => {
                if (currentQuestion) {
                  handleQuestionChange({ ...currentQuestion, question_image_url: dataUrl });
                }
              }}
            />
          </div>
        )}

        {/* Resizable Split Divider */}
        {viewMode === 'split' && (
          <div
            onMouseDown={handleSplitMouseDown}
            className="w-1 hover:w-1.5 bg-slate-300 hover:bg-brand-500 cursor-col-resize transition-all rounded-full select-none"
            title="Drag to resize panels"
          />
        )}

        {/* RIGHT PANEL: Document Question Editor */}
        {(viewMode === 'split' || viewMode === 'editor') && (
          <div className="flex-1 h-full flex flex-col overflow-hidden">
            <DocumentQuestionEditor
              question={currentQuestion}
              exams={exams}
              subjects={subjects}
              topics={topics}
              onChange={handleQuestionChange}
              onCropFromPdfRequest={() => {
                // If in editor-only mode, switch to split mode so admin can crop
                if (viewMode === 'editor') handleSetViewMode('split');
              }}
            />
          </div>
        )}
      </main>

      {/* 3. Sticky Bottom One-Click Review Bar */}
      <footer className="h-16 bg-white border-t border-slate-200 px-6 flex items-center justify-between gap-4 shrink-0 shadow-lg z-30">
        {/* Left: Previous with Alt+Left hint */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGoPrev}
            disabled={currentIndex <= 0}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition flex items-center gap-1.5"
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
            <kbd className="text-[10px] text-slate-400 font-mono ml-1">Alt+←</kbd>
          </button>
        </div>

        {/* Center: Secondary Reject & Needs Review */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleReject}
            className="px-4 py-2 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5"
          >
            <XCircle size={15} />
            <span>Reject</span>
          </button>

          <button
            type="button"
            onClick={handleMarkNeedsReview}
            className="px-4 py-2 rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-bold transition flex items-center gap-1.5"
          >
            <AlertTriangle size={15} />
            <span>Needs Review</span>
            <kbd className="text-[10px] text-amber-500 font-mono ml-0.5">R</kbd>
          </button>
        </div>

        {/* Right: Primary APPROVE & NEXT Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGoNext}
            disabled={currentIndex >= queueQuestions.length - 1}
            className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30 text-xs font-bold transition flex items-center gap-1"
          >
            <span>Skip</span>
            <kbd className="text-[10px] text-slate-400 font-mono ml-0.5">Alt+→</kbd>
          </button>

          <button
            type="button"
            onClick={handleApproveAndNext}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-md shadow-emerald-600/30 transition flex items-center gap-2"
          >
            <Check size={18} />
            <span>Approve & Next</span>
            <kbd className="text-[10px] text-emerald-100 bg-emerald-700/60 px-1.5 py-0.5 rounded font-mono ml-1">
              Ctrl+Enter
            </kbd>
          </button>
        </div>
      </footer>

      {/* 4. Collapsible Question Navigator Drawer */}
      {isNavigatorOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-start animate-fadeIn">
          <div className="w-80 bg-white h-full shadow-2xl flex flex-col border-r border-slate-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Question Navigator</h3>
                <p className="text-[11px] text-slate-400">Jump directly to any extracted question</p>
              </div>
              <button
                onClick={() => setIsNavigatorOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Filter Selector inside Navigator */}
            <div className="p-3 border-b border-slate-100 space-y-2">
              <input
                type="text"
                placeholder="Filter by question # or text..."
                value={navigatorSearch}
                onChange={(e) => setNavigatorSearch(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none"
              />

              <div className="flex flex-wrap gap-1">
                {(['ALL', 'PROBLEMS', 'UNREVIEWED', 'READY', 'APPROVED'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setQuickFilter(f);
                      setCurrentIndex(0);
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${
                      quickFilter === f
                        ? 'bg-brand-50 border-brand-500 text-brand-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Question List */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 text-xs">
              {queueQuestions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isApproved = q.review_status === 'approved';
                const isRejected = q.review_status === 'rejected';
                const isProblem = getProblemPriorityScore(q) > 0;

                return (
                  <div
                    key={q.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setIsNavigatorOpen(false);
                    }}
                    className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between ${
                      isCurrent
                        ? 'bg-brand-50 font-bold text-brand-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Status Icon */}
                      {isApproved && <CheckCircle2 size={15} className="text-emerald-500" />}
                      {isRejected && <XCircle size={15} className="text-rose-500" />}
                      {!isApproved && !isRejected && isProblem && (
                        <AlertTriangle size={15} className="text-amber-500" />
                      )}
                      {!isApproved && !isRejected && !isProblem && (
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-300 block" />
                      )}

                      <span className="font-mono text-[11px]">Q{q.source_question_number}</span>
                      <span className="text-[11px] truncate max-w-[140px]">
                        {q.question_text || 'Diagram Question'}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono">p.{q.source_page}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. Add Missing Question Modal */}
      {isAddMissingOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus size={18} className="text-brand-600" />
                <span>Add Missing Question</span>
              </h3>
              <button onClick={() => setIsAddMissingOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateMissingQuestion} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Question Statement</label>
                <textarea
                  rows={3}
                  required
                  value={missingQText}
                  onChange={(e) => setMissingQText(e.target.value)}
                  placeholder="Enter question statement..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-600 mb-0.5">Option A</label>
                  <input
                    type="text"
                    required
                    value={missingOptA}
                    onChange={(e) => setMissingOptA(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-0.5">Option B</label>
                  <input
                    type="text"
                    required
                    value={missingOptB}
                    onChange={(e) => setMissingOptB(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-0.5">Option C</label>
                  <input
                    type="text"
                    required
                    value={missingOptC}
                    onChange={(e) => setMissingOptC(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-0.5">Option D</label>
                  <input
                    type="text"
                    required
                    value={missingOptD}
                    onChange={(e) => setMissingOptD(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Correct Answer</label>
                <select
                  value={missingAns}
                  onChange={(e) => setMissingAns(e.target.value as any)}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 font-bold"
                >
                  <option value="A">Option A</option>
                  <option value="B">Option B</option>
                  <option value="C">Option C</option>
                  <option value="D">Option D</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddMissingOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition shadow-xs"
                >
                  Add & Approve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
