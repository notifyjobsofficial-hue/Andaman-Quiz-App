import React, { useState, useEffect } from 'react';
import { PdfImportJob, StagedQuestion } from '../../types';
import {
  listImportJobs,
  deleteImportJob,
  fetchStagedQuestions,
} from '../../services/aiImportService';
import {
  History,
  Download,
  Trash2,
  Eye,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface HistoryTabProps {
  currentJobId?: string;
  onSelectJob: (job: PdfImportJob) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  currentJobId,
  onSelectJob,
}) => {
  const [jobs, setJobs] = useState<PdfImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await listImportJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to load import history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleDelete = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this import job and its staged questions? This cannot be undone.')) {
      return;
    }

    try {
      await deleteImportJob(jobId);
      loadJobs();
    } catch (err) {
      console.error('Delete job error:', err);
    }
  };

  // Downloadable Audit / Report CSV
  const handleExportCsv = async (job: PdfImportJob, e: React.MouseEvent) => {
    e.stopPropagation();
    setExportingId(job.id);

    try {
      const staged = await fetchStagedQuestions(job.id);
      
      const headers = [
        'ID',
        'Source PDF',
        'Source Page',
        'Question Number',
        'Confidence Level',
        'Confidence Score',
        'Review Status',
        'Answer Source',
        'Question Text',
        'Option A',
        'Option B',
        'Option C',
        'Option D',
        'Correct Answer',
        'Explanation',
        'Exam',
        'Subject',
        'Topic',
        'Difficulty',
        'Validation Warnings',
        'Is Duplicate',
      ];

      const rows = staged.map((q) => [
        q.id,
        q.source_pdf,
        q.source_page,
        q.source_question_number,
        q.confidence_level,
        q.confidence_score,
        q.review_status,
        q.answer_source,
        `"${(q.question_text || '').replace(/"/g, '""')}"`,
        `"${(q.option_a_text || '').replace(/"/g, '""')}"`,
        `"${(q.option_b_text || '').replace(/"/g, '""')}"`,
        `"${(q.option_c_text || '').replace(/"/g, '""')}"`,
        `"${(q.option_d_text || '').replace(/"/g, '""')}"`,
        q.correct_answer,
        `"${(q.explanation_text || '').replace(/"/g, '""')}"`,
        q.exam,
        q.subject,
        q.topic,
        q.difficulty,
        `"${(q.validation_warnings || []).join('; ')}"`,
        q.is_duplicate ? 'YES' : 'NO',
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `import_report_${job.fileName}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export CSV error:', err);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-slate-200 py-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-950 border border-brand-800 flex items-center justify-center text-brand-400">
            <History size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Import History & Audit</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Archive of all past PDF imports, extraction metrics, and exportable CSV audit reports.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center text-slate-400 text-xs">
          <Loader2 size={24} className="animate-spin mr-2 text-brand-400" />
          Loading import history...
        </div>
      ) : jobs.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-xs bg-slate-900 border border-slate-800 rounded-2xl">
          No import jobs found. Upload a PDF to create your first import job.
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const isSelected = job.id === currentJobId;

            return (
              <div
                key={job.id}
                onClick={() => onSelectJob(job)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-900 border-brand-500 shadow-lg shadow-brand-900/10'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-brand-400">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        {job.fileName}
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300">
                          {job.status}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Job ID: <span className="font-mono">{job.id}</span> • Pages:{' '}
                        <span className="font-bold text-slate-200">{job.totalPages}</span> • Created:{' '}
                        {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleExportCsv(job, e)}
                      disabled={exportingId === job.id}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                      title="Download Audit CSV"
                    >
                      {exportingId === job.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Download size={13} />
                      )}
                      <span>CSV Report</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(job.id, e)}
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg transition"
                      title="Delete Job"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Metrics Breakdown Grid (User Requirement 19) */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 pt-3 text-xs">
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Questions</span>
                    <span className="font-bold text-white font-mono text-xs">
                      {job.metrics.detectedQuestions}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">High Confidence</span>
                    <span className="font-bold text-emerald-400 font-mono text-xs">
                      {job.metrics.highConfidence}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Needs Review</span>
                    <span className="font-bold text-amber-400 font-mono text-xs">
                      {job.metrics.needsReview}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Errors</span>
                    <span className="font-bold text-red-400 font-mono text-xs">
                      {job.metrics.errors}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Approved</span>
                    <span className="font-bold text-emerald-400 font-mono text-xs">
                      {job.metrics.approved}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Rejected</span>
                    <span className="font-bold text-red-400 font-mono text-xs">
                      {job.metrics.rejected}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Duplicates</span>
                    <span className="font-bold text-purple-400 font-mono text-xs">
                      {job.metrics.duplicates}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
