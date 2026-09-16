import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Check, FolderTree, ArrowUpDown } from 'lucide-react';
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

  // Modals state
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ExamCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catOrder, setCatOrder] = useState(1);

  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [examName, setExamName] = useState('');
  const [examCode, setExamCode] = useState('');
  const [examCategoryId, setExamCategoryId] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [examOrder, setExamOrder] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, e] = await Promise.all([fetchCategories(), fetchExams()]);
      setCategories(c);
      setExams(e);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Category Actions
  const handleOpenCatModal = (cat?: ExamCategory) => {
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

    const id = editingCat ? editingCat.id : `cat_${catCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const newCat: ExamCategory = {
      id,
      name: catName.trim(),
      code: catCode.trim().toUpperCase(),
      order: Number(catOrder) || 1,
      isActive: true,
    };

    await saveCategory(newCat);
    setIsCatModalOpen(false);
    loadData();
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete category "${name}"?`)) {
      await deleteCategory(id);
      loadData();
    }
  };

  // Exam Actions
  const handleOpenExamModal = (exam?: Exam) => {
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

    await saveExam(newExam);
    setIsExamModalOpen(false);
    loadData();
  };

  const handleDeleteExam = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete exam "${name}"?`)) {
      await deleteExam(id);
      loadData();
    }
  };

  return (
    <div className="space-y-8">
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
              onClick={() => setIsCatModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700"
            >
              Save Category
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
              onClick={() => setIsExamModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700"
            >
              Save Exam
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
