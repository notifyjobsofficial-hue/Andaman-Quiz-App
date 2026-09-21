import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import {
  UploadCloud,
  Layers,
  CheckSquare,
  CheckCircle2,
  XCircle,
  History,
  Sparkles,
  Loader2,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Check,
  Clock,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import {
  PdfImportJob,
  StagedQuestion,
  Question,
  Exam,
  Subject,
  Topic,
  MockTest,
} from '../types';
import {
  fetchQuestions,
  fetchExams,
  fetchSubjects,
  fetchTopics,
  fetchMockTests,
} from '../firebase/firestore';
import {
  listImportJobs,
  getImportJob,
  fetchStagedQuestions,
  bulkApproveStagedQuestions,
} from '../services/aiImportService';
import { AiBatchProcessor } from '../services/aiBatchProcessor';
import { loadPdfDocument } from '../utils/pdfParser';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

// Subcomponents
import { PdfUploadTab } from '../components/ai-import/PdfUploadTab';
import { ProcessingJobsTab } from '../components/ai-import/ProcessingJobsTab';
import { ReviewQueueTab } from '../components/ai-import/ReviewQueueTab';
import { ApprovedTab } from '../components/ai-import/ApprovedTab';
import { RejectedTab } from '../components/ai-import/RejectedTab';
import { HistoryTab } from '../components/ai-import/HistoryTab';
import { PdfReviewWorkspace } from '../components/ai-import/PdfReviewWorkspace';

type WizardStep = 'upload' | 'extract' | 'review' | 'import';

interface AiPdfImportProps {
  onNavigateToTab?: (tab: string) => void;
}

export const AiPdfImport: React.FC<AiPdfImportProps> = ({ onNavigateToTab }) => {
  // 4-Step Wizard Stepper
  const [activeStep, setActiveStep] = useState<WizardStep>('upload');

  // Full-Screen Review Workspace State
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [workspaceProblemsOnly, setWorkspaceProblemsOnly] = useState(false);
  const [showTableReview, setShowTableReview] = useState(false);

  // History Drawer State
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Shared Data
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [existingQuestions, setExistingQuestions] = useState<Question[]>([]);

  // Active Job & Staged Questions State
  const [activeJob, setActiveJob] = useState<PdfImportJob | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [stagedQuestions, setStagedQuestions] = useState<StagedQuestion[]>([]);
  const [loadingStaged, setLoadingStaged] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Background Processor Ref
  const processorRef = useRef<AiBatchProcessor>(new AiBatchProcessor());

  // Load initial taxonomy & existing questions
  useEffect(() => {
    Promise.all([
      fetchExams().catch(() => []),
      fetchSubjects().catch(() => []),
      fetchTopics().catch(() => []),
      fetchMockTests().catch(() => []),
      fetchQuestions(1000).catch(() => []),
      listImportJobs().catch(() => []),
    ])
      .then(([ex, sub, top, m, q, jobs]) => {
        setExams(ex);
        setSubjects(sub);
        setTopics(top);
        setMockTests(m);
        setExistingQuestions(q);

        // Select the most recent active job if one exists
        if (jobs.length > 0) {
          const recent = jobs[0];
          setActiveJob(recent);
          loadStagedForJob(recent.id);
          loadPdfFromStorage(recent);

          // Resume step based on job status
          if (recent.status === 'processing') {
            setActiveStep('extract');
          } else if (recent.status === 'completed' || recent.status === 'paused') {
            setActiveStep('review');
          }
        }
      })
      .catch((err) => console.error('Initial data load error:', err));
  }, []);

  const loadPdfFromStorage = async (job: PdfImportJob): Promise<PDFDocumentProxy | null> => {
    if (!job.storagePath) return null;
    try {
      let downloadUrl = job.storagePath;
      if (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {
        const storageRef = ref(storage, job.storagePath);
        downloadUrl = await getDownloadURL(storageRef);
      }

      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status} loading PDF from storage`);
      const buffer = await response.arrayBuffer();
      const doc = await loadPdfDocument(buffer);
      setPdfDoc(doc);
      return doc;
    } catch (err) {
      console.warn(`Could not reload PDF from storage (${job.storagePath}):`, err);
      return null;
    }
  };

  const loadStagedForJob = async (jobId: string) => {
    setLoadingStaged(true);
    try {
      const questions = await fetchStagedQuestions(jobId);
      setStagedQuestions(questions);

      const freshJob = await getImportJob(jobId);
      if (freshJob) setActiveJob(freshJob);
    } catch (err) {
      console.error('Failed to load staged questions:', err);
    } finally {
      setLoadingStaged(false);
    }
  };

  // Triggered when a new PDF is uploaded
  const handleJobCreated = async (job: PdfImportJob, file: File) => {
    setActiveJob(job);
    setActiveStep('extract');

    try {
      const doc = await loadPdfDocument(file);
      setPdfDoc(doc);

      processorRef.current.processJob(
        job,
        doc,
        existingQuestions,
        {
          onProgress: () => loadStagedForJob(job.id),
          onBatchComplete: () => {
            loadStagedForJob(job.id);
            setActiveStep('review');
          },
          onError: (batchId, errorMsg) => {
            console.error(`Batch ${batchId} error:`, errorMsg);
            loadStagedForJob(job.id);
          },
        },
        subjects,
        topics
      );
    } catch (err: any) {
      console.error('Error starting batch processor:', err);
      alert(`Could not start extraction: ${err?.message || 'Unknown error'}`);
    }
  };

  // Handle job selection from history
  const handleSelectJobFromHistory = async (selected: PdfImportJob) => {
    setActiveJob(selected);
    setShowHistoryModal(false);
    await Promise.all([loadStagedForJob(selected.id), loadPdfFromStorage(selected)]);
    setActiveStep('review');
  };

  // Extraction Summary Metrics
  const summaryMetrics = useMemo(() => {
    const total = stagedQuestions.length;
    let errors = 0;
    let needsReview = 0;
    let duplicates = 0;
    let answerMatched = 0;
    let answerUnresolved = 0;
    let imageReviewRequired = 0;

    stagedQuestions.forEach((q) => {
      if (q.confidence_level === 'ERROR' || q.confidence_level === 'LOW') errors++;
      else if (q.confidence_level === 'REVIEW' || q.confidence_level === 'MEDIUM') needsReview++;

      if (q.is_duplicate) duplicates++;

      const pdfKey = (q.admin_notes?.match(/SOURCE_ANSWER:([A-D])/)?.[1] || '').toUpperCase();
      if (pdfKey && q.correct_answer && pdfKey === q.correct_answer) {
        answerMatched++;
      } else if (!q.correct_answer || (pdfKey && q.correct_answer && pdfKey !== q.correct_answer)) {
        answerUnresolved++;
      }

      const text = (q.question_text || '').toLowerCase();
      const mentionsDiag =
        text.includes('figure') ||
        text.includes('diagram') ||
        text.includes('table') ||
        text.includes('graph') ||
        text.includes('chart');
      if (mentionsDiag && !q.question_image_url) {
        imageReviewRequired++;
      }
    });

    const problemsCount = errors + needsReview + duplicates + answerUnresolved + imageReviewRequired;
    const ready = Math.max(0, total - problemsCount);

    return {
      total,
      ready,
      needsReview,
      errors,
      duplicates,
      answerMatched,
      answerUnresolved,
      imageReviewRequired,
      problemsCount,
    };
  }, [stagedQuestions]);

  // Quick Approve All Ready Questions
  const handleQuickApproveReady = async () => {
    if (!activeJob) return;
    const readyQuestions = stagedQuestions.filter((q) => {
      const isProblem =
        q.confidence_level === 'ERROR' ||
        q.confidence_level === 'LOW' ||
        q.confidence_level === 'REVIEW' ||
        q.is_duplicate ||
        !q.correct_answer;
      return !isProblem && q.review_status === 'pending';
    });

    if (readyQuestions.length === 0) {
      alert('No unapproved Ready questions found.');
      return;
    }

    if (confirm(`Approve all ${readyQuestions.length} Ready questions in one click?`)) {
      setIsBulkApproving(true);
      try {
        await bulkApproveStagedQuestions(
          activeJob.id,
          readyQuestions.map((q) => q.id)
        );
        await loadStagedForJob(activeJob.id);
      } catch (err) {
        console.error('Quick approve error:', err);
      } finally {
        setIsBulkApproving(false);
      }
    }
  };

  const approvedCount = stagedQuestions.filter((q) => q.review_status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* 1. Permanent 4-Step Stepper Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">AI PDF Question Import</h1>
              <p className="text-xs text-slate-500">
                ₹0 Free Local Extraction • Human Verification Queue • Post-Import Assignment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {activeJob && (
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-400">Job:</span>
                <span className="font-bold text-slate-800 max-w-[180px] truncate">{activeJob.fileName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-50 text-brand-700 border border-brand-200">
                  {activeJob.status}
                </span>
              </div>
            )}

            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition flex items-center gap-1.5"
            >
              <History size={14} />
              <span>Job History</span>
            </button>
          </div>
        </div>

        {/* 4-Step Indicator Bar */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { step: 'upload' as WizardStep, num: 1, label: 'Upload PDF', desc: 'Select document & exam' },
            { step: 'extract' as WizardStep, num: 2, label: 'Local Extraction', desc: 'Deterministic OCR & parsing' },
            { step: 'review' as WizardStep, num: 3, label: 'Quality Review', desc: 'Problem-first proofreading' },
            { step: 'import' as WizardStep, num: 4, label: 'Commit & Assign', desc: 'Question Bank & Mocks' },
          ].map((s) => {
            const isActive = activeStep === s.step;
            const isPassed =
              (s.step === 'upload' && activeStep !== 'upload') ||
              (s.step === 'extract' && (activeStep === 'review' || activeStep === 'import')) ||
              (s.step === 'review' && activeStep === 'import');

            return (
              <button
                key={s.step}
                onClick={() => setActiveStep(s.step)}
                className={`p-3 rounded-xl text-left border transition ${
                  isActive
                    ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-500'
                    : isPassed
                    ? 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/50'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold ${
                      isActive
                        ? 'bg-brand-600 text-white'
                        : isPassed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isPassed ? <Check size={12} /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      isActive ? 'text-brand-900' : isPassed ? 'text-emerald-900' : 'text-slate-700'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block pl-8 truncate">{s.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Step 1: Upload PDF */}
      {activeStep === 'upload' && (
        <PdfUploadTab
          exams={exams}
          subjects={subjects}
          topics={topics}
          onJobCreated={handleJobCreated}
        />
      )}

      {/* 3. Step 2: Extracting */}
      {activeStep === 'extract' && (
        <div className="space-y-4">
          <ProcessingJobsTab
            job={activeJob}
            onPauseJob={() => processorRef.current.pause()}
            onResumeJob={() => {
              if (activeJob && pdfDoc) {
                processorRef.current.resume();
                processorRef.current.resumeFromCheckpoint(
                  activeJob,
                  pdfDoc,
                  existingQuestions,
                  {
                    onProgress: () => loadStagedForJob(activeJob.id),
                    onBatchComplete: () => {
                      loadStagedForJob(activeJob.id);
                      setActiveStep('review');
                    },
                  },
                  subjects,
                  topics
                );
              }
            }}
            onCancelJob={() => processorRef.current.cancel()}
            onOpenReview={() => setActiveStep('review')}
            onRefresh={() => {
              if (activeJob) loadStagedForJob(activeJob.id);
            }}
          />
        </div>
      )}

      {/* 4. Step 3: Review */}
      {activeStep === 'review' && (
        <>
          {/* A. Summary First Dashboard (Default when opening review) */}
          {!showTableReview ? (
            <div className="space-y-6">
              {/* Extraction Complete Banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <CheckCircle2 size={18} />
                    </div>
                    <h2 className="text-base font-extrabold text-slate-900">Extraction Summary Dashboard</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Document parsed with ₹0 Free Local OCR. Review potential issues before final commitment.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTableReview(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition flex items-center gap-1.5"
                  >
                    <FileText size={14} />
                    <span>Table View</span>
                  </button>

                  <button
                    onClick={() => setActiveStep('import')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={15} />
                    <span>Proceed to Import ({approvedCount})</span>
                  </button>
                </div>
              </div>

              {/* Comprehensive Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-slate-800">
                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Qs
                  </span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">
                    {summaryMetrics.total}
                  </span>
                </div>

                <div className="p-4 bg-white border border-emerald-200 rounded-2xl shadow-xs bg-emerald-50/20">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Ready
                  </span>
                  <span className="text-2xl font-black text-emerald-700 mt-1 block">
                    {summaryMetrics.ready}
                  </span>
                </div>

                <div className="p-4 bg-white border border-amber-200 rounded-2xl shadow-xs bg-amber-50/20">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                    Needs Review
                  </span>
                  <span className="text-2xl font-black text-amber-700 mt-1 block">
                    {summaryMetrics.needsReview}
                  </span>
                </div>

                <div className="p-4 bg-white border border-rose-200 rounded-2xl shadow-xs bg-rose-50/20">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                    Errors
                  </span>
                  <span className="text-2xl font-black text-rose-700 mt-1 block">
                    {summaryMetrics.errors}
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Duplicates
                  </span>
                  <span className="text-2xl font-black text-slate-700 mt-1 block">
                    {summaryMetrics.duplicates}
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                    Key Matched
                  </span>
                  <span className="text-2xl font-black text-emerald-600 mt-1 block">
                    {summaryMetrics.answerMatched}
                  </span>
                </div>

                <div className="p-4 bg-white border border-amber-200 rounded-2xl shadow-xs">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                    Unresolved Key
                  </span>
                  <span className="text-2xl font-black text-amber-700 mt-1 block">
                    {summaryMetrics.answerUnresolved}
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                    Image Review
                  </span>
                  <span className="text-2xl font-black text-indigo-600 mt-1 block">
                    {summaryMetrics.imageReviewRequired}
                  </span>
                </div>
              </div>

              {/* Large Strategic Action Buttons */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Recommended Proofreading Actions
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Action 1: Review Problems First (RECOMMENDED) */}
                  <button
                    onClick={() => {
                      setWorkspaceProblemsOnly(true);
                      setIsWorkspaceOpen(true);
                    }}
                    className="p-5 rounded-2xl border-2 border-brand-500 bg-brand-50/30 hover:bg-brand-50 transition text-left space-y-2 group shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-brand-600 text-white uppercase tracking-wider">
                        Recommended
                      </span>
                      <ArrowRight size={16} className="text-brand-600 group-hover:translate-x-1 transition" />
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900">Review Problems First</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Jumps directly to errors, answer mismatches, missing answers, and duplicate questions ({summaryMetrics.problemsCount} items).
                    </p>
                  </button>

                  {/* Action 2: Review All Questions */}
                  <button
                    onClick={() => {
                      setWorkspaceProblemsOnly(false);
                      setIsWorkspaceOpen(true);
                    }}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition text-left space-y-2 group shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">Full Queue</span>
                      <Maximize2 size={16} className="text-slate-400 group-hover:text-slate-700 transition" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900">Review All Questions</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Opens sequential 40/60 workspace starting from Question 1 through {summaryMetrics.total}.
                    </p>
                  </button>

                  {/* Action 3: Quick Approve Ready Questions */}
                  <button
                    onClick={handleQuickApproveReady}
                    disabled={isBulkApproving || summaryMetrics.ready === 0}
                    className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 transition text-left space-y-2 group shadow-xs disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700">Quick Approval</span>
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    </div>
                    <h4 className="text-base font-bold text-emerald-950">
                      Approve {summaryMetrics.ready} Ready Questions
                    </h4>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      Batch approves high-confidence questions with matching answers in 1 click.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* B. Table Mode for questions that do not need detailed inspection */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowTableReview(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50"
                >
                  ← Back to Summary
                </button>
              </div>

              <ReviewQueueTab
                job={activeJob}
                pdfDoc={pdfDoc}
                stagedQuestions={stagedQuestions}
                existingQuestions={existingQuestions}
                exams={exams}
                subjects={subjects}
                topics={topics}
                onRefresh={() => loadStagedForJob(activeJob!.id)}
              />
            </div>
          )}
        </>
      )}

      {/* 5. Step 4: Import Screen */}
      {activeStep === 'import' && (
        <ApprovedTab
          job={activeJob}
          stagedQuestions={stagedQuestions}
          mockTests={mockTests}
          exams={exams}
          onRefresh={() => loadStagedForJob(activeJob!.id)}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {/* Full-Window Professional Review Workspace Overlay */}
      {isWorkspaceOpen && activeJob && (
        <PdfReviewWorkspace
          job={activeJob}
          pdfDoc={pdfDoc}
          stagedQuestions={stagedQuestions}
          exams={exams}
          subjects={subjects}
          topics={topics}
          initialProblemsOnly={workspaceProblemsOnly}
          onExitReview={() => setIsWorkspaceOpen(false)}
          onRefresh={() => loadStagedForJob(activeJob.id)}
          onOpenImportScreen={() => {
            setIsWorkspaceOpen(false);
            setActiveStep('import');
          }}
        />
      )}

      {/* Job History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4 animate-scaleUp max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <History size={18} className="text-brand-600" />
                <span>Import Job History</span>
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <HistoryTab onSelectJob={handleSelectJobFromHistory} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
