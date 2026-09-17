import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Layers, CheckCircle2, Lock, Eye, Copy, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
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

  // Status & Feedback State
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<MockTest | null>(null);

  const [title, setTitle] = useState('');
  const [examCode, setExamCode] = useState('ANCHSL');
  const [duration, setDuration] = useState(60);
  const [totalMarks, setTotalMarks] = useState(100);
  const [positiveMarks, setPositiveMarks] = useState(2);
  const [negativeMarks, setNegativeMarks] = useState(0.5);
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState<number | undefined>(99);
  const [originalPrice, setOriginalPrice] = useState<number | undefined>(199);
  const [offerPrice, setOfferPrice] = useState<number | undefined>(79);
  const [productId, setProductId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [isLive, setIsLive] = useState(false);
  const [isPreviousYear, setIsPreviousYear] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [showResultImmediately, setShowResultImmediately] = useState(true);
  const [showExplanation, setShowExplanation] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, e] = await Promise.all([fetchMockTests(), fetchExams()]);
      setMockTests(m);
      setExams(e);
    } catch (err: any) {
      console.error(err);
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to load mock tests from Firestore.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (test?: MockTest) => {
    setTestError(null);
    if (test) {
      setEditingTest(test);
      setTitle(test.title);
      setExamCode(test.examCode);
      setDuration(test.durationMinutes);
      setTotalMarks(test.totalMarks);
      setPositiveMarks(test.positiveMarks ?? (test.totalMarks && test.totalQuestions ? Number((test.totalMarks / test.totalQuestions).toFixed(2)) : 2));
      setNegativeMarks(test.negativeMarks);
      setIsFree(test.isFree);
      setPrice(test.price);
      setOriginalPrice(test.originalPrice);
      setOfferPrice(test.offerPrice);
      setProductId(test.productId || '');
      setInstructions(test.instructions || '');
      setStatus(test.status === 'draft' ? 'draft' : 'published');
      setIsLive(test.isLive);
      setIsPreviousYear(test.isPreviousYear);
      setStartDate(test.startDate || '');
      setEndDate(test.endDate || '');
      setShuffleQuestions(test.shuffleQuestions ?? true);
      setShuffleOptions(test.shuffleOptions ?? true);
      setShowResultImmediately(test.showResultImmediately ?? true);
      setShowExplanation(test.showExplanation ?? true);
    } else {
      setEditingTest(null);
      setTitle('');
      setExamCode(exams[0]?.code || 'ANCHSL');
      setDuration(60);
      setTotalMarks(100);
      setPositiveMarks(2);
      setNegativeMarks(0.5);
      setIsFree(true);
      setPrice(99);
      setOriginalPrice(199);
      setOfferPrice(79);
      setProductId('');
      setInstructions('1. Each question has 4 options.\n2. Mark your answers carefully.\n3. Negative marks apply for wrong answers.');
      setStatus('published');
      setIsLive(false);
      setIsPreviousYear(false);
      setStartDate('');
      setEndDate('');
      setShuffleQuestions(true);
      setShuffleOptions(true);
      setShowResultImmediately(true);
      setShowExplanation(true);
    }
    setIsModalOpen(true);
  };

  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestError(null);

    // 1. Title validation
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setTestError('Test Title is required.');
      return;
    }

    // 2. Target exam validation
    const cleanExamCode = examCode.trim();
    if (!cleanExamCode) {
      setTestError('Target Exam is required.');
      return;
    }

    // 3. Duration validation (> 0)
    const durationNum = Number(duration);
    if (isNaN(durationNum) || durationNum <= 0) {
      setTestError('Duration must be greater than 0 minutes.');
      return;
    }

    // 4. Total marks validation (> 0)
    const totalMarksNum = Number(totalMarks);
    if (isNaN(totalMarksNum) || totalMarksNum <= 0) {
      setTestError('Total Marks must be greater than 0.');
      return;
    }

    // 5. Marks per question (+) validation (> 0)
    const positiveMarksNum = Number(positiveMarks);
    if (isNaN(positiveMarksNum) || positiveMarksNum <= 0) {
      setTestError('Marks per question must be greater than 0.');
      return;
    }

    // 6. Negative marks (-) validation (>= 0)
    const negativeMarksNum = Number(negativeMarks);
    if (isNaN(negativeMarksNum) || negativeMarksNum < 0) {
      setTestError('Negative marks must be 0 or greater.');
      return;
    }

    // 7. Access Type & Pricing validation
    let cleanProductId: string | undefined = undefined;
    let cleanPrice: number | undefined = undefined;
    let cleanOriginalPrice: number | undefined = undefined;
    let cleanOfferPrice: number | undefined = undefined;

    if (isFree) {
      // For FREE tests: productId, selling price, original price and offer price must not be required and should be omitted/null
      cleanProductId = undefined;
      cleanPrice = undefined;
      cleanOriginalPrice = undefined;
      cleanOfferPrice = undefined;
    } else {
      // For PAID tests: Google Play Product ID/SKU is REQUIRED
      if (!productId || !productId.trim()) {
        setTestError('Google Play Product ID is required for paid tests.');
        return;
      }
      cleanProductId = productId.trim();

      const priceNum = Number(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        setTestError('Selling price must be greater than ₹0 for paid tests.');
        return;
      }
      cleanPrice = priceNum;

      if (offerPrice !== undefined && offerPrice !== null && String(offerPrice).trim() !== '') {
        const offerNum = Number(offerPrice);
        if (isNaN(offerNum) || offerNum <= 0) {
          setTestError('Offer price must be greater than ₹0.');
          return;
        }
        cleanOfferPrice = offerNum;
      }

      if (originalPrice !== undefined && originalPrice !== null && String(originalPrice).trim() !== '') {
        const origNum = Number(originalPrice);
        if (isNaN(origNum) || origNum <= 0) {
          setTestError('Original price must be greater than ₹0.');
          return;
        }
        cleanOriginalPrice = origNum;
      }
    }

    // 8. Scheduled/Live exam dates validation
    let cleanStartDate: string | undefined = undefined;
    let cleanEndDate: string | undefined = undefined;

    if (isLive) {
      if (!startDate || !startDate.trim()) {
        setTestError('Start Date & Time is required for scheduled/live exams.');
        return;
      }
      const startD = new Date(startDate);
      if (isNaN(startD.getTime())) {
        setTestError('Invalid start date for scheduled exam.');
        return;
      }
      cleanStartDate = startDate.trim();

      if (endDate && endDate.trim()) {
        const endD = new Date(endDate);
        if (isNaN(endD.getTime())) {
          setTestError('Invalid end date for scheduled exam.');
          return;
        }
        if (endD <= startD) {
          setTestError('End date must be after the start date.');
          return;
        }
        cleanEndDate = endDate.trim();
      }
    }

    setIsSavingTest(true);

    try {
      const id = editingTest ? editingTest.id : `mock_${Date.now()}`;
      const test: MockTest = {
        id,
        title: cleanTitle,
        examCode: cleanExamCode,
        durationMinutes: durationNum,
        totalQuestions: editingTest ? editingTest.totalQuestions : 0,
        totalMarks: totalMarksNum,
        positiveMarks: positiveMarksNum,
        negativeMarks: negativeMarksNum,
        attemptsCount: editingTest ? editingTest.attemptsCount : 0,
        isFree,
        price: cleanPrice,
        originalPrice: cleanOriginalPrice,
        offerPrice: cleanOfferPrice,
        productId: cleanProductId,
        instructions: instructions.trim() || undefined,
        status,
        language: 'both',
        displayOrder: editingTest ? editingTest.displayOrder : mockTests.length + 1,
        isLive,
        isPreviousYear,
        startDate: cleanStartDate,
        endDate: cleanEndDate,
        shuffleQuestions,
        shuffleOptions,
        showResultImmediately,
        showExplanation,
        sections: editingTest ? editingTest.sections : [
          { id: 'sec_1', name: 'General Intelligence', questionIds: [] },
          { id: 'sec_2', name: 'General Awareness', questionIds: [] },
          { id: 'sec_3', name: 'Quantitative Aptitude', questionIds: [] },
          { id: 'sec_4', name: 'English Language', questionIds: [] },
        ],
      };

      await saveMockTest(test);
      setIsModalOpen(false);
      setActionFeedback({
        type: 'success',
        message: `Mock test "${test.title}" saved successfully!`
      });
      loadData();
    } catch (err: any) {
      console.error(err);
      setTestError(err.message || 'Failed to save mock test to Cloud Firestore.');
    } finally {
      setIsSavingTest(false);
    }
  };

  const handleToggleStatus = async (test: MockTest) => {
    const newStatus = test.status === 'published' ? 'draft' : 'published';
    try {
      const updated: MockTest = { ...test, status: newStatus };
      await saveMockTest(updated);
      setMockTests(mockTests.map((m) => (m.id === test.id ? updated : m)));
      setActionFeedback({
        type: 'success',
        message: `Test "${test.title}" is now ${newStatus.toUpperCase()}`
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to update test status.'
      });
    }
  };

  const handleDuplicateTest = async (test: MockTest) => {
    try {
      const newId = `mock_${Date.now()}`;
      const duplicated: MockTest = {
        ...test,
        id: newId,
        title: `${test.title} (Copy)`,
        status: 'draft',
        attemptsCount: 0,
        created_at: new Date().toISOString(),
      };
      await saveMockTest(duplicated);
      setActionFeedback({
        type: 'success',
        message: `Duplicated test as "${duplicated.title}". Saved as draft.`
      });
      loadData();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to duplicate test.'
      });
    }
  };

  const handleDeleteTest = async (id: string, testTitle: string) => {
    if (!confirm(`Delete test "${testTitle}"? This will also remove test access for students.`)) return;

    setIsDeletingId(id);
    try {
      await deleteMockTest(id);
      setActionFeedback({
        type: 'success',
        message: `Test "${testTitle}" deleted successfully.`
      });
      loadData();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to delete mock test.'
      });
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs px-2 py-0.5 rounded hover:bg-black/5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Mock Tests Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure mock examinations, set independent FREE / PAID pricing, Google Play in-app billing SKU, and manage section questions.
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
                        {test.productId && <span className="ml-1 text-[9px] font-mono opacity-80">({test.productId})</span>}
                      </Badge>
                    )}

                    {test.isLive && <Badge variant="danger">LIVE NOW</Badge>}
                    {test.isPreviousYear && <Badge variant="purple">PYQ</Badge>}

                    <button
                      onClick={() => handleToggleStatus(test)}
                      title="Click to toggle Published / Draft status"
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition flex items-center gap-1 ${
                        test.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {test.status === 'published' ? 'Published' : 'Draft'}
                    </button>
                  </div>

                  <div className="text-xs text-slate-500">
                    {questionCount} Questions in {test.sections.length} Sections • {test.durationMinutes} Mins • {test.totalMarks} Marks (+{test.positiveMarks ?? 2} / -{test.negativeMarks})
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
                    onClick={() => handleDuplicateTest(test)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    title="Duplicate Mock Test"
                  >
                    <Copy size={16} />
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
                    disabled={isDeletingId === test.id}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
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
          {testError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{testError}</span>
            </div>
          )}

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

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Marks per Q (+)</label>
              <input
                type="number"
                step="0.5"
                value={positiveMarks}
                onChange={(e) => setPositiveMarks(parseFloat(e.target.value) || 2)}
                className="w-full text-xs p-2 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Negative Mark (-)</label>
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
            <span className="block text-xs font-bold text-slate-800">Test Access Type & Google Play Monetization</span>
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
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-3 gap-3">
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

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Google Play In-App Product ID (SKU) <span className="text-rose-600 font-extrabold">*</span>
                  </label>
                  <input
                    type="text"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    placeholder="e.g. test_anchsl_mock_01"
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Must match the In-App Product ID created in Google Play Console.</span>
                </div>
              </div>
            )}
          </div>

          {/* Test Status & Flags */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Publication Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="published">Published (Visible in App)</option>
                <option value="draft">Draft (Hidden)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-4">
              <input
                type="checkbox"
                checked={isLive}
                onChange={(e) => setIsLive(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded"
              />
              <span className="text-xs font-semibold text-slate-700">Scheduled / Live Exam</span>
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

          {/* Scheduled / Live Exam Dates (shown only when isLive is checked) */}
          {isLive && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Start Date & Time <span className="text-rose-600 font-extrabold">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  End Date & Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                />
              </div>
            </div>
          )}

          {/* Shuffling & Exam Rules */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="w-3.5 h-3.5 text-brand-600 rounded"
              />
              <span className="text-[11px] font-medium text-slate-700">Shuffle Questions</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="w-3.5 h-3.5 text-brand-600 rounded"
              />
              <span className="text-[11px] font-medium text-slate-700">Shuffle Options</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showResultImmediately}
                onChange={(e) => setShowResultImmediately(e.target.checked)}
                className="w-3.5 h-3.5 text-brand-600 rounded"
              />
              <span className="text-[11px] font-medium text-slate-700">Instant Result</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showExplanation}
                onChange={(e) => setShowExplanation(e.target.checked)}
                className="w-3.5 h-3.5 text-brand-600 rounded"
              />
              <span className="text-[11px] font-medium text-slate-700">Show Solutions</span>
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
              disabled={isSavingTest}
              className="px-6 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 shadow-sm disabled:opacity-50"
            >
              {isSavingTest ? 'Saving...' : 'Save Mock Test'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
