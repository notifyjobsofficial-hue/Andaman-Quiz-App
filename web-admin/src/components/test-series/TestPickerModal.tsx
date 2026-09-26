import React, { useState, useEffect, useMemo } from 'react';
import { Search, CheckSquare, Square, AlertCircle, Loader2, Plus, Clock, Award, HelpCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { MockTest, SeriesItemAccessMode } from '../../types';
import { fetchMockTests } from '../../firebase/firestore';

interface TestPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  seriesExamCode: string;
  folderTitle: string;
  existingTestIdsInFolder: string[];
  onAddTests: (
    selectedTestIds: string[],
    accessMode: SeriesItemAccessMode,
    unlockAt?: string
  ) => Promise<void>;
}

export const TestPickerModal: React.FC<TestPickerModalProps> = ({
  isOpen,
  onClose,
  seriesExamCode,
  folderTitle,
  existingTestIdsInFolder,
  onAddTests,
}) => {
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterExam, setFilterExam] = useState<'MATCH' | 'ALL'>('MATCH');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [accessMode, setAccessMode] = useState<SeriesItemAccessMode>('INCLUDED');
  const [unlockAt, setUnlockAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTests();
      setSelectedIds(new Set());
      setAccessMode('INCLUDED');
      setUnlockAt('');
      setError(null);
    }
  }, [isOpen]);

  const loadTests = async () => {
    setLoading(true);
    try {
      const tests = await fetchMockTests();
      setMockTests(tests);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch mock tests.');
    } finally {
      setLoading(false);
    }
  };

  const existingSet = useMemo(() => new Set(existingTestIdsInFolder), [existingTestIdsInFolder]);

  const filteredTests = useMemo(() => {
    return mockTests.filter((test) => {
      // Exam filter
      if (filterExam === 'MATCH' && test.examCode !== seriesExamCode) {
        return false;
      }
      // Status filter
      if (filterStatus === 'PUBLISHED' && test.status !== 'published') {
        return false;
      }
      if (filterStatus === 'DRAFT' && test.status !== 'draft') {
        return false;
      }
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = test.title.toLowerCase().includes(q);
        const matchesExam = test.examCode.toLowerCase().includes(q);
        if (!matchesTitle && !matchesExam) return false;
      }
      return true;
    });
  }, [mockTests, filterExam, filterStatus, searchQuery, seriesExamCode]);

  const selectableTests = useMemo(() => {
    return filteredTests.filter((t) => !existingSet.has(t.id));
  }, [filteredTests, existingSet]);

  const toggleSelect = (testId: string) => {
    if (existingSet.has(testId)) return;
    const next = new Set(selectedIds);
    if (next.has(testId)) {
      next.delete(testId);
    } else {
      next.add(testId);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === selectableTests.length && selectableTests.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableTests.map((t) => t.id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedIds.size === 0) {
      setError('Please select at least one test to add.');
      return;
    }

    let cleanUnlockAt: string | undefined = undefined;
    if (accessMode === 'LOCKED_UNTIL_DATE') {
      if (!unlockAt) {
        setError('Please select an unlock date/time.');
        return;
      }
      const d = new Date(unlockAt);
      if (isNaN(d.getTime())) {
        setError('Invalid unlock date/time.');
        return;
      }
      cleanUnlockAt = d.toISOString();
    }

    setSubmitting(true);
    try {
      await onAddTests(Array.from(selectedIds), accessMode, cleanUnlockAt);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to add tests to folder.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Tests to "${folderTitle}"`}
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="sm:col-span-6 relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests by title or exam code..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={filterExam}
              onChange={(e) => setFilterExam(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
            >
              <option value="MATCH">Series Exam ({seriesExamCode})</option>
              <option value="ALL">All Available Exams</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="PUBLISHED">Published Only</option>
              <option value="DRAFT">Draft Only</option>
            </select>
          </div>
        </div>

        {/* Access Mode Configuration */}
        <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-indigo-900">Set Access Mode for selected:</span>
            <select
              value={accessMode}
              onChange={(e) => setAccessMode(e.target.value as SeriesItemAccessMode)}
              className="px-2.5 py-1 text-xs border border-indigo-200 rounded-lg bg-white font-semibold text-slate-800"
            >
              <option value="INCLUDED">INCLUDED (Unlocked with Series)</option>
              <option value="FREE_PREVIEW">FREE PREVIEW (Free for All Students)</option>
              <option value="LOCKED_UNTIL_DATE">LOCKED UNTIL DATE (Scheduled Release)</option>
            </select>
          </div>

          {accessMode === 'LOCKED_UNTIL_DATE' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Unlock Date:</span>
              <input
                type="datetime-local"
                value={unlockAt}
                onChange={(e) => setUnlockAt(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                required
              />
            </div>
          )}
        </div>

        {/* Selection summary & toggle all */}
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={selectableTests.length === 0}
              className="flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-bold transition disabled:opacity-50"
            >
              {selectedIds.size === selectableTests.length && selectableTests.length > 0 ? (
                <>
                  <CheckSquare size={14} />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square size={14} />
                  <span>Select All ({selectableTests.length})</span>
                </>
              )}
            </button>
            <span>•</span>
            <span>{selectedIds.size} selected</span>
          </div>

          <span className="text-slate-400 text-[11px]">
            {filteredTests.length} total test{filteredTests.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {/* Test List */}
        <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="animate-spin text-brand-500" size={24} />
              <span className="text-xs font-semibold">Loading canonical mock tests...</span>
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No mock tests match your search criteria.
            </div>
          ) : (
            filteredTests.map((test) => {
              const isAlreadyAdded = existingSet.has(test.id);
              const isSelected = selectedIds.has(test.id);
              const isDraft = test.status === 'draft';

              return (
                <div
                  key={test.id}
                  onClick={() => !isAlreadyAdded && toggleSelect(test.id)}
                  className={`p-3 flex items-center justify-between gap-3 text-xs transition ${
                    isAlreadyAdded
                      ? 'bg-slate-50 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-brand-50/70 border-l-4 border-l-brand-600 cursor-pointer'
                      : 'hover:bg-slate-50/80 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      disabled={isAlreadyAdded}
                      className="shrink-0 text-slate-400 hover:text-brand-600 disabled:opacity-40"
                    >
                      {isAlreadyAdded ? (
                        <CheckSquare size={16} className="text-slate-400" />
                      ) : isSelected ? (
                        <CheckSquare size={16} className="text-brand-600" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-slate-800 truncate">{test.title}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {test.examCode}
                        </span>
                        {isDraft && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Draft Mock
                          </span>
                        )}
                        {test.isFree ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Free
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            ₹{test.price}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-slate-500 text-[11px]">
                        <span className="flex items-center gap-1">
                          <HelpCircle size={12} />
                          {test.totalQuestions || 0} Questions
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {test.durationMinutes || 0} Mins
                        </span>
                        <span className="flex items-center gap-1">
                          <Award size={12} />
                          {test.totalMarks || 0} Marks
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isAlreadyAdded ? (
                      <span className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-200 text-slate-600">
                        Already in Folder
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(test.id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-brand-600 text-white'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {selectedIds.size > 0 ? (
              <span className="font-semibold text-brand-700">
                Adding {selectedIds.size} canonical mock test reference{selectedIds.size > 1 ? 's' : ''}.
              </span>
            ) : (
              <span>Select tests above to link them to this folder.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectedIds.size === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Add {selectedIds.size} Test{selectedIds.size !== 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
