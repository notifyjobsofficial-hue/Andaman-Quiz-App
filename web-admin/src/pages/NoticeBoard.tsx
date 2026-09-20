import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  Pin,
  Bell,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { fetchNotices, saveNotice, deleteNotice } from '../firebase/firestore';
import { AppNotice } from '../types';
import { Modal } from '../components/common/Modal';

type NoticeType = 'JOB' | 'ADMIT_CARD' | 'RESULT' | 'ANSWER_KEY' | 'EXAM_DATE' | 'NOTICE';

export const NoticeBoard: React.FC = () => {
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'published' | 'draft' | 'scheduled' | 'expired'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<AppNotice | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [type, setType] = useState<NoticeType>('JOB');
  const [shortDescription, setShortDescription] = useState('');
  const [content, setContent] = useState('');
  const [organization, setOrganization] = useState('');
  const [exam, setExam] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState<'published' | 'draft' | 'scheduled'>('published');
  const [isPinned, setIsPinned] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [officialUrl, setOfficialUrl] = useState('');
  const [applyUrl, setApplyUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

  useEffect(() => {
    loadNotices();
  }, []);

  const loadNotices = async () => {
    setLoading(true);
    try {
      const list = await fetchNotices();
      setNotices(list);
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to load notices.' });
    } finally {
      setLoading(false);
    }
  };

  const toInputDateTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 16);
  };

  const handleOpenCreateModal = () => {
    setEditingNotice(null);
    setTitle('');
    setType('JOB');
    setShortDescription('');
    setContent('');
    setOrganization('');
    setExam('');
    const nowIso = new Date().toISOString().slice(0, 16);
    setPublishAt(nowIso);
    setExpiresAt('');
    setStatus('published');
    setIsPinned(false);
    setImageUrl('');
    setPdfUrl('');
    setOfficialUrl('');
    setApplyUrl('');
    setExternalUrl('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (n: AppNotice) => {
    setEditingNotice(n);
    setTitle(n.title || '');
    setType((n.type as NoticeType) || 'NOTICE');
    setShortDescription(n.shortDescription || n.body || '');
    setContent(n.content || n.body || '');
    setOrganization(n.organization || '');
    setExam(n.exam || '');
    setPublishAt(toInputDateTime(n.publishAt || n.date));
    setExpiresAt(toInputDateTime(n.expiresAt));
    setStatus(n.status || 'published');
    setIsPinned(n.isPinned || false);
    setImageUrl(n.imageUrl || '');
    setPdfUrl(n.pdfUrl || '');
    setOfficialUrl(n.officialUrl || '');
    setApplyUrl(n.applyUrl || '');
    setExternalUrl(n.externalUrl || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a notice title');
      return;
    }
    if (!publishAt) {
      alert('Please specify a publish date and time');
      return;
    }

    setIsSaving(true);
    try {
      const noticeId = editingNotice?.id || `notice_${Date.now()}`;
      const nowIso = new Date().toISOString();

      const noticePayload: AppNotice = {
        id: noticeId,
        title: title.trim(),
        body: shortDescription.trim() || content.trim() || title.trim(),
        date: publishAt.split('T')[0] || nowIso.split('T')[0],
        active: status !== 'draft',
        isPinned,
        type,
        shortDescription: shortDescription.trim() || undefined,
        content: content.trim() || undefined,
        organization: organization.trim() || undefined,
        exam: exam.trim() || undefined,
        publishAt: new Date(publishAt).toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        status,
        imageUrl: imageUrl.trim() || undefined,
        pdfUrl: pdfUrl.trim() || undefined,
        officialUrl: officialUrl.trim() || undefined,
        applyUrl: applyUrl.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        created_at: editingNotice?.created_at || nowIso,
        updated_at: nowIso,
      };

      await saveNotice(noticePayload);

      setActionFeedback({
        type: 'success',
        message: `Notice "${title}" ${editingNotice ? 'updated' : 'created'} successfully.`,
      });

      setIsModalOpen(false);
      await loadNotices();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to save notice.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, noticeTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete notice "${noticeTitle}"?`)) return;
    try {
      await deleteNotice(id);
      setActionFeedback({ type: 'success', message: 'Notice deleted successfully.' });
      await loadNotices();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to delete notice.' });
    }
  };

  const getEffectiveStatus = (n: AppNotice): 'published' | 'scheduled' | 'draft' | 'expired' => {
    if (n.status === 'draft') return 'draft';
    const now = new Date();
    const pDate = n.publishAt ? new Date(n.publishAt) : new Date(n.date);
    if (pDate > now) return 'scheduled';
    if (n.expiresAt) {
      const eDate = new Date(n.expiresAt);
      if (eDate <= now) return 'expired';
    }
    return 'published';
  };

  const getTypeBadgeColor = (t?: string) => {
    switch (t?.toUpperCase()) {
      case 'JOB':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ADMIT_CARD':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'RESULT':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'ANSWER_KEY':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'EXAM_DATE':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const filteredNotices = notices.filter((n) => {
    const effStatus = getEffectiveStatus(n);
    if (statusFilter !== 'ALL' && effStatus !== statusFilter) return false;
    if (typeFilter !== 'ALL' && (n.type || 'NOTICE') !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchDesc = n.shortDescription?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q);
      const matchOrg = n.organization?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchOrg) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            Notice Board Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Publish government job updates, admit cards, exam dates, answer keys, and results.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Create Notice
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

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search notices by title, organization or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
          >
            <option value="ALL">All Types</option>
            <option value="JOB">Jobs</option>
            <option value="ADMIT_CARD">Admit Cards</option>
            <option value="RESULT">Results</option>
            <option value="ANSWER_KEY">Answer Keys</option>
            <option value="EXAM_DATE">Exam Dates</option>
            <option value="NOTICE">General Notices</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
          >
            <option value="ALL">All Status</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="draft">Draft</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Loading notices...</div>
        ) : filteredNotices.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-700">No notices found</h3>
            <p className="text-sm mt-1 text-slate-400">
              {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                ? 'Try adjusting your search or filters.'
                : 'Get started by creating your first notice.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-xs">
                <tr>
                  <th className="py-3.5 px-4">Title & Details</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Publish Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Pinned</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredNotices.map((n) => {
                  const effStatus = getEffectiveStatus(n);
                  return (
                    <tr key={n.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 line-clamp-1">{n.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {n.organization ? `${n.organization} • ` : ''}
                          {n.shortDescription || n.body}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-md font-bold border ${getTypeBadgeColor(
                            n.type
                          )}`}
                        >
                          {n.type?.replace('_', ' ') || 'NOTICE'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        {n.publishAt
                          ? new Date(n.publishAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : n.date}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                            effStatus === 'published'
                              ? 'bg-emerald-100 text-emerald-700'
                              : effStatus === 'scheduled'
                              ? 'bg-blue-100 text-blue-700'
                              : effStatus === 'draft'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {effStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        {n.isPinned ? (
                          <span className="inline-flex items-center text-xs text-blue-600 font-semibold gap-1 bg-blue-50 px-2 py-0.5 rounded">
                            <Pin className="w-3 h-3 fill-blue-600" /> Yes
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(n)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-blue-600 rounded transition"
                          title="Edit Notice"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(n.id, n.title)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition"
                          title="Delete Notice"
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

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingNotice ? 'Edit Notice' : 'Create New Notice'}
        >
          <form onSubmit={handleSave} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Notice Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. A&N Police Constable Recruitment 2026 Notification"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Type & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Notice Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as NoticeType)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  <option value="JOB">Job Update</option>
                  <option value="ADMIT_CARD">Admit Card</option>
                  <option value="RESULT">Result</option>
                  <option value="ANSWER_KEY">Answer Key</option>
                  <option value="EXAM_DATE">Exam Date</option>
                  <option value="NOTICE">Important Notice</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {/* Organization & Exam */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Organization / Department
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. A&N Administration, Port Blair"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Exam / Tag
                </label>
                <input
                  type="text"
                  value={exam}
                  onChange={(e) => setExam(e.target.value)}
                  placeholder="e.g. CGL, CHSL, Police"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Publish & Expiry Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Publish Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Expiry Date & Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Pinned Toggle */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isPinned"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="isPinned" className="text-sm font-medium text-slate-700 cursor-pointer">
                Pin to top of Notice Board
              </label>
            </div>

            {/* Short Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Short Description
              </label>
              <textarea
                rows={2}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Brief summary visible on mobile card..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Full Content */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Full Content / Instructions
              </label>
              <textarea
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Detailed information, eligibility, steps to apply..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Action URLs */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-600 uppercase block">Action URLs (Optional)</span>
              <div>
                <label className="block text-xs text-slate-600 mb-0.5">Apply Online URL</label>
                <input
                  type="url"
                  value={applyUrl}
                  onChange={(e) => setApplyUrl(e.target.value)}
                  placeholder="https://erecruitment.andaman.gov.in"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-0.5">Official Website URL</label>
                <input
                  type="url"
                  value={officialUrl}
                  onChange={(e) => setOfficialUrl(e.target.value)}
                  placeholder="https://andaman.gov.in"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-0.5">PDF Download URL</label>
                <input
                  type="url"
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  placeholder="https://.../notification.pdf"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-0.5">Notice Image URL</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://.../notice_banner.jpg"
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Footer Submit */}
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
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : editingNotice ? 'Update Notice' : 'Create Notice'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
