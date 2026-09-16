import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Layers, CheckCircle2, Lock, Eye } from 'lucide-react';
import { fetchMockTests, saveMockTest, deleteMockTest, fetchExams } from '../firebase/firestore';
import { MockTest, Exam } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

interface MockTestsProps {
  onNavigateToBuilder: (testId: string) => void;
}

export const MockTests: React.FC<MockTestsProps> = ({ onNavigateToBuilder }) => {
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<MockTest | null>(null);

  const [title, setTitle] = useState('');
  const [examCode, setExamCode] = useState('ANCHSL');
  const [duration, setDuration] = useState(60);
  const [totalMarks, setTotalMarks] = useState(100);
  const [negativeMarks, setNegativeMarks] = useState(0.5);
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState<number | undefined>(99);
  const [originalPrice, setOriginalPrice] = useState<number | undefined>(199);
  const [offerPrice, setOfferPrice] = useState<number | undefined>(79);
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [isLive, setIsLive] = useState(false);
  const [isPreviousYear, setIsPreviousYear] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, e] = await Promise.all([fetchMockTests(), fetchExams()]);
      setMockTests(m);
      setExams(e);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (test?: MockTest) => {
    if (test) {
      setEditingTest(test);
      setTitle(test.title);
      setExamCode(test.examCode);
      setDuration(test.durationMinutes);
      setTotalMarks(test.totalMarks);
      setNegativeMarks(test.negativeMarks);
      setIsFree(test.isFree);
      setPrice(test.price);
      setOriginalPrice(test.originalPrice);
      setOfferPrice(test.offerPrice);
      setInstructions(test.instructions || '');
      setStatus(test.status === 'draft' ? 'draft' : 'published');
      setIsLive(test.isLive);
      setIsPreviousYear(test.isPreviousYear);
    } else {
      setEditingTest(null);
      setTitle('');
      setExamCode(exams[0]?.code || 'ANCHSL');
      setDuration(60);
      setTotalMarks(100);
      setNegativeMarks(0.5);
      setIsFree(true);
      setPrice(99);
      setOriginalPrice(199);
      setOfferPrice(79);
      setInstructions('1. Each question has 4 options.\n2. Mark your answers carefully.\n3. Negative marks apply for wrong answers.');
      setStatus('published');
      setIsLive(false);
      setIsPreviousYear(false);
    }
    setIsModalOpen(true);
  };

  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const id = editingTest ? editingTest.id : `mock_${Date.now()}`;
    const test: MockTest = {
      id,
      title: title.trim(),
      examCode,
      durationMinutes: Number(duration) || 60,
      totalQuestions: editingTest ? editingTest.totalQuestions : 0,
      totalMarks: Number(totalMarks) || 100,
      negativeMarks: Number(negativeMarks) || 0.5,
      attemptsCount: editingTest ? editingTest.attemptsCount : 0,
      isFree,
      price: isFree ? undefined : Number(price) || 99,
      originalPrice: isFree ? undefined : Number(originalPrice) || undefined,
      offerPrice: isFree ? undefined : Number(offerPrice) || undefined,
      instructions,
      status,
      language: 'both',
      displayOrder: 1,
      isLive,
      isPreviousYear,
      sections: editingTest ? editingTest.sections : [
        { id: 'sec_1', name: 'General Intelligence', questionIds: [] },
        { id: 'sec_2', name: 'General Awareness', questionIds: [] },
        { id: 'sec_3', name: 'Quantitative Aptitude', questionIds: [] },
        { id: 'sec_4', name: 'English Language', questionIds: [] },
      ],
    };

    await saveMockTest(test);
    setIsModalOpen(false);
    loadData();
  };

  const handleDeleteTest = async (id: string, testTitle: string) => {
    if (confirm(`Delete test "${testTitle}"?`)) {
      await deleteMockTest(id);
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Mock Tests Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure mock examinations, set independent FREE / PAID pricing, and manage section questions.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-sm self-start"
        >
          <Plus size={14} /> Create Mock Test
        </button>
      </div>

      {/* Mock Tests List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs font-bold text-slate-700">Configured Tests ({mockTests.length})</span>
        </div>

        <div className="divide-y divide-slate-100">
          {mockTests.map((test) => {
            const questionCount = test.sections.reduce((acc, s) => acc + s.questionIds.length, 0);

            return (
              <div key={test.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900">{test.title}</span>
                    <Badge variant="info">{test.examCode}</Badge>

                    {test.isFree ? (
                      <Badge variant="success">FREE</Badge>
                    ) : (
                      <Badge variant="warning">
                        PAID: ₹{test.offerPrice || test.price || 99}
                      </Badge>
                    )}

                    {test.isLive && <Badge variant="danger">LIVE NOW</Badge>}
                    {test.isPreviousYear && <Badge variant="purple">PYQ</Badge>}

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      test.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {test.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500">
                    {questionCount} Questions in {test.sections.length} Sections • {test.durationMinutes} Mins • {test.totalMarks} Marks • -{test.negativeMarks} Negative
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => onNavigateToBuilder(test.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl text-xs font-bold transition border border-brand-200"
                    title="Build Sections & Pick Questions"
                  >
                    <Layers size={14} /> Questions ({questionCount})
                  </button>

                  <button
                    onClick={() => handleOpenModal(test)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    title="Edit Test Settings"
                  >
                    <Edit2 size={16} />
                  </button>

                  <button
                    onClick={() => handleDeleteTest(test.id, test.title)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete Test"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          {mockTests.length === 0 && !loading && (
            <div className="p-12 text-center text-xs text-slate-400">
              No mock tests configured yet. Click "Create Mock Test" above to start.
            </div>
          )}
        </div>
      </div>

      {/* Mock Test Settings Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTest ? 'Edit Mock Test' : 'Create New Mock Test'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveTest} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Test Title</label>
            <input
              type="text"
              required
              placeholder="e.g. A&N Police Sub-Inspector Full Mock 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Exam</label>
              <select
                value={examCode}
                onChange={(e) => setExamCode(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-white"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.code}>{ex.name} ({ex.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Mins)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                className="w-full text-xs p-2 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Total Marks</label>
              <input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(parseFloat(e.target.value) || 100)}
                className="w-full text-xs p-2 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Negative Marking (-)</label>
              <input
                type="number"
                step="0.25"
                value={negativeMarks}
                onChange={(e) => setNegativeMarks(parseFloat(e.target.value) || 0.5)}
                className="w-full text-xs p-2 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {/* ACCESS TYPE: FREE vs PAID */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <span className="block text-xs font-bold text-slate-800">Test Access Type</span>
            <div className="flex items-center gap-6 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-700">
                <input
                  type="radio"
                  name="accessType"
                  checked={isFree}
                  onChange={() => setIsFree(true)}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span>FREE (Available to all students)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-700">
                <input
                  type="radio"
                  name="accessType"
                  checked={!isFree}
                  onChange={() => setIsFree(false)}
                  className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                />
                <span>PAID / PREMIUM (Locked by default)</span>
              </label>
            </div>

            {!isFree && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    value={price || ''}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    placeholder="99"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Original Price (₹)</label>
                  <input
                    type="number"
                    value={originalPrice || ''}
                    onChange={(e) => setOriginalPrice(parseFloat(e.target.value) || 0)}
                    placeholder="199"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Offer Price (₹)</label>
                  <input
                    type="number"
                    value={offerPrice || ''}
                    onChange={(e) => setOfferPrice(parseFloat(e.target.value) || 0)}
                    placeholder="79"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Test Status & Flags */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Publication Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-4">
              <input
                type="checkbox"
                checked={isLive}
                onChange={(e) => setIsLive(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded"
              />
              <span className="text-xs font-semibold text-slate-700">Scheduled / Live Test</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer pt-4">
              <input
                type="checkbox"
                checked={isPreviousYear}
                onChange={(e) => setIsPreviousYear(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
              <span className="text-xs font-semibold text-slate-700">Previous Year Paper (PYQ)</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Exam Instructions</label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 shadow-sm"
            >
              Save Mock Test
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
