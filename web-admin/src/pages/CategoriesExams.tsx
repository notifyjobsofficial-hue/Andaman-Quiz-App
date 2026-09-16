import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Check, FolderTree, ArrowUpDown, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  fetchCategories,
  saveCategory,
  deleteCategory,
  fetchExams,
  saveExam,
  deleteExam
} from '../firebase/firestore';
import { ExamCategory, Exam } from '../types';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';

export const CategoriesExams: React.FC = () => {
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Category Modal state
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ExamCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catOrder, setCatOrder] = useState(1);
  const [isSavingCat, setIsSavingCat] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Exam Modal state
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examName, setExamName] = useState('');
  const [examCode, setExamCode] = useState('');
  const [examCategoryId, setExamCategoryId] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [examOrder, setExamOrder] = useState(1);
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, e] = await Promise.all([fetchCategories(), fetchExams()]);
      setCategories(c);
      setExams(e);
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err?.message || 'Failed to load categories/exams from Firestore.' });
    } finally {
      setLoading(false);
    }
  };

  // Category Actions
  const handleOpenCatModal = (cat?: ExamCategory) => {
    setCatError(null);
    if (cat) {
      setEditingCat(cat);
      setCatName(cat.name);
      setCatCode(cat.code);
      setCatOrder(cat.order);
    } else {
      setEditingCat(null);
      setCatName('');
      setCatCode('');
      setCatOrder(categories.length + 1);
    }
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName || !catCode) return;

    setCatError(null);
    setIsSavingCat(true);

    const id = editingCat ? editingCat.id : `cat_${catCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const newCat: ExamCategory = {
      id,
      name: catName.trim(),
      code: catCode.trim().toUpperCase(),
      order: Number(catOrder) || 1,
      isActive: true,
    };

    try {
      await saveCategory(newCat);
      setIsCatModalOpen(false);
      setActionFeedback({ type: 'success', message: `Category "${newCat.name}" saved successfully!` });
      await loadData();
    } catch (err: any) {
      console.error('Failed to save category:', err);
      setCatError(err?.message || 'Failed to save category in Firestore. Please verify admin write permissions.');
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;

    try {
      await deleteCategory(id);
      setActionFeedback({ type: 'success', message: `Category "${name}" deleted successfully.` });
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      setActionFeedback({ type: 'error', message: err?.message || 'Failed to delete category.' });
    }
  };

  // Exam Actions
  const handleOpenExamModal = (exam?: Exam) => {
    setExamError(null);
    if (exam) {
      setEditingExam(exam);
      setExamName(exam.name);
      setExamCode(exam.code);
      setExamCategoryId(exam.categoryId || categories[0]?.id || '');
      setExamDescription(exam.description);
      setExamOrder(exam.order);
    } else {
      setEditingExam(null);
      setExamName('');
      setExamCode('');
      setExamCategoryId(categories[0]?.id || '');
      setExamDescription('');
      setExamOrder(exams.length + 1);
    }
    setIsExamModalOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName || !examCode) return;

    setExamError(null);
    setIsSavingExam(true);

    const id = editingExam ? editingExam.id : `exam_${examCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const newExam: Exam = {
      id,
      name: examName.trim(),
      code: examCode.trim().toUpperCase(),
      description: examDescription.trim(),
      categoryId: examCategoryId,
      totalQuestions: editingExam ? editingExam.totalQuestions : 100,
      iconName: 'school',
      order: Number(examOrder) || 1,
      isEnabled: true,
    };

    try {
      await saveExam(newExam);
      setIsExamModalOpen(false);
      setActionFeedback({ type: 'success', message: `Exam "${newExam.name}" saved successfully!` });
      await loadData();
    } catch (err: any) {
      console.error('Failed to save exam:', err);
      setExamError(err?.message || 'Failed to save exam in Firestore. Please verify permissions.');
    } finally {
      setIsSavingExam(false);
    }
  };

  const handleDeleteExam = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete exam "${name}"?`)) return;

    try {
      await deleteExam(id);
      setActionFeedback({ type: 'success', message: `Exam "${name}" deleted successfully.` });
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete exam:', err);
      setActionFeedback({ type: 'error', message: err?.message || 'Failed to delete exam.' });
    }
  };

  return (
    <div className="space-y-8">
      {/* Action Feedback Toast/Alert */}
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
          <h1 className="text-2xl font-extrabold text-slate-900">Categories & Exams Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure dynamic competitive categories and examination tracks without releasing an APK update.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleOpenCatModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
          >
            <Plus size={14} /> Add Category
          </button>
          <button
            onClick={() => handleOpenExamModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus size={14} /> Add Exam
          </button>
        </div>
      </div>

      {/* 1. Categories Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Dynamic Exam Categories</h2>
            <p className="text-xs text-slate-500">Major groupings (e.g. A&N Exams, SSC Exams, Police Exams)</p>
          </div>
          <span className="text-xs font-bold text-slate-400">{categories.length} Categories</span>
        </div>

        <div className="divide-y divide-slate-100">
          {categories.map((cat) => (
            <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                  {cat.order}
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    {cat.name}
                    <Badge variant="info">{cat.code}</Badge>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    ID: {cat.id} • {exams.filter((e) => e.categoryId === cat.id).length} Assigned Exams
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenCatModal(cat)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  title="Edit Category"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Delete Category"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {categories.length === 0 && !loading && (
            <div className="p-6 text-center text-xs text-slate-400">
              No categories found. Click "Add Category" to initialize.
            </div>
          )}
        </div>
      </div>

      {/* 2. Exams Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Available Examination Tracks</h2>
            <p className="text-xs text-slate-500">Exams selectable by students (e.g. A&N CHSL, A&N MTS, SSC CGL)</p>
          </div>
          <span className="text-xs font-bold text-slate-400">{exams.length} Exams</span>
        </div>

        <div className="divide-y divide-slate-100">
          {exams.map((exam) => {
            const cat = categories.find((c) => c.id === exam.categoryId);
            return (
              <div key={exam.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                    {exam.order}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      {exam.name}
                      <Badge variant="purple">{exam.code}</Badge>
                      {cat && <Badge variant="neutral">{cat.name}</Badge>}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 max-w-lg">
                      {exam.description || 'No description provided'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenExamModal(exam)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    title="Edit Exam"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteExam(exam.id, exam.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete Exam"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {exams.length === 0 && !loading && (
            <div className="p-6 text-center text-xs text-slate-400">
              No exams found. Click "Add Exam" to add one.
            </div>
          )}
        </div>
      </div>

      {/* Category Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCat ? 'Edit Category' : 'Create Category'}
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          {catError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{catError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Category Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Andaman & Nicobar Administration Exams"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Category Code / Tag</label>
            <input
              type="text"
              required
              placeholder="e.g. AN"
              value={catCode}
              onChange={(e) => setCatCode(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Display Order</label>
            <input
              type="number"
              value={catOrder}
              onChange={(e) => setCatOrder(parseInt(e.target.value) || 1)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              disabled={isSavingCat}
              onClick={() => setIsCatModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingCat}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSavingCat && <Loader2 size={13} className="animate-spin" />}
              <span>{isSavingCat ? 'Saving Category...' : 'Save Category'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Exam Modal */}
      <Modal
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
        title={editingExam ? 'Edit Exam' : 'Create Exam'}
      >
        <form onSubmit={handleSaveExam} className="space-y-4">
          {examError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{examError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Exam Name</label>
            <input
              type="text"
              required
              placeholder="e.g. A&N Administration CHSL"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Exam Code</label>
            <input
              type="text"
              required
              placeholder="e.g. ANCHSL"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Parent Category</label>
            <select
              value={examCategoryId}
              onChange={(e) => setExamCategoryId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Post details, eligibility, syllabus summary..."
              value={examDescription}
              onChange={(e) => setExamDescription(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Display Order</label>
            <input
              type="number"
              value={examOrder}
              onChange={(e) => setExamOrder(parseInt(e.target.value) || 1)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              disabled={isSavingExam}
              onClick={() => setIsExamModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingExam}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSavingExam && <Loader2 size={13} className="animate-spin" />}
              <span>{isSavingExam ? 'Saving Exam...' : 'Save Exam'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
