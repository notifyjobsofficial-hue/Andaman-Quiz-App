import React, { useState, useMemo } from 'react';
import { Search, Filter, CheckSquare, Square, BookOpen, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Question, Subject, Topic, MockTest } from '../../types';
import { Badge } from '../common/Badge';
import { assignQuestionsToTopic } from '../../utils/practiceQuestions';

interface AssignFromBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTopic: Topic;
  targetSubject: Subject;
  targetExamCode: string;
  allQuestions: Question[];
  allSubjects: Subject[];
  allMockTests: MockTest[];
  onAssigned: (updatedQuestions: Question[]) => void;
}

export const AssignFromBankModal: React.FC<AssignFromBankModalProps> = ({
  isOpen,
  onClose,
  targetTopic,
  targetSubject,
  targetExamCode,
  allQuestions,
  allSubjects,
  allMockTests,
  onAssigned,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>(targetSubject.id);
  const [onlyNotInPractice, setOnlyNotInPractice] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter candidates from master Question Bank
  const availableQuestions = useMemo(() => {
    return allQuestions.filter((q) => {
      // Don't show questions already in this exact topic
      const isAlreadyInThisTopic =
        (q.topicId && q.topicId === targetTopic.id) ||
        (q.topic && q.topic.toLowerCase() === targetTopic.name.toLowerCase() &&
         (q.subjectId === targetSubject.id || q.subject?.toLowerCase() === targetSubject.name.toLowerCase()));

      if (isAlreadyInThisTopic) return false;

      // Subject filter
      if (subjectFilter !== 'ALL') {
        const matchesSubId = q.subjectId === subjectFilter;
        const subObj = allSubjects.find((s) => s.id === subjectFilter);
        const matchesSubName = subObj && q.subject && q.subject.toLowerCase() === subObj.name.toLowerCase();
        if (!matchesSubId && !matchesSubName) return false;
      }

      // Filter: only questions not currently in practice
      if (onlyNotInPractice) {
        const usage = (q.usageType || q.usage_type || 'BOTH').toUpperCase();
        if (usage === 'PRACTICE' || usage === 'BOTH') {
          // If it's already in practice for some other topic, skip if onlyNotInPractice is true
          if (q.topic && q.topic.toLowerCase() !== 'general') return false;
        }
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const textMatch = q.question_text?.toLowerCase().includes(query);
        const idMatch = q.id.toLowerCase().includes(query);
        const topicMatch = q.topic?.toLowerCase().includes(query);
        if (!textMatch && !idMatch && !topicMatch) return false;
      }

      return true;
    });
  }, [allQuestions, targetTopic, targetSubject, subjectFilter, onlyNotInPractice, searchTerm, allSubjects]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === availableQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(availableQuestions.map((q) => q.id)));
    }
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const updated = await assignQuestionsToTopic(
        Array.from(selectedIds),
        targetTopic,
        targetSubject,
        targetExamCode,
        allQuestions,
        allMockTests
      );
      onAssigned(updated);
      setSelectedIds(new Set());
      onClose();
    } catch (err: any) {
      console.error('AssignFromBank error:', err);
      setErrorMsg(err?.message || 'Failed to assign questions. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign to Practice: ${targetTopic.name}`}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Destination Header Banner */}
        <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="font-semibold text-brand-800">Target Topic:</span>{' '}
            <span className="font-bold text-brand-900">{targetTopic.name}</span>
            <span className="mx-2 text-brand-300">|</span>
            <span className="font-semibold text-brand-800">Subject:</span>{' '}
            <span className="font-bold text-brand-900">{targetSubject.name}</span>
            <span className="mx-2 text-brand-300">|</span>
            <span className="font-semibold text-brand-800">Exam:</span>{' '}
            <span className="font-bold text-brand-900">{targetExamCode}</span>
          </div>
          <span className="text-[11px] text-brand-600 bg-brand-100/70 px-2 py-0.5 rounded font-medium">
            Zero Duplication • Single Database
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search question text or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Subjects</option>
              {allSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Checkbox */}
        <div className="flex items-center justify-between text-xs px-1">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
            <input
              type="checkbox"
              checked={onlyNotInPractice}
              onChange={(e) => setOnlyNotInPractice(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <span>Show only questions not already organized in another topic</span>
          </label>
          <span className="text-slate-400">
            {availableQuestions.length} questions available
          </span>
        </div>

        {/* Question Selection List */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[380px] flex flex-col">
          {/* Header Row */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-600 select-none">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 hover:text-brand-600"
            >
              {selectedIds.size > 0 && selectedIds.size === availableQuestions.length ? (
                <CheckSquare size={16} className="text-brand-600" />
              ) : (
                <Square size={16} className="text-slate-400" />
              )}
              <span>Select All ({selectedIds.size} / {availableQuestions.length})</span>
            </button>
            <span>Current Topic / Usage</span>
          </div>

          {/* List items */}
          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {availableQuestions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No matching questions found from Question Bank.
              </div>
            ) : (
              availableQuestions.map((q) => {
                const isSelected = selectedIds.has(q.id);
                const currentUsage = (q.usageType || q.usage_type || 'BOTH').toUpperCase();
                const currentTopic = q.topic || 'Unassigned';

                return (
                  <div
                    key={q.id}
                    onClick={() => toggleSelect(q.id)}
                    className={`px-4 py-3 flex items-start gap-3 cursor-pointer transition ${
                      isSelected ? 'bg-brand-50/50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      {isSelected ? (
                        <CheckSquare size={16} className="text-brand-600" />
                      ) : (
                        <Square size={16} className="text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-800 font-medium line-clamp-2 leading-relaxed">
                        {q.question_text || '(Diagram / Image Question)'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                        <span className="font-mono text-slate-400">{q.id.slice(0, 10)}...</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-600">{q.difficulty || 'Medium'}</span>
                        <span>•</span>
                        <span>{q.subject || 'No Subject'}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                        {currentTopic}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        currentUsage === 'MOCK' ? 'bg-indigo-50 text-indigo-700' :
                        currentUsage === 'PRACTICE' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-purple-50 text-purple-700'
                      }`}>
                        {currentUsage}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            {selectedIds.size > 0 ? (
              <span className="font-bold text-brand-700">
                {selectedIds.size} question{selectedIds.size > 1 ? 's' : ''} ready to assign
              </span>
            ) : (
              'Select questions from Question Bank to add to this topic'
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={selectedIds.size === 0 || isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-xs"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              <span>Assign {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} to {targetTopic.name}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
