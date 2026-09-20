import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  Pin,
  PinOff,
  Bell,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
  FileText,
  Briefcase,
  FileCheck,
  Award,
  Key,
  CalendarDays
} from 'lucide-react';
import { fetchNotices, saveNotice, deleteNotice } from '../../firebase/firestore';
import { AppNotice } from '../../types';
import { Modal } from '../common/Modal';

export type NoticeType = 'JOB' | 'ADMIT_CARD' | 'RESULT' | 'ANSWER_KEY' | 'EXAM_DATE' | 'NOTICE';

interface NoticeManagerProps {
  embeddedTitle?: string;
  embeddedSubtitle?: string;
}

export const NoticeManager: React.FC<NoticeManagerProps> = ({
  embeddedTitle = 'Announcements & Exam Notices',
  embeddedSubtitle = 'Official notifications, exam date updates, and syllabus alerts',
}) => {
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | NoticeType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'published' | 'draft' | 'scheduled' | 'expired'>('ALL');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<AppNotice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAllLinks, setShowAllLinks] = useState(false);

  // Form Fields
  const [type, setType] = useState<NoticeType | ''>('');
  const [title, setTitle] = useState('');
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
  const [primaryUrl, setPrimaryUrl] = useState('');
  const [applyUrl, setApplyUrl] = useState('');
  const [officialUrl, setOfficialUrl] = useState('');
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
    setFormError(null);
    setShowAllLinks(false);
    setType(''); // REQUIRED - do not default silently to NOTICE
    setTitle('');
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
    setPrimaryUrl('');
    setApplyUrl('');
    setOfficialUrl('');
    setExternalUrl('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (n: AppNotice) => {
    setEditingNotice(n);
    setFormError(null);
    setShowAllLinks(false);
    // Backward compatibility: existing notices without type treated as NOTICE in edit
    const noticeType = (n.type as NoticeType) || 'NOTICE';
    setType(noticeType);
    setTitle(n.title || '');
    setShortDescription(n.shortDescription || n.body || '');
    setContent(n.content || n.body || '');
    setOrganization(n.organization || '');
    setExam(n.exam || '');
    setPublishAt(toInputDateTime(n.publishAt || n.date));
    setExpiresAt(toInputDateTime(n.expiresAt));
    setStatus((n.status?.toLowerCase() as any) || 'published');
    setIsPinned(n.isPinned ?? (n as any).pinned ?? false);
    setImageUrl(n.imageUrl || '');
    setPdfUrl(n.pdfUrl || '');
    setPrimaryUrl((n as any).primaryUrl || n.applyUrl || '');
    setApplyUrl(n.applyUrl || '');
    setOfficialUrl(n.officialUrl || '');
    setExternalUrl(n.externalUrl || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!type) {
      setFormError('Update Type is required. Please select an update type.');
      return;
    }

    if (!title.trim()) {
      setFormError('Title is required. Please enter a headline.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const pubDate = publishAt ? new Date(publishAt) : now;
      const expDate = expiresAt ? new Date(expiresAt) : undefined;

      if (expDate && expDate <= pubDate) {
        setFormError('Expiration Date & Time must be after Publish Date & Time.');
        setIsSaving(false);
        return;
      }

      // Map primary action URL to relevant specific fields for compatibility
      let finalPrimaryUrl = primaryUrl.trim() || undefined;
      let finalApplyUrl = applyUrl.trim() || undefined;
      let finalPdfUrl = pdfUrl.trim() || undefined;

      if (type === 'JOB') {
        if (!finalApplyUrl && finalPrimaryUrl) finalApplyUrl = finalPrimaryUrl;
        if (!finalPrimaryUrl && finalApplyUrl) finalPrimaryUrl = finalApplyUrl;
      } else if (type === 'ADMIT_CARD' || type === 'RESULT' || type === 'ANSWER_KEY') {
        if (!finalPrimaryUrl && finalApplyUrl) finalPrimaryUrl = finalApplyUrl;
      }

      const noticeData: Record<string, any> = {
        id: editingNotice?.id || `notice_${Date.now()}`,
        title: title.trim(),
        type: type, // Canonical: JOB | ADMIT_CARD | RESULT | ANSWER_KEY | EXAM_DATE | NOTICE
        body: shortDescription.trim() || content.trim() || title.trim(),
        shortDescription: shortDescription.trim() || undefined,
        content: content.trim() || undefined,
        organization: organization.trim() || undefined,
        exam: exam.trim() || undefined,
        date: pubDate.toISOString().split('T')[0],
        publishAt: pubDate.toISOString(),
        expiresAt: expDate ? expDate.toISOString() : undefined,
        isPinned: !!isPinned,
        pinned: !!isPinned,
        status: status,
        active: status !== 'draft',
        imageUrl: imageUrl.trim() || undefined,
        pdfUrl: finalPdfUrl,
        primaryUrl: finalPrimaryUrl,
        applyUrl: finalApplyUrl,
        officialUrl: officialUrl.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        createdAt: editingNotice?.createdAt || (editingNotice as any)?.created_at || now.toISOString(),
        updatedAt: now.toISOString(),
      };

      await saveNotice(noticeData as AppNotice);
      setIsModalOpen(false);
      setActionFeedback({
        type: 'success',
        message: editingNotice ? `Notice "${title}" updated successfully!` : `Notice "${title}" posted successfully!`,
      });
      await loadNotices();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to save notice.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, noticeTitle: string) => {
    if (!confirm(`Are you sure you want to delete notice "${noticeTitle}"?`)) return;
    try {
      await deleteNotice(id);
      setActionFeedback({ type: 'success', message: 'Notice deleted successfully.' });
      await loadNotices();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to delete notice.' });
    }
  };

  const handleTogglePin = async (notice: AppNotice) => {
    const currentPinned = notice.isPinned ?? (notice as any).pinned ?? false;
    try {
      await saveNotice({
        ...notice,
        isPinned: !currentPinned,
        pinned: !currentPinned,
      });
      setActionFeedback({
        type: 'success',
        message: !currentPinned ? `Pinned "${notice.title}" to top.` : `Unpinned "${notice.title}".`,
      });
      await loadNotices();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: 'Failed to update pin state.' });
    }
  };

  const handleTogglePublish = async (notice: AppNotice) => {
    const currentStatus = (notice.status || 'published').toLowerCase();
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    try {
      await saveNotice({
        ...notice,
        status: newStatus as any,
        active: newStatus === 'published',
      });
      setActionFeedback({
        type: 'success',
        message: newStatus === 'published' ? `Published "${notice.title}".` : `Unpublished "${notice.title}" (saved as draft).`,
      });
      await loadNotices();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: 'Failed to toggle publication status.' });
    }
  };

  // Type Badges Styling
  const getTypeBadge = (rawType?: string) => {
    const t = (rawType || 'NOTICE').toUpperCase().replace(/ /g, '_');
    switch (t) {
      case 'JOB':
        return {
          label: 'JOB',
          className: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Briefcase,
        };
      case 'ADMIT_CARD':
        return {
          label: 'ADMIT CARD',
          className: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: FileCheck,
        };
      case 'RESULT':
        return {
          label: 'RESULT',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: Award,
        };
      case 'ANSWER_KEY':
        return {
          label: 'ANSWER KEY',
          className: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: Key,
        };
      case 'EXAM_DATE':
        return {
          label: 'EXAM DATE',
          className: 'bg-orange-100 text-orange-800 border-orange-200',
          icon: CalendarDays,
        };
      case 'NOTICE':
      default:
        return {
          label: 'NOTICE',
          className: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: FileText,
        };
    }
  };

  const getNoticeEffectiveStatus = (n: AppNotice): 'published' | 'scheduled' | 'expired' | 'draft' => {
    const s = (n.status || 'published').toLowerCase();
    if (s === 'draft') return 'draft';
    const now = new Date();
    const pub = n.publishAt ? new Date(n.publishAt) : (n.date ? new Date(n.date) : null);
    const exp = n.expiresAt ? new Date(n.expiresAt) : null;

    if (exp && now > exp) return 'expired';
    if (pub && now < pub) return 'scheduled';
    return 'published';
  };

  // Filter notices
  const filteredNotices = notices.filter((n) => {
    // 1. Category Filter
    if (categoryFilter !== 'ALL') {
      const noticeType = (n.type || 'NOTICE').toUpperCase().replace(/ /g, '_');
      if (noticeType !== categoryFilter) return false;
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      const effective = getNoticeEffectiveStatus(n);
      if (effective !== statusFilter) return false;
    }

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (n.title || '').toLowerCase().includes(q);
      const matchDesc = (n.shortDescription || n.body || '').toLowerCase().includes(q);
      const matchOrg = (n.organization || '').toLowerCase().includes(q);
      const matchExam = (n.exam || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchOrg && !matchExam) return false;
    }

    return true;
  });

  const filterTabs: { id: 'ALL' | NoticeType; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'JOB', label: 'Jobs' },
    { id: 'ADMIT_CARD', label: 'Admit Cards' },
    { id: 'RESULT', label: 'Results' },
    { id: 'ANSWER_KEY', label: 'Answer Keys' },
    { id: 'EXAM_DATE', label: 'Exam Dates' },
    { id: 'NOTICE', label: 'Notices' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Bell size={16} className="text-brand-600" /> {embeddedTitle}
          </h2>
          <p className="text-xs text-slate-500">{embeddedSubtitle}</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs self-start md:self-auto"
        >
          <Plus size={15} /> Post Notice
        </button>
      </div>

      {/* Action Feedback Notification */}
      {actionFeedback && (
        <div
          className={`mx-5 my-3 p-3 rounded-xl flex items-center justify-between text-xs font-semibold ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{actionFeedback.message}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-slate-600 text-sm">
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="p-4 border-b border-slate-100 bg-white space-y-3">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {filterTabs.map((tab) => {
            const isActive = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition shrink-0 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Status Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search by title, org, or exam..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium text-slate-700"
            >
              <option value="ALL">All Status</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notices List */}
      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading notices...</div>
        ) : filteredNotices.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No notices match the selected criteria.
          </div>
        ) : (
          filteredNotices.map((n) => {
            const badge = getTypeBadge(n.type);
            const BadgeIcon = badge.icon;
            const effectiveStatus = getNoticeEffectiveStatus(n);
            const isItemPinned = n.isPinned ?? (n as any).pinned ?? false;

            return (
              <div
                key={n.id}
                className="p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/75 transition"
              >
                {/* Left: Metadata & Titles */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category Type Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wide ${badge.className}`}
                    >
                      <BadgeIcon size={11} />
                      {badge.label}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        effectiveStatus === 'published'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : effectiveStatus === 'scheduled'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : effectiveStatus === 'draft'
                          ? 'bg-slate-100 text-slate-600 border border-slate-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {effectiveStatus.toUpperCase()}
                    </span>

                    {/* Pinned Indicator */}
                    {isItemPinned && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                        <Pin size={10} className="fill-amber-600 text-amber-600" /> Pinned
                      </span>
                    )}

                    {/* Date */}
                    <span className="text-[11px] text-slate-400 font-medium">
                      {n.publishAt
                        ? new Date(n.publishAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : n.date}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xs font-bold text-slate-900 leading-snug">
                    {n.title}
                  </h3>

                  {/* Organization & Exam Tag */}
                  {(n.organization || n.exam) && (
                    <div className="text-[11px] font-semibold text-brand-600 flex items-center gap-1.5">
                      {n.organization && <span>{n.organization}</span>}
                      {n.organization && n.exam && <span>•</span>}
                      {n.exam && <span>{n.exam}</span>}
                    </div>
                  )}

                  {/* Short Description */}
                  {(n.shortDescription || n.body) && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {n.shortDescription || n.body}
                    </p>
                  )}

                  {/* Available Links Snippet */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-slate-400">
                    {(n as any).primaryUrl && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                        <ExternalLink size={10} /> Action Link
                      </span>
                    )}
                    {n.applyUrl && (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                        <ExternalLink size={10} /> Apply Online
                      </span>
                    )}
                    {n.pdfUrl && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        <FileText size={10} /> PDF Notification
                      </span>
                    )}
                    {n.officialUrl && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        <Globe size={10} /> Official Website
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                  {/* Pin / Unpin Button */}
                  <button
                    onClick={() => handleTogglePin(n)}
                    title={isItemPinned ? 'Unpin from top' : 'Pin to top'}
                    className={`p-2 rounded-lg text-xs font-semibold transition ${
                      isItemPinned
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isItemPinned ? <PinOff size={15} /> : <Pin size={15} />}
                  </button>

                  {/* Publish / Unpublish Button */}
                  <button
                    onClick={() => handleTogglePublish(n)}
                    title={effectiveStatus === 'published' ? 'Unpublish (set to draft)' : 'Publish immediately'}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  >
                    {effectiveStatus === 'published' ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>

                  {/* Edit Button */}
                  <button
                    onClick={() => handleOpenEditModal(n)}
                    title="Edit Notice"
                    className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                  >
                    <Edit2 size={15} />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDelete(n.id, n.title)}
                    title="Delete Notice"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Post / Edit Notice Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingNotice ? 'Edit Notice' : 'Post Notice'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {/* Form Error Banner */}
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* 1. Update Type * (REQUIRED SELECT) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Update Type <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={type}
                onChange={(e: any) => setType(e.target.value as NoticeType)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:border-brand-500 font-semibold text-slate-800"
              >
                <option value="" disabled>
                  Select update type
                </option>
                <option value="JOB">Job</option>
                <option value="ADMIT_CARD">Admit Card</option>
                <option value="RESULT">Result</option>
                <option value="ANSWER_KEY">Answer Key</option>
                <option value="EXAM_DATE">Exam Date</option>
                <option value="NOTICE">Important Notice</option>
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Specifies the category badge, Android filter tab, and dynamic action buttons.
              </p>
            </div>

            {/* 2. Notice Title * */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Notice Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. A&N CHSL 2026 Admit Card Out"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-brand-500 font-semibold"
              />
            </div>

            {/* 3. Short Description */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Short Description <span className="text-slate-400 font-normal">(displayed on card)</span>
              </label>
              <input
                type="text"
                placeholder="Brief summary for notice card..."
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-brand-500"
              />
            </div>

            {/* 4. Full Content / Details */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Full Content / Details <span className="text-slate-400 font-normal">(shown in details bottom sheet)</span>
              </label>
              <textarea
                rows={4}
                placeholder="Complete notification body, eligibility details, instructions..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-brand-500"
              />
            </div>

            {/* 5. Organization & Exam */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Organization <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. A&N Administration / Forest Dept"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Exam Name <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Combined Higher Secondary Level (CHSL)"
                  value={exam}
                  onChange={(e) => setExam(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* 6. Scheduling: Publish Date/Time & Expiry Date/Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Publish Date & Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Expiry Date & Time <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* 7. Status & Pinned */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Publication Status</label>
                <select
                  value={status}
                  onChange={(e: any) => setStatus(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white outline-none"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft (Hidden from students)</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-3 sm:pt-0">
                <input
                  type="checkbox"
                  id="noticePinnedToggle"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                />
                <label htmlFor="noticePinnedToggle" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Pin / Mark as Important
                </label>
              </div>
            </div>

            {/* 8. Links Section (Conditional UI based on selected Update Type) */}
            <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ExternalLink size={14} className="text-brand-600" />
                  Relevant Action Links <span className="text-slate-400 font-normal">(All optional)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAllLinks(!showAllLinks)}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 underline"
                >
                  {showAllLinks ? 'Show recommended links only' : '+ Show all link fields'}
                </button>
              </div>

              {/* Conditional Link Fields Based on Type */}
              {type === 'JOB' && !showAllLinks && (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Notification PDF URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in/job-notification.pdf"
                      value={pdfUrl}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Apply Online URL</label>
                    <input
                      type="url"
                      placeholder="https://erecruitment.andaman.gov.in"
                      value={applyUrl}
                      onChange={(e) => setApplyUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Website URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in"
                      value={officialUrl}
                      onChange={(e) => setOfficialUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              {type === 'ADMIT_CARD' && !showAllLinks && (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Admit Card Download URL</label>
                    <input
                      type="url"
                      placeholder="https://erecruitment.andaman.gov.in/admit-card"
                      value={primaryUrl}
                      onChange={(e) => {
                        setPrimaryUrl(e.target.value);
                        setApplyUrl(e.target.value);
                      }}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Website URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in"
                      value={officialUrl}
                      onChange={(e) => setOfficialUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              {type === 'RESULT' && !showAllLinks && (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Result / Scorecard URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in/results/cgl-2026.pdf"
                      value={primaryUrl}
                      onChange={(e) => setPrimaryUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Website URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in"
                      value={officialUrl}
                      onChange={(e) => setOfficialUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              {type === 'ANSWER_KEY' && !showAllLinks && (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Answer Key URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in/answer-keys/chsl.pdf"
                      value={primaryUrl}
                      onChange={(e) => setPrimaryUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Website URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in"
                      value={officialUrl}
                      onChange={(e) => setOfficialUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              {type === 'EXAM_DATE' && !showAllLinks && (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Notice / PDF URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in/exam-calendar.pdf"
                      value={pdfUrl}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Website URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in"
                      value={officialUrl}
                      onChange={(e) => setOfficialUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              {(type === 'NOTICE' || !type) && !showAllLinks && (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Notification / PDF URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in/circular.pdf"
                      value={pdfUrl}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">External / Official URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Expanded All-Links View */}
              {showAllLinks && (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Primary Action URL (Admit Card / Result / Key)</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={primaryUrl}
                      onChange={(e) => setPrimaryUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Notification / PDF URL</label>
                    <input
                      type="url"
                      placeholder="https://.../notice.pdf"
                      value={pdfUrl}
                      onChange={(e) => setPdfUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Apply Online URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={applyUrl}
                      onChange={(e) => setApplyUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Official Website URL</label>
                    <input
                      type="url"
                      placeholder="https://andaman.gov.in"
                      value={officialUrl}
                      onChange={(e) => setOfficialUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Other External URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 transition shadow-xs"
              >
                {isSaving ? 'Saving...' : editingNotice ? 'Update Notice' : 'Publish Notice'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
