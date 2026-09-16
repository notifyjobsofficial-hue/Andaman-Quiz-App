import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Image as ImageIcon, Bell, Settings2, Save } from 'lucide-react';
import {
  fetchBanners,
  saveBanner,
  deleteBanner,
  fetchNotices,
  saveNotice,
  deleteNotice,
  fetchAppConfig,
  saveAppConfig
} from '../firebase/firestore';
import { HomeBanner, AppNotice, AppConfig } from '../types';
import { ImageUploader } from '../components/common/ImageUploader';
import { Modal } from '../components/common/Modal';

export const AppContent: React.FC = () => {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    id: 'main',
    maintenanceMode: false,
    maintenanceMessage: 'Andaman Quiz is currently undergoing scheduled maintenance. Please check back shortly.',
    supportEmail: 'support@andamanquiz.com',
    whatsappUrl: 'https://wa.me/919999999999',
    telegramUrl: 'https://t.me/andamanquiz',
    officialWebsiteUrl: 'https://andamanquiz.com',
  });

  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // Banner Modal
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [bannerRoute, setBannerRoute] = useState('/tests');

  // Notice Modal
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [b, n, c] = await Promise.all([
        fetchBanners(),
        fetchNotices(),
        fetchAppConfig()
      ]);
      setBanners(b);
      setNotices(n);
      if (c) setConfig(c);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerTitle || !bannerImage) return;

    const newBanner: HomeBanner = {
      id: `banner_${Date.now()}`,
      title: bannerTitle.trim(),
      imageUrl: bannerImage.trim(),
      targetRoute: bannerRoute.trim(),
      active: true,
      order: banners.length + 1,
    };

    await saveBanner(newBanner);
    setIsBannerModalOpen(false);
    setBannerTitle('');
    setBannerImage('');
    loadData();
  };

  const handleDeleteBanner = async (id: string) => {
    if (confirm('Delete this banner?')) {
      await deleteBanner(id);
      loadData();
    }
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle || !noticeBody) return;

    const newNotice: AppNotice = {
      id: `notice_${Date.now()}`,
      title: noticeTitle.trim(),
      body: noticeBody.trim(),
      date: new Date().toISOString().split('T')[0],
      active: true,
      isPinned: false,
    };

    await saveNotice(newNotice);
    setIsNoticeModalOpen(false);
    setNoticeTitle('');
    setNoticeBody('');
    loadData();
  };

  const handleDeleteNotice = async (id: string) => {
    if (confirm('Delete this notice?')) {
      await deleteNotice(id);
      loadData();
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await saveAppConfig(config);
      alert('Application configuration saved to Cloud Firestore!');
    } catch (err: any) {
      alert('Error saving config: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">App Content & Announcements</h1>
        <p className="text-xs text-slate-500 mt-1">
          Remotely control promotional banners, exam notices, and support channels displayed in the Android student app.
        </p>
      </div>

      {/* 1. Home Banners Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Home Screen Promotional Banners</h2>
            <p className="text-xs text-slate-500">Carousel banners shown on the student home feed</p>
          </div>
          <button
            onClick={() => setIsBannerModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus size={14} /> Add Banner
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {banners.map((b) => (
            <div key={b.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <img src={b.imageUrl} alt={b.title} className="w-full h-36 object-cover bg-slate-100" />
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">{b.title}</div>
                  <div className="text-[10px] text-slate-400">Route: {b.targetRoute}</div>
                </div>
                <button
                  onClick={() => handleDeleteBanner(b.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {banners.length === 0 && (
            <div className="col-span-3 p-8 text-center text-xs text-slate-400">
              No custom banners added yet. Click "Add Banner" to upload one.
            </div>
          )}
        </div>
      </div>

      {/* 2. Announcements / Notices Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Announcements & Notices</h2>
            <p className="text-xs text-slate-500">Official notifications, exam date updates, and results alerts</p>
          </div>
          <button
            onClick={() => setIsNoticeModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
          >
            <Plus size={14} /> Post Notice
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {notices.map((n) => (
            <div key={n.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{n.title}</span>
                  <span className="text-[10px] text-slate-400">{n.date}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{n.body}</p>
              </div>
              <button
                onClick={() => handleDeleteNotice(n.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {notices.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No active announcements posted.
            </div>
          )}
        </div>
      </div>

      {/* 3. Application Remote Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Settings2 size={16} className="text-brand-600" /> Remote App Configuration
            </h2>
            <p className="text-xs text-slate-500">Emergency maintenance switch and support links</p>
          </div>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <label className="flex items-center gap-3 p-3 bg-amber-50/60 border border-amber-200 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={config.maintenanceMode}
              onChange={(e) => setConfig({ ...config, maintenanceMode: e.target.checked })}
              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
            />
            <div>
              <span className="text-xs font-bold text-amber-900">Maintenance Mode</span>
              <p className="text-[11px] text-amber-700">Display maintenance screen on Android student app during major updates</p>
            </div>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Support Email</label>
              <input
                type="email"
                value={config.supportEmail}
                onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Support URL</label>
              <input
                type="url"
                value={config.whatsappUrl || ''}
                onChange={(e) => setConfig({ ...config, whatsappUrl: e.target.value })}
                placeholder="https://wa.me/..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Telegram Community URL</label>
              <input
                type="url"
                value={config.telegramUrl || ''}
                onChange={(e) => setConfig({ ...config, telegramUrl: e.target.value })}
                placeholder="https://t.me/..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Official Website URL</label>
              <input
                type="url"
                value={config.officialWebsiteUrl || ''}
                onChange={(e) => setConfig({ ...config, officialWebsiteUrl: e.target.value })}
                placeholder="https://andamanquiz.com"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingConfig}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
            >
              <Save size={14} />
              <span>{savingConfig ? 'Saving...' : 'Save App Config'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Banner Modal */}
      <Modal isOpen={isBannerModalOpen} onClose={() => setIsBannerModalOpen(false)} title="Add Home Banner">
        <form onSubmit={handleSaveBanner} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Banner Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Andaman GK Crash Course Series"
              value={bannerTitle}
              onChange={(e) => setBannerTitle(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Screen Route</label>
            <input
              type="text"
              required
              placeholder="/tests or /andaman_gk"
              value={bannerRoute}
              onChange={(e) => setBannerRoute(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <ImageUploader
            label="Banner Artwork Image"
            folder="banners"
            value={bannerImage}
            onChange={(url) => setBannerImage(url)}
          />

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsBannerModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700"
            >
              Save Banner
            </button>
          </div>
        </form>
      </Modal>

      {/* Notice Modal */}
      <Modal isOpen={isNoticeModalOpen} onClose={() => setIsNoticeModalOpen(false)} title="Post Announcement">
        <form onSubmit={handleSaveNotice} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notice Headline</label>
            <input
              type="text"
              required
              placeholder="e.g. A&N Administration MTS Exam Date Declared"
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notice Message</label>
            <textarea
              rows={4}
              required
              placeholder="Detailed announcement text..."
              value={noticeBody}
              onChange={(e) => setNoticeBody(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsNoticeModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700"
            >
              Publish Notice
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
