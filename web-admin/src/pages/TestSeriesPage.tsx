import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  Layers,
  Folder,
  Eye,
  Copy,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Calendar,
  Sparkles,
  Archive,
  ArrowUpDown,
  BookOpen,
  DollarSign,
  Tag
} from 'lucide-react';
import {
  TestSeries,
  TestSeriesFolder,
  TestSeriesItem,
  MockTest,
  Exam
} from '../types';
import {
  fetchTestSeries,
  saveTestSeries,
  deleteTestSeries,
  duplicateTestSeries,
  fetchTestSeriesFolders,
  fetchTestSeriesItems,
  fetchMockTests,
  fetchExams,
  updateSeriesStats
} from '../firebase/firestore';
import { TestSeriesModal } from '../components/test-series/TestSeriesModal';
import { SeriesPreviewModal } from '../components/test-series/SeriesPreviewModal';
import { Modal } from '../components/common/Modal';

interface TestSeriesPageProps {
  onNavigateToBuilder: (seriesId: string) => void;
  onNavigateToMockBuilder?: (testId: string) => void;
}

export const TestSeriesPage: React.FC<TestSeriesPageProps> = ({
  onNavigateToBuilder,
}) => {
  const [seriesList, setSeriesList] = useState<TestSeries[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExam, setSelectedExam] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedAccess, setSelectedAccess] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'sortOrder' | 'date' | 'tests' | 'title'>('sortOrder');

  // Modals State
  const [isCreateEditModalOpen, setIsCreateEditModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<TestSeries | null>(null);

  // Preview Modal State
  const [previewSeries, setPreviewSeries] = useState<TestSeries | null>(null);
  const [previewFolders, setPreviewFolders] = useState<TestSeriesFolder[]>([]);
  const [previewItemsByFolder, setPreviewItemsByFolder] = useState<Record<string, TestSeriesItem[]>>({});
  const [previewCanonicalMocks, setPreviewCanonicalMocks] = useState<Record<string, MockTest>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {},
  });

  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, ex] = await Promise.all([fetchTestSeries(), fetchExams()]);
      setSeriesList(list);
      setExams(ex);
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to load test series.' });
    } finally {
      setLoading(false);
    }
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const total = seriesList.length;
    const published = seriesList.filter((s) => s.status === 'published').length;
    const free = seriesList.filter((s) => s.isFree).length;
    const paid = seriesList.filter((s) => !s.isFree).length;
    const totalTests = seriesList.reduce((acc, s) => acc + (s.totalTests || 0), 0);
    return { total, published, free, paid, totalTests };
  }, [seriesList]);

  // Filtering & Sorting
  const filteredSeries = useMemo(() => {
    return seriesList
      .filter((s) => {
        if (selectedExam !== 'ALL' && s.examCode !== selectedExam) return false;
        if (selectedStatus !== 'ALL' && s.status !== selectedStatus) return false;
        if (selectedAccess === 'FREE' && !s.isFree) return false;
        if (selectedAccess === 'PAID' && s.isFree) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = s.title.toLowerCase().includes(q);
          const matchSub = s.subtitle?.toLowerCase().includes(q) || false;
          const matchExam = s.examCode.toLowerCase().includes(q);
          const matchTags = s.tags?.some((t) => t.toLowerCase().includes(q)) || false;
          if (!matchTitle && !matchSub && !matchExam && !matchTags) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'sortOrder') return (a.sortOrder || 0) - (b.sortOrder || 0);
        if (sortBy === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'tests') return (b.totalTests || 0) - (a.totalTests || 0);
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return 0;
      });
  }, [seriesList, selectedExam, selectedStatus, selectedAccess, searchQuery, sortBy]);

  // Handlers
  const handleOpenCreateModal = () => {
    setEditingSeries(null);
    setIsCreateEditModalOpen(true);
  };

  const handleOpenEditModal = (series: TestSeries) => {
    setEditingSeries(series);
    setIsCreateEditModalOpen(true);
  };

  const handleSaveSeries = async (seriesData: TestSeries) => {
    await saveTestSeries(seriesData);
    setActionFeedback({
      type: 'success',
      message: `Test Series "${seriesData.title}" saved successfully.`,
    });
    await loadData();
  };

  const handleDuplicate = async (series: TestSeries) => {
    setConfirmModal({
      isOpen: true,
      title: `Duplicate "${series.title}"?`,
      message: `This will clone the entire Test Series structure (including all folders and item references) as a new Draft series. Canonical Mock Tests and questions will NOT be duplicated.`,
      action: async () => {
        try {
          const newId = await duplicateTestSeries(series.id);
          setActionFeedback({
            type: 'success',
            message: `Test Series duplicated as draft (${newId}).`,
          });
          await loadData();
        } catch (err: any) {
          console.error(err);
          setActionFeedback({ type: 'error', message: err.message || 'Failed to duplicate test series.' });
        }
      },
    });
  };

  const handleDelete = (series: TestSeries) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete Test Series "${series.title}"?`,
      message: `Are you sure you want to delete this Test Series? All folders and test references in this series will be deleted. (Canonical Mock Tests and questions remain 100% safe and intact).`,
      action: async () => {
        try {
          await deleteTestSeries(series.id);
          setActionFeedback({ type: 'success', message: `Test Series "${series.title}" deleted.` });
          await loadData();
        } catch (err: any) {
          console.error(err);
          setActionFeedback({ type: 'error', message: err.message || 'Failed to delete test series.' });
        }
      },
    });
  };

  const handleToggleStatus = async (series: TestSeries, newStatus: 'published' | 'draft' | 'archived') => {
    try {
      const updated: TestSeries = {
        ...series,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      await saveTestSeries(updated);
      setActionFeedback({
        type: 'success',
        message: `Status updated to ${newStatus} for "${series.title}".`,
      });
      await loadData();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to update status.' });
    }
  };

  const handleOpenPreview = async (series: TestSeries) => {
    setLoadingPreview(true);
    setPreviewSeries(series);
    try {
      const [foldersList, mocksList] = await Promise.all([
        fetchTestSeriesFolders(series.id),
        fetchMockTests(),
      ]);

      const mockMap: Record<string, MockTest> = {};
      mocksList.forEach((m) => {
        mockMap[m.id] = m;
      });
      setPreviewCanonicalMocks(mockMap);

      const itemsMap: Record<string, TestSeriesItem[]> = {};
      await Promise.all(
        foldersList.map(async (f) => {
          const items = await fetchTestSeriesItems(series.id, f.id);
          itemsMap[f.id] = items;
        })
      );
      setPreviewFolders(foldersList);
      setPreviewItemsByFolder(itemsMap);
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: 'Failed to load preview data.' });
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-brand-100 text-brand-700">
              LMS BUNDLES
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">Test Series & Packages</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize canonical mock tests into structured curriculum, exam bundles, and monetized test series.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition shrink-0"
        >
          <Plus size={15} />
          <span>Create Test Series</span>
        </button>
      </div>

      {/* Notifications */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Series</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{kpis.total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Published</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{kpis.published}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Free Series</div>
          <div className="text-2xl font-black text-blue-700 mt-1">{kpis.free}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Paid Bundles</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{kpis.paid}</div>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Linked Tests</div>
          <div className="text-2xl font-black text-indigo-700 mt-1">{kpis.totalTests}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-4 relative">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, subtitle, or tags..."
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          {/* Exam Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
            >
              <option value="ALL">All Exams</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.code}>
                  {ex.name} ({ex.code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Pricing Access Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedAccess}
              onChange={(e) => setSelectedAccess(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
            >
              <option value="ALL">Free & Paid</option>
              <option value="FREE">Free Series</option>
              <option value="PAID">Paid Bundles</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="sm:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
            >
              <option value="sortOrder">Sort Order</option>
              <option value="date">Newest First</option>
              <option value="tests">Most Tests</option>
              <option value="title">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Series Cards / Table */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="animate-spin text-brand-500" size={32} />
          <span className="text-xs font-semibold">Loading Test Series...</span>
        </div>
      ) : filteredSeries.length === 0 ? (
        <div className="py-20 text-center bg-white border border-dashed border-slate-300 rounded-2xl p-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
            <Layers size={24} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">No Test Series Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No test series match your filters. Try clearing filters or create a new test series.
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Create Test Series</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSeries.map((series) => (
            <div
              key={series.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              {/* Left Column: Image + Info */}
              <div className="flex items-start gap-4 min-w-0">
                {series.thumbnailUrl ? (
                  <img
                    src={series.thumbnailUrl}
                    alt={series.title}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                    <Layers size={28} />
                  </div>
                )}

                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.2 rounded text-[10px] font-extrabold bg-brand-50 text-brand-700 border border-brand-200">
                      {series.examCode}
                    </span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                      series.status === 'published'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : series.status === 'draft'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {series.status.toUpperCase()}
                    </span>
                    {series.isFeatured && (
                      <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-0.5">
                        <Sparkles size={10} /> Featured
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                    {series.title}
                  </h3>

                  {series.subtitle && (
                    <p className="text-xs text-slate-500 font-medium line-clamp-1">{series.subtitle}</p>
                  )}

                  {/* Pricing & Validity */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    {series.isFree ? (
                      <span className="font-extrabold text-emerald-700">FREE</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900">₹{series.price}</span>
                        {series.originalPrice && (
                          <span className="text-slate-400 line-through text-[11px]">
                            ₹{series.originalPrice}
                          </span>
                        )}
                        {series.productId && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {series.productId}
                          </span>
                        )}
                      </div>
                    )}

                    <span className="text-slate-300">•</span>

                    <span className="text-slate-500 text-[11px]">
                      {series.validityType === 'LIFETIME'
                        ? 'Lifetime Access'
                        : series.validityType === 'FIXED_EXPIRY' && series.expiryAt
                        ? `Expires: ${new Date(series.expiryAt).toLocaleDateString()}`
                        : `${series.validityDays || 365} Days Validity`}
                    </span>

                    <span className="text-slate-300">•</span>

                    <span className="text-slate-700 font-semibold text-[11px] flex items-center gap-1">
                      <Folder size={12} className="text-brand-600" />
                      {series.totalFolders || 0} Folders / {series.totalTests || 0} Tests
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                {/* Manage Content Button */}
                <button
                  onClick={() => onNavigateToBuilder(series.id)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition"
                >
                  <Folder size={14} />
                  <span>Manage Content</span>
                </button>

                {/* Preview Button */}
                <button
                  onClick={() => handleOpenPreview(series)}
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-xl transition"
                  title="Preview Student Hierarchy View"
                >
                  <Eye size={15} />
                </button>

                {/* Duplicate Button */}
                <button
                  onClick={() => handleDuplicate(series)}
                  className="p-2 text-slate-600 hover:text-brand-600 hover:bg-brand-50 border border-slate-200 rounded-xl transition"
                  title="Duplicate Structure as Draft"
                >
                  <Copy size={15} />
                </button>

                {/* Edit Button */}
                <button
                  onClick={() => handleOpenEditModal(series)}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
                  title="Edit Series Details & Pricing"
                >
                  <Edit2 size={15} />
                </button>

                {/* Status Toggle Dropdown */}
                <select
                  value={series.status}
                  onChange={(e) => handleToggleStatus(series, e.target.value as any)}
                  className="px-2 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white outline-none cursor-pointer"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>

                {/* Delete Button */}
                <button
                  onClick={() => handleDelete(series)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-xl transition"
                  title="Delete Series"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isCreateEditModalOpen && (
        <TestSeriesModal
          isOpen={isCreateEditModalOpen}
          onClose={() => setIsCreateEditModalOpen(false)}
          series={editingSeries}
          exams={exams}
          onSave={handleSaveSeries}
        />
      )}

      {/* Preview Modal */}
      {previewSeries && (
        <SeriesPreviewModal
          isOpen={!!previewSeries}
          onClose={() => setPreviewSeries(null)}
          series={previewSeries}
          folders={previewFolders}
          itemsByFolder={previewItemsByFolder}
          canonicalMocks={previewCanonicalMocks}
        />
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">{confirmModal.message}</p>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const act = confirmModal.action;
                setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                await act();
              }}
              className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
