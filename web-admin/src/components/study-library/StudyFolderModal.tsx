import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2, CheckCircle2, Folder } from 'lucide-react';
import { Modal } from '../common/Modal';
import { StudyFolder, Exam } from '../../types';

interface StudyFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: StudyFolder | null;
  exams: Exam[];
  onSave: (folder: StudyFolder) => Promise<void>;
}

export const StudyFolderModal: React.FC<StudyFolderModalProps> = ({
  isOpen,
  onClose,
  folder,
  exams,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [examCode, setExamCode] = useState('');
  const [description, setDescription] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [status, setStatus] = useState<'draft' | 'published'>('published');
  const [sortOrder, setSortOrder] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (folder) {
      setTitle(folder.title);
      setExamCode(folder.examCode || exams[0]?.code || 'ANCHSL');
      setDescription(folder.description || '');
      setIsFree(folder.isFree ?? true);
      setStatus(folder.status || 'published');
      setSortOrder(folder.sortOrder ?? 0);
    } else {
      setTitle('');
      setExamCode(exams[0]?.code || 'ANCHSL');
      setDescription('');
      setIsFree(true);
      setStatus('published');
      setSortOrder(0);
    }
    setError(null);
  }, [folder, exams, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Folder title is required.');
      return;
    }

    if (!examCode) {
      setError('Please select an Exam.');
      return;
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const folderId = folder ? folder.id : `sfolder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const data: StudyFolder = {
        id: folderId,
        examCode,
        title: cleanTitle,
        description: description.trim() || undefined,
        isFree,
        status,
        sortOrder: Number(sortOrder) || 0,
        itemCount: folder ? folder.itemCount : 0,
        createdAt: folder ? folder.createdAt : nowIso,
        updatedAt: nowIso,
      };

      await onSave(data);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save study folder.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={folder ? 'Edit Study Folder' : 'Create New Study Folder'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Folder Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. English Notes, General Awareness PDFs, Syllabus"
            className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Exam <span className="text-red-500">*</span>
            </label>
            <select
              value={examCode}
              onChange={(e) => setExamCode(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.code}>
                  {ex.name} ({ex.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
            >
              <option value="published">Published (Visible)</option>
              <option value="draft">Draft (Admin Only)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Curated notes, reference PDFs, and official guides for this section..."
            className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Display Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              placeholder="0"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded"
              />
              <span>Free for all students</span>
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>{folder ? 'Update Folder' : 'Create Folder'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
