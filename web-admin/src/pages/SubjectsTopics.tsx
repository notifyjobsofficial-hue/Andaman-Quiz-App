import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, BookOpen, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  fetchSubjects,
  saveSubject,
  deleteSubject,
  fetchTopics,
  saveTopic,
  deleteTopic,
  fetchExams
} from '../firebase/firestore';
import { Subject, Topic, Exam } from '../types';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';

export const SubjectsTopics: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Subject modal
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subject | null>(null);
  const [subName, setSubName] = useState('');
  const [subHindi, setSubHindi] = useState('');
  const [subExams, setSubExams] = useState<string[]>([]);
  const [isAndamanSpecial, setIsAndamanSpecial] = useState(false);
  const [isSavingSub, setIsSavingSub] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  // Topic modal
  const [isTopModalOpen, setIsTopModalOpen] = useState(false);
  const [editingTop, setEditingTop] = useState<Topic | null>(null);
  const [topName, setTopName] = useState('');
  const [topHindi, setTopHindi] = useState('');
  const [topSubjectId, setTopSubjectId] = useState('');
  const [isSavingTop, setIsSavingTop] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, t, e] = await Promise.all([fetchSubjects(), fetchTopics(), fetchExams()]);
      setSubjects(s);
      setTopics(t);
      setExams(e);
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err?.message || 'Failed to load subjects and topics from Firestore.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSubModal = (sub?: Subject) => {
    setSubError(null);
    if (sub) {
      setEditingSub(sub);
      setSubName(sub.name);
      setSubHindi(sub.hindiName);
      setSubExams(sub.examCodes || []);
      setIsAndamanSpecial(sub.isAndamanSpecial);
    } else {
      setEditingSub(null);
      setSubName('');
      setSubHindi('');
      setSubExams(['CGL', 'CHSL', 'POLICE', 'MTS']);
      setIsAndamanSpecial(false);
    }
    setIsSubModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName) return;

    setSubError(null);
    setIsSavingSub(true);

    const id = editingSub ? editingSub.id : `sub_${subName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const newSub: Subject = {
      id,
      name: subName.trim(),
      hindiName: subHindi.trim(),
      iconName: 'book',
      questionCount: editingSub ? editingSub.questionCount : 0,
      examCodes: subExams,
      isAndamanSpecial,
    };

    try {
      await saveSubject(newSub);
      setIsSubModalOpen(false);
      setActionFeedback({ type: 'success', message: `Subject "${newSub.name}" saved successfully!` });
      await loadData();
    } catch (err: any) {
      console.error('Failed to save subject:', err);
      setSubError(err?.message || 'Failed to save subject in Firestore. Please verify permissions.');
    } finally {
      setIsSavingSub(false);
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    if (!confirm(`Delete subject "${name}"? This may affect topics linked to it.`)) return;

    try {
      await deleteSubject(id);
      setActionFeedback({ type: 'success', message: `Subject "${name}" deleted successfully.` });
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete subject:', err);
      setActionFeedback({ type: 'error', message: err?.message || 'Failed to delete subject.' });
    }
  };

  const handleOpenTopModal = (top?: Topic, defaultSubId?: string) => {
    setTopError(null);
    if (top) {
      setEditingTop(top);
      setTopName(top.name);
      setTopHindi(top.hindiName);
      setTopSubjectId(top.subjectId);
    } else {
      setEditingTop(null);
      setTopName('');
      setTopHindi('');
      setTopSubjectId(defaultSubId || subjects[0]?.id || '');
    }
    setIsTopModalOpen(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topName || !topSubjectId) return;

    setTopError(null);
    setIsSavingTop(true);

    const id = editingTop ? editingTop.id : `top_${topName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const newTopic: Topic = {
      id,
      subjectId: topSubjectId,
      name: topName.trim(),
      hindiName: topHindi.trim(),
      questionCount: editingTop ? editingTop.questionCount : 0,
    };

    try {
      await saveTopic(newTopic);
      setIsTopModalOpen(false);
      setActionFeedback({ type: 'success', message: `Topic "${newTopic.name}" saved successfully!` });
      await loadData();
    } catch (err: any) {
      console.error('Failed to save topic:', err);
      setTopError(err?.message || 'Failed to save topic in Firestore. Please verify permissions.');
    } finally {
      setIsSavingTop(false);
    }
  };

  const handleDeleteTopic = async (id: string, name: string) => {
    if (!confirm(`Delete topic "${name}"?`)) return;

    try {
      await deleteTopic(id);
      setActionFeedback({ type: 'success', message: `Topic "${name}" deleted successfully.` });
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete topic:', err);
      setActionFeedback({ type: 'error', message: err?.message || 'Failed to delete topic.' });
    }
  };

  return (
    <div className="space-y-8">
      {/* Action Feedback Toast */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs font-bold underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Curriculum Subjects & Topics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage subject categories and chapter topics used to tag questions and sectional tests.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleOpenSubModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus size={14} /> Add Subject
          </button>
          <button
            onClick={() => handleOpenTopModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
          >
            <Plus size={14} /> Add Topic
          </button>
        </div>
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subjects.map((sub) => {
          const subTopics = topics.filter((t) => t.subjectId === sub.id);
          return (
            <div key={sub.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{sub.name}</h3>
                    {sub.isAndamanSpecial && (
                      <Badge variant="success">Island Special</Badge>
                    )}
                  </div>
                  {sub.hindiName && (
                    <div className="text-xs text-slate-500 mt-0.5">{sub.hindiName}</div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {sub.examCodes.map((code) => (
                      <Badge key={code} variant="neutral">{code}</Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenSubModal(sub)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteSubject(sub.id, sub.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Topics List */}
              <div className="p-4 flex-1 divide-y divide-slate-100 overflow-y-auto max-h-60">
                <div className="flex items-center justify-between pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Topics ({subTopics.length})</span>
                  <button
                    onClick={() => handleOpenTopModal(undefined, sub.id)}
                    className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1 normal-case"
                  >
                    <Plus size={12} /> Add Topic
                  </button>
                </div>

                {subTopics.map((top) => (
                  <div key={top.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 px-2 rounded-lg transition">
                    <div>
                      <span className="font-semibold text-slate-800">{top.name}</span>
                      {top.hindiName && <span className="text-slate-400 ml-1.5">({top.hindiName})</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenTopModal(top)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteTopic(top.id, top.name)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}

                {subTopics.length === 0 && (
                  <div className="py-4 text-center text-xs text-slate-400">
                    No topics added yet.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subject Modal */}
      <Modal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        title={editingSub ? 'Edit Subject' : 'Add Subject'}
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          {subError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{subError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Subject Name (English)</label>
            <input
              type="text"
              required
              placeholder="e.g. Quantitative Aptitude"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Subject Name (Hindi)</label>
            <input
              type="text"
              placeholder="e.g. संख्यात्मक अभियोग्यता"
              value={subHindi}
              onChange={(e) => setSubHindi(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Exam Codes (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. CGL, CHSL, POLICE, MTS"
              value={subExams.join(', ')}
              onChange={(e) => setSubExams(e.target.value.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={isAndamanSpecial}
              onChange={(e) => setIsAndamanSpecial(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
            />
            <span className="text-xs font-bold text-slate-700">Andaman Island Specific Module (High Priority)</span>
          </label>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              disabled={isSavingSub}
              onClick={() => setIsSubModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingSub}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSavingSub && <Loader2 size={13} className="animate-spin" />}
              <span>{isSavingSub ? 'Saving Subject...' : 'Save Subject'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Topic Modal */}
      <Modal
        isOpen={isTopModalOpen}
        onClose={() => setIsTopModalOpen(false)}
        title={editingTop ? 'Edit Topic' : 'Add Topic'}
      >
        <form onSubmit={handleSaveTopic} className="space-y-4">
          {topError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{topError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Parent Subject</label>
            <select
              value={topSubjectId}
              onChange={(e) => setTopSubjectId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white outline-none"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Topic Name (English)</label>
            <input
              type="text"
              required
              placeholder="e.g. Percentage, Number Series"
              value={topName}
              onChange={(e) => setTopName(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Topic Name (Hindi)</label>
            <input
              type="text"
              placeholder="e.g. प्रतिशतता"
              value={topHindi}
              onChange={(e) => setTopHindi(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              disabled={isSavingTop}
              onClick={() => setIsTopModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingTop}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSavingTop && <Loader2 size={13} className="animate-spin" />}
              <span>{isSavingTop ? 'Saving Topic...' : 'Save Topic'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
