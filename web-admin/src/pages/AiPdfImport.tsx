import React, { useState, useEffect, useRef } from 'react';
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
  FileText
} from 'lucide-react';
import {
  PdfImportJob,
  StagedQuestion,
  Question,
  Exam,
  Subject,
  Topic,
} from '../types';
import {
  fetchQuestions,
  fetchExams,
  fetchSubjects,
  fetchTopics,
} from '../firebase/firestore';
import {
  listImportJobs,
  getImportJob,
  fetchStagedQuestions,
} from '../services/aiImportService';
import { AiBatchProcessor } from '../services/aiBatchProcessor';
import { loadPdfDocument } from '../utils/pdfParser';

// Subcomponents
import { PdfUploadTab } from '../components/ai-import/PdfUploadTab';
import { ProcessingJobsTab } from '../components/ai-import/ProcessingJobsTab';
import { ReviewQueueTab } from '../components/ai-import/ReviewQueueTab';
import { ApprovedTab } from '../components/ai-import/ApprovedTab';
import { RejectedTab } from '../components/ai-import/RejectedTab';
import { HistoryTab } from '../components/ai-import/HistoryTab';

type SubTab =
  | 'upload'
  | 'processing'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'history';

export const AiPdfImport: React.FC = () => {
  const [currentSubTab, setCurrentSubTab] = useState<SubTab>('upload');

  // Shared Data
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [existingQuestions, setExistingQuestions] = useState<Question[]>([]);

  // Active Job & Staged Questions State
  const [activeJob, setActiveJob] = useState<PdfImportJob | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [stagedQuestions, setStagedQuestions] = useState<StagedQuestion[]>([]);
  const [loadingStaged, setLoadingStaged] = useState(false);

  // Background Processor Ref
  const processorRef = useRef<AiBatchProcessor>(new AiBatchProcessor());

  // Load initial taxonomy & existing questions
  useEffect(() => {
    Promise.all([
      fetchExams(),
      fetchSubjects(),
      fetchTopics(),
      fetchQuestions(1000),
      listImportJobs(),
    ])
      .then(([ex, sub, top, q, jobs]) => {
        setExams(ex);
        setSubjects(sub);
        setTopics(top);
        setExistingQuestions(q);

        // Select the most recent active job if one exists
        if (jobs.length > 0) {
          const recent = jobs[0];
          setActiveJob(recent);
          loadStagedForJob(recent.id);
        }
      })
      .catch((err) => console.error('Initial data load error:', err));
  }, []);

  const loadStagedForJob = async (jobId: string) => {
    setLoadingStaged(true);
    try {
      const questions = await fetchStagedQuestions(jobId);
      setStagedQuestions(questions);

      // Refresh job doc metrics
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
    setCurrentSubTab('processing');

    try {
      // 1. Load PDF into pdfDoc proxy
      const doc = await loadPdfDocument(file);
      setPdfDoc(doc);

      // 2. Start Background Batch Processing
      processorRef.current.processJob(job, doc, existingQuestions, {
        onProgress: () => {
          loadStagedForJob(job.id);
        },
        onBatchComplete: () => {
          loadStagedForJob(job.id);
        },
      });
    } catch (err) {
      console.error('Error starting batch processor:', err);
    }
  };

  // Handle job selection from history
  const handleSelectJobFromHistory = async (selected: PdfImportJob) => {
    setActiveJob(selected);
    await loadStagedForJob(selected.id);
    setCurrentSubTab('review');
  };

  // Job Controls
  const handlePause = () => {
    processorRef.current.pause();
    if (activeJob) setActiveJob({ ...activeJob, status: 'paused' });
  };

  const handleResume = () => {
    processorRef.current.resume();
    if (activeJob) setActiveJob({ ...activeJob, status: 'processing' });
  };

  const handleCancel = () => {
    processorRef.current.cancel();
    if (activeJob) setActiveJob({ ...activeJob, status: 'cancelled' });
  };

  const pendingReviewCount = stagedQuestions.filter((q) => q.review_status === 'pending').length;
  const approvedCount = stagedQuestions.filter((q) => q.review_status === 'approved').length;
  const rejectedCount = stagedQuestions.filter((q) => q.review_status === 'rejected').length;

  return (
    <div className="space-y-4">
      {/* Top Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">AI PDF Question Import</h1>
            <p className="text-xs text-slate-400">
              Deterministic extraction & human review queue for large exam question banks (3,000–5,000 Qs).
            </p>
          </div>
        </div>

        {activeJob && (
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400">Active Job:</span>
            <span className="font-bold text-white max-w-[200px] truncate">{activeJob.fileName}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-950 text-brand-400 border border-brand-800">
              {activeJob.status}
            </span>
          </div>
        )}
      </div>

      {/* Subsections / Tabs Navigation Bar (User Requirement 1) */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 overflow-x-auto pb-1">
        {[
          { id: 'upload', label: 'Upload PDF', icon: UploadCloud },
          { id: 'processing', label: 'Processing Jobs', icon: Layers, badge: activeJob?.status === 'processing' ? 'Active' : undefined },
          { id: 'review', label: 'Review Queue', icon: CheckSquare, count: pendingReviewCount },
          { id: 'approved', label: 'Approved', icon: CheckCircle2, count: approvedCount },
          { id: 'rejected', label: 'Rejected / Errors', icon: XCircle, count: rejectedCount },
          { id: 'history', label: 'Import History', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = currentSubTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setCurrentSubTab(tab.id as SubTab)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-emerald-500 text-slate-950 uppercase tracking-wider">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {currentSubTab === 'upload' && (
          <PdfUploadTab
            exams={exams}
            subjects={subjects}
            topics={topics}
            onJobCreated={handleJobCreated}
          />
        )}

        {currentSubTab === 'processing' && (
          <ProcessingJobsTab
            job={activeJob}
            onOpenReview={() => setCurrentSubTab('review')}
            onPauseJob={handlePause}
            onResumeJob={handleResume}
            onCancelJob={handleCancel}
            onRefresh={() => activeJob && loadStagedForJob(activeJob.id)}
          />
        )}

        {currentSubTab === 'review' && (
          <ReviewQueueTab
            job={activeJob}
            pdfDoc={pdfDoc}
            stagedQuestions={stagedQuestions}
            existingQuestions={existingQuestions}
            exams={exams}
            subjects={subjects}
            topics={topics}
            onRefresh={() => activeJob && loadStagedForJob(activeJob.id)}
          />
        )}

        {currentSubTab === 'approved' && (
          <ApprovedTab
            job={activeJob}
            stagedQuestions={stagedQuestions}
            onRefresh={() => activeJob && loadStagedForJob(activeJob.id)}
          />
        )}

        {currentSubTab === 'rejected' && (
          <RejectedTab
            job={activeJob}
            stagedQuestions={stagedQuestions}
            onRefresh={() => activeJob && loadStagedForJob(activeJob.id)}
          />
        )}

        {currentSubTab === 'history' && (
          <HistoryTab
            currentJobId={activeJob?.id}
            onSelectJob={handleSelectJobFromHistory}
          />
        )}
      </div>
    </div>
  );
};
