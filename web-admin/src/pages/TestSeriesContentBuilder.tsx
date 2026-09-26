import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Folder,
  FileCheck,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  ExternalLink,
  Eye,
  AlertTriangle,
  Lock,
  Loader2,
  CheckCircle2,
  MoveRight,
  MoreVertical,
  HelpCircle,
  Clock,
  Award,
  Sparkles
} from 'lucide-react';
import {
  TestSeries,
  TestSeriesFolder,
  TestSeriesItem,
  MockTest,
  Exam,
  SeriesItemAccessMode
} from '../types';
import {
  fetchTestSeriesById,
  saveTestSeries,
  fetchTestSeriesFolders,
  saveTestSeriesFolder,
  deleteTestSeriesFolder,
  reorderTestSeriesFolders,
  fetchTestSeriesItems,
  saveTestSeriesItem,
  deleteTestSeriesItem,
  reorderTestSeriesItems,
  moveTestSeriesItem,
  fetchMockTests,
  fetchExams,
  updateSeriesStats
} from '../firebase/firestore';
import { TestSeriesModal } from '../components/test-series/TestSeriesModal';
import { TestPickerModal } from '../components/test-series/TestPickerModal';
import { SeriesPreviewModal } from '../components/test-series/SeriesPreviewModal';
import { Modal } from '../components/common/Modal';

interface TestSeriesContentBuilderProps {
  seriesId: string;
  onBack: () => void;
  onNavigateToMockBuilder?: (testId: string) => void;
}

export const TestSeriesContentBuilder: React.FC<TestSeriesContentBuilderProps> = ({
  seriesId,
  onBack,
  onNavigateToMockBuilder,
}) => {
  const [series, setSeries] = useState<TestSeries | null>(null);
  const [folders, setFolders] = useState<TestSeriesFolder[]>([]);
  const [itemsByFolder, setItemsByFolder] = useState<Record<string, TestSeriesItem[]>>({});
  const [canonicalMocks, setCanonicalMocks] = useState<Record<string, MockTest>>({});
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  // Accordion state
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Modals state
  const [isEditSeriesModalOpen, setIsEditSeriesModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [pickerFolder, setPickerFolder] = useState<TestSeriesFolder | null>(null);

  // Folder Create/Edit Modal
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TestSeriesFolder | null>(null);
  const [folderTitle, setFolderTitle] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [folderStatus, setFolderStatus] = useState<'draft' | 'published'>('published');
  const [savingFolder, setSavingFolder] = useState(false);

  // Confirmation Modal
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

  // Action status/notifications
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Bulk selection inside folders
  const [selectedItemsByFolder, setSelectedItemsByFolder] = useState<Record<string, Set<string>>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [seriesDoc, foldersList, mocksList, examsList] = await Promise.all([
        fetchTestSeriesById(seriesId),
        fetchTestSeriesFolders(seriesId),
        fetchMockTests(),
        fetchExams(),
      ]);

      setSeries(seriesDoc);
      setFolders(foldersList);
      setExams(examsList);

      const mockMap: Record<string, MockTest> = {};
      mocksList.forEach((m) => {
        mockMap[m.id] = m;
      });
      setCanonicalMocks(mockMap);

      // Fetch items for each folder in parallel
      const itemsMap: Record<string, TestSeriesItem[]> = {};
      await Promise.all(
        foldersList.map(async (f) => {
          const items = await fetchTestSeriesItems(seriesId, f.id);
          itemsMap[f.id] = items;
        })
      );
      setItemsByFolder(itemsMap);
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to load test series content.' });
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // --- Folder Actions ---
  const handleOpenFolderModal = (folder?: TestSeriesFolder) => {
    if (folder) {
      setEditingFolder(folder);
      setFolderTitle(folder.title);
      setFolderDescription(folder.description || '');
      setFolderStatus(folder.status || 'published');
    } else {
      setEditingFolder(null);
      setFolderTitle('');
      setFolderDescription('');
      setFolderStatus('published');
    }
    setIsFolderModalOpen(true);
  };

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderTitle.trim()) return;

    setSavingFolder(true);
    try {
      const nowIso = new Date().toISOString();
      const folderId = editingFolder
        ? editingFolder.id
        : `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const folderData: TestSeriesFolder = {
        id: folderId,
        seriesId,
        title: folderTitle.trim(),
        description: folderDescription.trim() || undefined,
        sortOrder: editingFolder ? editingFolder.sortOrder : folders.length,
        status: folderStatus,
        itemCount: editingFolder ? editingFolder.itemCount : 0,
        createdAt: editingFolder ? editingFolder.createdAt : nowIso,
        updatedAt: nowIso,
      };

      await saveTestSeriesFolder(folderData);
      setIsFolderModalOpen(false);
      setActionFeedback({
        type: 'success',
        message: `Folder "${folderData.title}" ${editingFolder ? 'updated' : 'created'} successfully.`,
      });
      await loadAll();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to save folder.' });
    } finally {
      setSavingFolder(false);
    }
  };

  const handleDeleteFolder = (folder: TestSeriesFolder) => {
    const itemCount = (itemsByFolder[folder.id] || []).length;
    setConfirmModal({
      isOpen: true,
      title: `Delete Folder "${folder.title}"?`,
      message: `Are you sure you want to delete this folder? It contains ${itemCount} linked test(s). All linked items will be unlinked from the series. (Canonical mock tests will NOT be deleted).`,
      action: async () => {
        try {
          await deleteTestSeriesFolder(seriesId, folder.id);
          setActionFeedback({ type: 'success', message: `Folder "${folder.title}" deleted.` });
          await loadAll();
        } catch (err: any) {
          console.error(err);
          setActionFeedback({ type: 'error', message: err.message || 'Failed to delete folder.' });
        }
      },
    });
  };

  const handleMoveFolderOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= folders.length) return;

    const newFolders = [...folders];
    const temp = newFolders[index];
    newFolders[index] = newFolders[targetIndex];
    newFolders[targetIndex] = temp;

    setFolders(newFolders);
    try {
      await reorderTestSeriesFolders(
        seriesId,
        newFolders.map((f) => f.id)
      );
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: 'Failed to persist folder reordering.' });
      await loadAll();
    }
  };

  // --- Item Actions ---
  const handleAddTestsToFolder = async (
    selectedTestIds: string[],
    accessMode: SeriesItemAccessMode,
    unlockAt?: string
  ) => {
    if (!pickerFolder) return;
    const nowIso = new Date().toISOString();
    const currentItems = itemsByFolder[pickerFolder.id] || [];

    for (let i = 0; i < selectedTestIds.length; i++) {
      const testId = selectedTestIds[i];
      const itemId = `item_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      const item: TestSeriesItem = {
        id: itemId,
        seriesId,
        folderId: pickerFolder.id,
        testId,
        sortOrder: currentItems.length + i,
        accessMode,
        unlockAt,
        status: 'published',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await saveTestSeriesItem(item);
    }

    setActionFeedback({
      type: 'success',
      message: `Added ${selectedTestIds.length} test(s) to folder "${pickerFolder.title}".`,
    });
    await loadAll();
  };

  const handleUnlinkItem = (folderId: string, item: TestSeriesItem) => {
    const mock = canonicalMocks[item.testId];
    setConfirmModal({
      isOpen: true,
      title: `Unlink Test "${mock?.title || item.testId}"?`,
      message: `Remove this test from this folder? This ONLY unlinks it from the Test Series. The canonical Mock Test and questions remain 100% safe.`,
      action: async () => {
        try {
          await deleteTestSeriesItem(seriesId, folderId, item.id);
          setActionFeedback({ type: 'success', message: 'Test unlinked from folder.' });
          await loadAll();
        } catch (err: any) {
          console.error(err);
          setActionFeedback({ type: 'error', message: err.message || 'Failed to unlink test.' });
        }
      },
    });
  };

  const handleMoveItemOrder = async (
    folderId: string,
    index: number,
    direction: 'up' | 'down'
  ) => {
    const items = itemsByFolder[folderId] || [];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    setItemsByFolder((prev) => ({ ...prev, [folderId]: newItems }));
    try {
      await reorderTestSeriesItems(
        seriesId,
        folderId,
        newItems.map((it) => it.id)
      );
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: 'Failed to reorder items.' });
      await loadAll();
    }
  };

  const handleMoveItemToAnotherFolder = async (
    sourceFolderId: string,
    targetFolderId: string,
    itemId: string
  ) => {
    try {
      await moveTestSeriesItem(seriesId, sourceFolderId, targetFolderId, itemId);
      setActionFeedback({ type: 'success', message: 'Test moved to target folder.' });
      await loadAll();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to move test.' });
    }
  };

  const handleUpdateItem = async (folderId: string, item: TestSeriesItem, updates: Partial<TestSeriesItem>) => {
    const updated: TestSeriesItem = {
      ...item,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveTestSeriesItem(updated);
      await loadAll();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to update item.' });
    }
  };

  // --- Publication Chain Warning Calculation ---
  const draftCanonicalWarnings: { folderName: string; testTitle: string; testId: string }[] = [];
  folders.forEach((folder) => {
    const items = itemsByFolder[folder.id] || [];
    items.forEach((item) => {
      const mock = canonicalMocks[item.testId];
      if (item.status === 'published' && (!mock || mock.status === 'draft')) {
        draftCanonicalWarnings.push({
          folderName: folder.title,
          testTitle: mock ? mock.title : `Missing Test (${item.testId})`,
          testId: item.testId,
        });
      }
    });
  });

  if (loading || !series) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="animate-spin text-brand-500" size={32} />
        <span className="text-xs font-semibold">Loading Test Series Builder...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Back to Test Series List"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-brand-100 text-brand-800">
                {series.examCode}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                series.status === 'published'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {series.status.toUpperCase()}
              </span>
              {series.isFree ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  FREE
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  PAID: ₹{series.price}
                </span>
              )}
            </div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
              {series.title}
            </h1>
            {series.subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{series.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsEditSeriesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <Edit2 size={13} />
            <span>Edit Details</span>
          </button>

          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition"
          >
            <Eye size={13} />
            <span>Preview View</span>
          </button>

          <button
            onClick={() => handleOpenFolderModal()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition"
          >
            <Plus size={14} />
            <span>+ Add Folder</span>
          </button>
        </div>
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

      {/* Publication Chain Warning Banner */}
      {draftCanonicalWarnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-800 text-sm">
            <AlertTriangle size={18} className="text-amber-600" />
            <span>
              Publication Chain Warning: {draftCanonicalWarnings.length} Linked Mock Test{draftCanonicalWarnings.length !== 1 ? 's' : ''} in Draft Mode
            </span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            The following items are marked as <strong>Published</strong> in this series, but their canonical Mock Tests are in <strong>Draft</strong> mode in the Mock Tests repository. Draft tests will NOT appear or be accessible to students on the app:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {draftCanonicalWarnings.map((w, idx) => (
              <div
                key={idx}
                className="bg-white/90 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-800 block truncate">{w.testTitle}</span>
                  <span className="text-[11px] text-slate-500">Folder: {w.folderName}</span>
                </div>
                {onNavigateToMockBuilder && (
                  <button
                    onClick={() => onNavigateToMockBuilder(w.testId)}
                    className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-800 underline"
                  >
                    Open Builder <ExternalLink size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Folder Accordion List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
          <div className="flex items-center gap-2">
            <span>CURRICULUM FOLDERS</span>
            <span className="text-slate-400 font-semibold">({folders.length} Folders)</span>
          </div>
          <span className="text-slate-500 text-[11px] font-medium">
            Total Linked Tests: {series.totalTests || 0}
          </span>
        </div>

        {folders.length === 0 ? (
          <div className="py-16 text-center bg-white border border-dashed border-slate-300 rounded-2xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
              <Folder size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">No Curriculum Folders Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Organize tests into sections such as "Full Length Mocks", "Previous Year Papers", or "Subject Tests".
              </p>
            </div>
            <button
              onClick={() => handleOpenFolderModal()}
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Create First Folder</span>
            </button>
          </div>
        ) : (
          folders.map((folder, folderIdx) => {
            const isCollapsed = collapsedFolders[folder.id];
            const items = itemsByFolder[folder.id] || [];
            const selectedItemIds = selectedItemsByFolder[folder.id] || new Set();

            return (
              <div
                key={folder.id}
                className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
              >
                {/* Folder Header Bar */}
                <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleFolderCollapse(folder.id)}
                      className="p-1 text-slate-400 hover:text-slate-700 transition"
                    >
                      {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </button>

                    <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                      <Folder size={16} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-800">
                          {folderIdx + 1}. {folder.title}
                        </h3>
                        <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                          folder.status === 'published'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {folder.status.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-white border border-slate-200 text-slate-600">
                          {items.length} Test{items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {folder.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{folder.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    {/* Reorder Buttons */}
                    <button
                      onClick={() => handleMoveFolderOrder(folderIdx, 'up')}
                      disabled={folderIdx === 0}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-30 transition"
                      title="Move Folder Up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => handleMoveFolderOrder(folderIdx, 'down')}
                      disabled={folderIdx === folders.length - 1}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-30 transition"
                      title="Move Folder Down"
                    >
                      <ArrowDown size={14} />
                    </button>

                    <div className="w-px h-4 bg-slate-300 mx-1" />

                    {/* Edit Folder */}
                    <button
                      onClick={() => handleOpenFolderModal(folder)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition"
                      title="Edit Folder Name / Description"
                    >
                      <Edit2 size={14} />
                    </button>

                    {/* Delete Folder */}
                    <button
                      onClick={() => handleDeleteFolder(folder)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                      title="Delete Folder"
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="w-px h-4 bg-slate-300 mx-1" />

                    {/* Add Tests Button */}
                    <button
                      onClick={() => setPickerFolder(folder)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl transition"
                    >
                      <Plus size={13} />
                      <span>Add Existing Tests</span>
                    </button>
                  </div>
                </div>

                {/* Items Inside Folder */}
                {!isCollapsed && (
                  <div>
                    {items.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs italic bg-white space-y-2">
                        <span>This folder currently has no linked tests.</span>
                        <div>
                          <button
                            onClick={() => setPickerFolder(folder)}
                            className="px-3 py-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 underline"
                          >
                            + Select canonical mock tests to add
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {items.map((item, itemIdx) => {
                          const mock = canonicalMocks[item.testId];
                          const isMockDraft = !mock || mock.status === 'draft';

                          return (
                            <div
                              key={item.id}
                              className="p-3.5 pl-6 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs hover:bg-slate-50/50 transition"
                            >
                              {/* Left Info */}
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="text-slate-400 font-mono text-[11px] w-5 text-center shrink-0">
                                  {itemIdx + 1}
                                </div>
                                <FileCheck size={16} className="text-brand-600 shrink-0" />

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-bold text-slate-800 text-xs truncate">
                                      {mock ? mock.title : `Canonical Test ID: ${item.testId}`}
                                    </span>

                                    {/* Mock Draft Warning */}
                                    {isMockDraft && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                        <AlertTriangle size={10} /> Linked Mock is Draft
                                      </span>
                                    )}
                                  </div>

                                  {mock && (
                                    <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                                      <span className="flex items-center gap-1">
                                        <HelpCircle size={11} /> {mock.totalQuestions || 0} Questions
                                      </span>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <Clock size={11} /> {mock.durationMinutes || 0} Mins
                                      </span>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <Award size={11} /> {mock.totalMarks || 0} Marks
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Right Controls */}
                              <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end md:self-auto">
                                {/* Access Mode Dropdown */}
                                <select
                                  value={item.accessMode}
                                  onChange={(e) =>
                                    handleUpdateItem(folder.id, item, {
                                      accessMode: e.target.value as SeriesItemAccessMode,
                                    })
                                  }
                                  className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-300 bg-white outline-none"
                                >
                                  <option value="INCLUDED">INCLUDED (Series Unlock)</option>
                                  <option value="FREE_PREVIEW">FREE PREVIEW (All Users)</option>
                                  <option value="LOCKED_UNTIL_DATE">LOCKED UNTIL DATE</option>
                                </select>

                                {/* Item Status Dropdown */}
                                <select
                                  value={item.status}
                                  onChange={(e) =>
                                    handleUpdateItem(folder.id, item, {
                                      status: e.target.value as 'draft' | 'published',
                                    })
                                  }
                                  className={`px-2 py-1 text-[11px] font-bold rounded-lg border outline-none ${
                                    item.status === 'published'
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                      : 'border-slate-300 bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  <option value="published">Item: Published</option>
                                  <option value="draft">Item: Draft</option>
                                </select>

                                {/* Move to Folder */}
                                {folders.length > 1 && (
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                    <MoveRight size={12} />
                                    <select
                                      defaultValue=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleMoveItemToAnotherFolder(folder.id, e.target.value, item.id);
                                        }
                                      }}
                                      className="px-1.5 py-1 text-[11px] font-medium rounded-lg border border-slate-200 bg-white"
                                    >
                                      <option value="" disabled>
                                        Move to folder...
                                      </option>
                                      {folders
                                        .filter((f) => f.id !== folder.id)
                                        .map((f) => (
                                          <option key={f.id} value={f.id}>
                                            {f.title}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                )}

                                {/* Move Up / Down */}
                                <div className="flex items-center gap-0.5">
                                  <button
                                    onClick={() => handleMoveItemOrder(folder.id, itemIdx, 'up')}
                                    disabled={itemIdx === 0}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                    title="Move Item Up"
                                  >
                                    <ArrowUp size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleMoveItemOrder(folder.id, itemIdx, 'down')}
                                    disabled={itemIdx === items.length - 1}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                    title="Move Item Down"
                                  >
                                    <ArrowDown size={13} />
                                  </button>
                                </div>

                                {/* Open in Test Question Builder */}
                                {onNavigateToMockBuilder && (
                                  <button
                                    onClick={() => onNavigateToMockBuilder(item.testId)}
                                    className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100 transition"
                                    title="Edit in Question Builder"
                                  >
                                    <ExternalLink size={13} />
                                  </button>
                                )}

                                {/* Unlink Test from Folder */}
                                <button
                                  onClick={() => handleUnlinkItem(folder.id, item)}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                                  title="Unlink test from this folder (Canonical mock is kept safe)"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Folder Create/Edit Modal */}
      <Modal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        title={editingFolder ? 'Edit Folder' : 'Create New Folder'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveFolder} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Folder Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={folderTitle}
              onChange={(e) => setFolderTitle(e.target.value)}
              placeholder="e.g. Full Length Mock Tests (2026)"
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={folderDescription}
              onChange={(e) => setFolderDescription(e.target.value)}
              placeholder="Full length 100-mark tests according to the latest scheme..."
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Status
            </label>
            <select
              value={folderStatus}
              onChange={(e) => setFolderStatus(e.target.value as any)}
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
            >
              <option value="published">Published (Visible to students)</option>
              <option value="draft">Draft (Admin only)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsFolderModalOpen(false)}
              disabled={savingFolder}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingFolder}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {savingFolder ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>{editingFolder ? 'Update Folder' : 'Create Folder'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Test Picker Modal */}
      {pickerFolder && (
        <TestPickerModal
          isOpen={!!pickerFolder}
          onClose={() => setPickerFolder(null)}
          seriesExamCode={series.examCode}
          folderTitle={pickerFolder.title}
          existingTestIdsInFolder={(itemsByFolder[pickerFolder.id] || []).map((it) => it.testId)}
          onAddTests={handleAddTestsToFolder}
        />
      )}

      {/* Edit Test Series Modal */}
      {isEditSeriesModalOpen && (
        <TestSeriesModal
          isOpen={isEditSeriesModalOpen}
          onClose={() => setIsEditSeriesModalOpen(false)}
          series={series}
          exams={exams}
          onSave={async (updatedSeries) => {
            await saveTestSeries(updatedSeries);
            setActionFeedback({ type: 'success', message: 'Test Series updated successfully.' });
            await loadAll();
          }}
        />
      )}

      {/* Student View / Hierarchy Preview Modal */}
      {isPreviewModalOpen && (
        <SeriesPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          series={series}
          folders={folders}
          itemsByFolder={itemsByFolder}
          canonicalMocks={canonicalMocks}
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
