import React, { useState, useEffect } from 'react';
import {
  PdfImportJob,
  PdfBatch,
} from '../../types';
import {
  getBatches,
  updateJobState,
  updateBatch,
} from '../../services/aiImportService';
import {
  Play,
  Pause,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Eye
} from 'lucide-react';

interface ProcessingJobsTabProps {
  job: PdfImportJob | null;
  onOpenReview: () => void;
  onPauseJob?: () => void;
  onResumeJob?: () => void;
  onCancelJob?: () => void;
  onRefresh: () => void;
}

export const ProcessingJobsTab: React.FC<ProcessingJobsTabProps> = ({
  job,
  onOpenReview,
  onPauseJob,
  onResumeJob,
  onCancelJob,
  onRefresh,
}) => {
  const [batches, setBatches] = useState<PdfBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  useEffect(() => {
    if (!job) return;
    setLoadingBatches(true);
    getBatches(job.id)
      .then((b) => setBatches(b))
      .catch((err) => console.error('Failed to load batches:', err))
      .finally(() => setLoadingBatches(false));
  }, [job]);

  if (!job) {
    return (
      <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl mx-auto my-6">
        <Clock size={36} className="text-slate-600 mb-2 mx-auto" />
        <p className="text-sm font-semibold text-slate-300">No Active Processing Job</p>
        <p className="text-xs text-slate-500 mt-1">
          Upload a PDF or select an existing job from Import History to monitor processing.
        </p>
      </div>
    );
  }

  const percent = job.progress.totalPages > 0
    ? Math.round((job.progress.processedPages / job.progress.totalPages) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-slate-200 py-4">
      {/* Top Active Job Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white">{job.fileName}</h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  job.status === 'processing'
                    ? 'bg-brand-950 text-brand-400 border border-brand-800 animate-pulse'
                    : job.status === 'completed'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : job.status === 'paused'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {job.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Job ID: <span className="font-mono text-slate-300">{job.id}</span> • Started by{' '}
              <span className="text-slate-300">{job.createdBy}</span>
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2">
            {job.status === 'processing' && onPauseJob && (
              <button
                onClick={onPauseJob}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-950/80 text-amber-300 hover:bg-amber-900 border border-amber-800 transition flex items-center gap-1.5"
              >
                <Pause size={14} />
                Pause
              </button>
            )}

            {job.status === 'paused' && onResumeJob && (
              <button
                onClick={onResumeJob}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white transition flex items-center gap-1.5 shadow-md"
              >
                <Play size={14} />
                Resume
              </button>
            )}

            {job.status === 'processing' && onCancelJob && (
              <button
                onClick={onCancelJob}
                className="px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-950/40 border border-red-900/40 transition flex items-center gap-1.5"
              >
                <XCircle size={14} />
                Cancel
              </button>
            )}

            <button
              onClick={onOpenReview}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 transition flex items-center gap-1.5"
            >
              <Eye size={15} />
              Open Review Queue ({job.metrics.detectedQuestions})
            </button>
          </div>
        </div>

        {/* Live Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">
              Processing {job.progress.processedPages} / {job.progress.totalPages} pages
            </span>
            <span className="font-mono text-brand-400 font-bold">{percent}% Complete</span>
          </div>
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Real-time Counters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Questions Detected</span>
            <span className="text-base font-bold text-white font-mono">{job.metrics.detectedQuestions}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">High Confidence</span>
            <span className="text-base font-bold text-emerald-400 font-mono">{job.metrics.highConfidence}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Needs Review</span>
            <span className="text-base font-bold text-amber-400 font-mono">{job.metrics.needsReview}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Errors / Incomplete</span>
            <span className="text-base font-bold text-red-400 font-mono">{job.metrics.errors}</span>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Potential Duplicates</span>
            <span className="text-base font-bold text-purple-400 font-mono">{job.metrics.duplicates}</span>
          </div>
        </div>
      </div>

      {/* Batches Grid Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h4 className="font-bold text-sm text-white">Batch Checkpoints ({batches.length} Batches)</h4>
            <p className="text-[11px] text-slate-400">
              Each 5-page batch is persisted independently so progress is never lost.
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="Refresh Batches"
          >
            <RotateCcw size={15} />
          </button>
        </div>

        {loadingBatches ? (
          <div className="p-8 flex items-center justify-center text-slate-400 text-xs">
            <Loader2 size={20} className="animate-spin mr-2 text-brand-400" />
            Loading batch checkpoints...
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-96 overflow-y-auto pr-1">
            {batches.map((b) => {
              const isDone = b.status === 'completed';
              const isProc = b.status === 'processing';
              const isFail = b.status === 'failed';

              return (
                <div
                  key={b.id}
                  className={`p-3 rounded-xl border text-xs flex flex-col justify-between transition ${
                    isDone
                      ? 'bg-slate-950 border-emerald-900/60 text-slate-300'
                      : isProc
                      ? 'bg-brand-950/40 border-brand-700 text-brand-300 animate-pulse'
                      : isFail
                      ? 'bg-red-950/40 border-red-800 text-red-300'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[11px] mb-1">
                    <span className="font-bold">
                      p.{b.startPage}-{b.endPage}
                    </span>
                    {isDone && <CheckCircle2 size={12} className="text-emerald-400" />}
                    {isProc && <Loader2 size={12} className="animate-spin text-brand-400" />}
                    {isFail && <AlertTriangle size={12} className="text-red-400" />}
                  </div>

                  <div className="text-[10px] flex items-center justify-between">
                    <span>{b.status}</span>
                    {isDone && <span className="font-bold">{b.questionsDetected} Qs</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
