import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlayCircle
} from 'lucide-react';
import { fetchLiveTests, saveLiveTest, deleteLiveTest } from '../firebase/firestore';
import { fetchMockTests } from '../firebase/firestore';
import { LiveTestItem, MockTest } from '../types';
import { Modal } from '../components/common/Modal';

export const LiveTests: React.FC = () => {
  const [liveTests, setLiveTests] = useState<LiveTestItem[]>([]);
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<LiveTestItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [selectedMockId, setSelectedMockId] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('12:00');
  const [instructions, setInstructions] = useState('');
  const [featured, setFeatured] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [allowEarlyJoin, setAllowEarlyJoin] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tests, mocks] = await Promise.all([fetchLiveTests(), fetchMockTests()]);
      setLiveTests(tests);
      setMockTests(mocks);
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to load live tests.' });
    } finally {
      setLoading(false);
    }
  };

  const calculateStatus = (startIso: string, endIso: string): 'UPCOMING' | 'LIVE' | 'ENDED' => {
    const now = new Date();
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (now < start) return 'UPCOMING';
    if (now < end) return 'LIVE';
    return 'ENDED';
  };

  const handleOpenCreateModal = () => {
    setEditingTest(null);
    setFormError(null);
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setStartTime('10:00');
    setEndDate(today);
    setEndTime('12:00');
    setInstructions('');
    setFeatured(false);
    setIsPublished(true);
    setAllowEarlyJoin(false);

    if (mockTests.length > 0) {
      setSelectedMockId(mockTests[0].id);
      setTitle(mockTests[0].title);
    } else {
      setSelectedMockId('');
      setTitle('');
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: LiveTestItem) => {
    setEditingTest(t);
    setFormError(null);
    setSelectedMockId(t.testId || t.mockTestId || '');
    setTitle(t.title);

    const s = new Date(t.startAt);
    const e = new Date(t.endAt);

    setStartDate(s.toISOString().split('T')[0]);
    setStartTime(s.toTimeString().slice(0, 5));
    setEndDate(e.toISOString().split('T')[0]);
    setEndTime(e.toTimeString().slice(0, 5));

    setInstructions(t.instructions || '');
    setFeatured(t.featured || false);
    setIsPublished(t.isPublished !== false);
    setAllowEarlyJoin(t.allowEarlyJoin || false);
    setIsModalOpen(true);
  };

  const handleMockSelectChange = (mockId: string) => {
    setSelectedMockId(mockId);
    const mock = mockTests.find((m) => m.id === mockId);
    if (mock && (!title || mockTests.some((m) => m.title === title))) {
      setTitle(mock.title);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedMockId || !mockTests.some((m) => m.id === selectedMockId)) {
      setFormError('Please select a valid existing Mock Test from the list.');
      return;
    }
    if (!title.trim()) {
      setFormError('Please enter a display title.');
      return;
    }
    if (!startDate || !startTime || !endDate || !endTime) {
      setFormError('Please provide complete start and end date and times.');
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(`${endDate}T${endTime}:00`);

    if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
      setFormError('Invalid date or time provided.');
      return;
    }

    // Validation: reject endAt <= startAt
    if (endDateTime <= startDateTime) {
      setFormError('End Date & Time must be strictly later than Start Date & Time.');
      return;
    }

    setIsSaving(true);
    try {
      const liveTestId = editingTest?.id || `live_${Date.now()}`;
      const nowIso = new Date().toISOString();

      const payload: LiveTestItem = {
        id: liveTestId,
        testId: selectedMockId, // Canonical linked mock test ID
        mockTestId: selectedMockId, // Dual-write for backward compatibility
        title: title.trim(),
        startAt: startDateTime.toISOString(),
        endAt: endDateTime.toISOString(),
        instructions: instructions.trim() || undefined,
        featured,
        isPublished,
        allowEarlyJoin,
        created_at: editingTest?.created_at || nowIso,
        updated_at: nowIso,
      };

      await saveLiveTest(payload);

      setActionFeedback({
        type: 'success',
        message: `Live test "${title}" ${editingTest ? 'updated' : 'scheduled'} successfully.`,
      });

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to save live test.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, testTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete live test "${testTitle}"?`)) return;
    try {
      await deleteLiveTest(id);
      setActionFeedback({ type: 'success', message: 'Live test deleted successfully.' });
      await loadData();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to delete live test.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Radio className="w-6 h-6 text-red-600 animate-pulse" />
            Live Tests Scheduling
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Schedule real-time CBT mock tests with automated start/end countdowns linked to existing question banks.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          disabled={mockTests.length === 0}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-medium shadow-sm transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Schedule Live Test
        </button>
      </div>

      {/* Action Feedback */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between border ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className="text-sm font-medium">{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Loading scheduled tests...</div>
        ) : liveTests.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-700">No scheduled live tests</h3>
            <p className="text-sm mt-1 text-slate-400">
              Schedule your first live test to display an active countdown in the Android student app.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
                <tr>
                  <th className="py-3.5 px-4">Display Title</th>
                  <th className="py-3.5 px-4">Linked Mock Test</th>
                  <th className="py-3.5 px-4">Start Time</th>
                  <th className="py-3.5 px-4">End Time</th>
                  <th className="py-3.5 px-4">Calculated Status</th>
                  <th className="py-3.5 px-4 text-center">Published</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {liveTests.map((t) => {
                  const status = calculateStatus(t.startAt, t.endAt);
                  const canonicalTestId = t.testId || t.mockTestId || '';
                  const linkedMock = mockTests.find((m) => m.id === canonicalTestId);

                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{t.title}</div>
                        {t.featured && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                            FEATURED
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {linkedMock ? (
                          <div>
                            <span className="font-medium text-slate-700">{linkedMock.title}</span>
                            <span className="text-xs text-slate-400 ml-1">({linkedMock.examCode})</span>
                          </div>
                        ) : (
                          <span className="text-xs text-rose-600 font-mono font-bold flex items-center gap-1">
                            <AlertCircle size={12} /> Test Missing ({canonicalTestId || 'None'})
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        {new Date(t.startAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        {new Date(t.endAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-md font-bold ${
                            status === 'LIVE'
                              ? 'bg-red-100 text-red-700 border border-red-200 animate-pulse'
                              : status === 'UPCOMING'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        {t.isPublished ? (
                          <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Draft</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-blue-600 rounded transition"
                          title="Edit Schedule"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id, t.title)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition"
                          title="Delete Live Test"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingTest ? 'Edit Live Test Schedule' : 'Schedule New Live Test'}
        >
          <form onSubmit={handleSave} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Select Mock Test */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Select Existing Mock Test *
              </label>
              <select
                required
                value={selectedMockId}
                onChange={(e) => handleMockSelectChange(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
              >
                <option value="" disabled>
                  -- Select Mock Test --
                </option>
                {mockTests.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.examCode} • {m.totalQuestions} Qs • {m.durationMinutes}m)
                  </option>
                ))}
              </select>
            </div>

            {/* Display Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Live Test Display Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. All Andaman CHSL All-Island Live Mock Test"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Start Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* End Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Special Instructions (Optional)
              </label>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Instructions displayed to students prior to joining the live test..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Toggles */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="featured"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="featured" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Featured Live Test (Prioritize on Home screen)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="isPublished" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Published (Visible in student app)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowEarlyJoin"
                  checked={allowEarlyJoin}
                  onChange={(e) => setAllowEarlyJoin(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="allowEarlyJoin" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Allow Join Before Start (Default: False)
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : editingTest ? 'Update Schedule' : 'Schedule Live Test'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
