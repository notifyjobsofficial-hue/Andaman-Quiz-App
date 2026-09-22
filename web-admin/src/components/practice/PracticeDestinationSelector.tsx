import React, { useMemo } from 'react';
import { Subject, Topic } from '../../types';
import { Layers, AlertCircle, ArrowRight, BookOpen, ExternalLink } from 'lucide-react';

export interface PracticeDestinationSelectorProps {
  /**
   * The immutable Exam identifier for this question or batch of questions.
   * This is strictly READ-ONLY. Practice assignment never mutates Exam taxonomy.
   */
  examCode: string;
  examName?: string;

  /**
   * Currently selected Subject and Topic IDs.
   */
  selectedSubjectId?: string;
  selectedTopicId?: string;

  /**
   * Selection callbacks providing the full model objects or null.
   */
  onSubjectChange: (subject: Subject | null) => void;
  onTopicChange: (topic: Topic | null) => void;

  /**
   * Available master lists of Subjects and Topics from Firestore.
   */
  subjects: Subject[];
  topics: Topic[];

  /**
   * UI flags and errors.
   */
  disabled?: boolean;
  error?: string | null;
  required?: boolean;
  onOpenSubjectsTopics?: () => void;
}

export const PracticeDestinationSelector: React.FC<PracticeDestinationSelectorProps> = ({
  examCode,
  examName,
  selectedSubjectId,
  selectedTopicId,
  onSubjectChange,
  onTopicChange,
  subjects,
  topics,
  disabled = false,
  error,
  required = true,
  onOpenSubjectsTopics,
}) => {
  // 1. Filter existing Subjects belonging to this Exam
  const availableSubjects = useMemo(() => {
    const cleanExam = examCode.trim().toLowerCase();
    return subjects.filter((s) => {
      if (!s.examCodes || s.examCodes.length === 0) return true; // Universal subject
      return s.examCodes.some((code) => code.trim().toLowerCase() === cleanExam);
    });
  }, [subjects, examCode]);

  // Selected subject object
  const activeSubject = useMemo(() => {
    return availableSubjects.find((s) => s.id === selectedSubjectId) || null;
  }, [availableSubjects, selectedSubjectId]);

  // 2. Filter existing Topics belonging to the selected Subject
  const availableTopics = useMemo(() => {
    if (!selectedSubjectId) return [];
    return topics.filter((t) => t.subjectId === selectedSubjectId);
  }, [topics, selectedSubjectId]);

  // Selected topic object
  const activeTopic = useMemo(() => {
    return availableTopics.find((t) => t.id === selectedTopicId) || null;
  }, [availableTopics, selectedTopicId]);

  const handleSubjectSelect = (subId: string) => {
    if (!subId) {
      onSubjectChange(null);
      onTopicChange(null);
      return;
    }
    const found = availableSubjects.find((s) => s.id === subId) || null;
    onSubjectChange(found);
    // Reset topic when subject changes
    onTopicChange(null);
  };

  const handleTopicSelect = (topId: string) => {
    if (!topId) {
      onTopicChange(null);
      return;
    }
    const found = availableTopics.find((t) => t.id === topId) || null;
    onTopicChange(found);
  };

  const displayName = examName || examCode;

  return (
    <div className="space-y-4 text-slate-800">
      {/* 1. Exam (Strictly Read-Only) */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Target Exam (Read-Only)
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-extrabold text-sm text-slate-900">{displayName}</span>
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md">
              Already Assigned
            </span>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-400 font-medium hidden sm:block">
          Taxonomy root locked
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Subject Dropdown */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <span>Subject</span>
            {required && <span className="text-rose-500">*</span>}
          </label>
          <span className="text-[10px] text-slate-400 font-medium">
            {availableSubjects.length} available for {displayName}
          </span>
        </div>

        {availableSubjects.length === 0 ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">No existing subjects found for {displayName}.</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Create subjects first in Subjects & Topics. Auto-creation of fallback subjects is disabled.
                </p>
              </div>
            </div>
            {onOpenSubjectsTopics && (
              <button
                type="button"
                onClick={onOpenSubjectsTopics}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-700 shrink-0 flex items-center gap-1"
              >
                <span>Open Subjects</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        ) : (
          <select
            value={selectedSubjectId || ''}
            onChange={(e) => handleSubjectSelect(e.target.value)}
            disabled={disabled}
            className="w-full text-xs font-semibold p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">-- Select Existing Subject --</option>
            {availableSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 3. Topic Dropdown */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <span>Topic / Chapter</span>
            {required && <span className="text-rose-500">*</span>}
          </label>
          {selectedSubjectId && (
            <span className="text-[10px] text-slate-400 font-medium">
              {availableTopics.length} topics in {activeSubject?.name || 'Subject'}
            </span>
          )}
        </div>

        {!selectedSubjectId ? (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 italic">
            Select a Subject above to view available Topics.
          </div>
        ) : availableTopics.length === 0 ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">No existing topics found under "{activeSubject?.name}".</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Create topics first in Subjects & Topics. Generic fallback topics (e.g. General, Unassigned) will not be auto-created.
                </p>
              </div>
            </div>
            {onOpenSubjectsTopics && (
              <button
                type="button"
                onClick={onOpenSubjectsTopics}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-700 shrink-0 flex items-center gap-1"
              >
                <span>Add Topics</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        ) : (
          <select
            value={selectedTopicId || ''}
            onChange={(e) => handleTopicSelect(e.target.value)}
            disabled={disabled}
            className="w-full text-xs font-semibold p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">-- Select Existing Topic --</option>
            {availableTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 4. Visual Destination Preview */}
      <div className="p-3.5 bg-brand-50/50 border border-brand-200/80 rounded-xl space-y-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 block">
          Destination Preview:
        </span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-800">
          <span className="text-brand-900 bg-brand-100/70 px-2 py-0.5 rounded-md">
            {displayName}
          </span>
          <ArrowRight size={13} className="text-brand-400 shrink-0" />
          <span className={`px-2 py-0.5 rounded-md ${
            activeSubject
              ? 'text-brand-900 bg-brand-100/70'
              : 'text-slate-400 bg-slate-100 border border-dashed border-slate-300 font-normal italic'
          }`}>
            {activeSubject ? activeSubject.name : '[Select Subject]'}
          </span>
          <ArrowRight size={13} className="text-brand-400 shrink-0" />
          <span className={`px-2 py-0.5 rounded-md ${
            activeTopic
              ? 'text-brand-900 bg-brand-100/70'
              : 'text-slate-400 bg-slate-100 border border-dashed border-slate-300 font-normal italic'
          }`}>
            {activeTopic ? activeTopic.name : '[Select Topic]'}
          </span>
        </div>
      </div>
    </div>
  );
};
