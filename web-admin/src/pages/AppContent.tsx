import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Image as ImageIcon, Bell, Settings2, Save, Calendar, Sparkles, AlertCircle, DollarSign } from 'lucide-react';
import {
  fetchBanners,
  saveBanner,
  deleteBanner,
  fetchNotices,
  saveNotice,
  deleteNotice,
  fetchAppConfig,
  saveAppConfig,
  fetchQOTDList,
  saveQOTD,
  deleteQOTD,
  fetchQuestions
} from '../firebase/firestore';
import { HomeBanner, AppNotice, AppConfig, QuestionOfTheDay, Question } from '../types';
import { ImageUploader } from '../components/common/ImageUploader';
import { Modal } from '../components/common/Modal';

export const AppContent: React.FC = () => {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const [qotdList, setQotdList] = useState<QuestionOfTheDay[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    id: 'main',
    maintenanceMode: false,
    maintenanceMessage: 'Andaman Quiz is currently undergoing scheduled maintenance. Please check back shortly.',
    supportEmail: 'support@andamanquiz.com',
    whatsappUrl: 'https://wa.me/919999999999',
    telegramUrl: 'https://t.me/andamanquiz',
    officialWebsiteUrl: 'https://andamanquiz.com',
    adsEnabled: true,
    freeTestResultAdEnabled: true,
    quizResultAdEnabled: true,
    adFrequency: 1,
    admobBannerId: '',
    admobInterstitialId: '',
  });

  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Banner Modal
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [bannerRoute, setBannerRoute] = useState('/tests');
  const [isSavingBanner, setIsSavingBanner] = useState(false);

  // Notice Modal
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [isSavingNotice, setIsSavingNotice] = useState(false);

  // QOTD Modal
  const [isQotdModalOpen, setIsQotdModalOpen] = useState(false);
  const [qotdDate, setQotdDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [qotdSearch, setQotdSearch] = useState('');
  const [isSavingQotd, setIsSavingQotd] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [b, n, c, qList, allQ] = await Promise.all([
        fetchBanners(),
        fetchNotices(),
        fetchAppConfig(),
        fetchQOTDList(),
        fetchQuestions(200)
      ]);
      setBanners(b);
      setNotices(n);
      if (c) setConfig(c);
      setQotdList(qList);
      setQuestions(allQ);
      if (allQ.length > 0 && !selectedQuestionId) {
        setSelectedQuestionId(allQ[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to load app content from Firestore.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerTitle.trim() || !bannerImage.trim()) return;

    setIsSavingBanner(true);
    try {
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
      setActionFeedback({ type: 'success', message: 'Promotional banner added successfully!' });
      loadData();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to save banner.' });
    } finally {
      setIsSavingBanner(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    try {
      await deleteBanner(id);
      setActionFeedback({ type: 'success', message: 'Banner deleted successfully.' });
      loadData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to delete banner.' });
    }
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeBody.trim()) return;

    setIsSavingNotice(true);
    try {
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
      setActionFeedback({ type: 'success', message: 'Announcement notice published!' });
      loadData();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to post notice.' });
    } finally {
      setIsSavingNotice(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!confirm('Delete this notice?')) return;
    try {
      await deleteNotice(id);
      setActionFeedback({ type: 'success', message: 'Announcement deleted.' });
      loadData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to delete notice.' });
    }
  };

  const handleSaveQOTD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qotdDate || !selectedQuestionId) return;

    const chosenQ = questions.find((q) => q.id === selectedQuestionId);
    if (!chosenQ) return;

    setIsSavingQotd(true);
    try {
      const newQotd: QuestionOfTheDay = {
        id: qotdDate,
        date: qotdDate,
        questionId: chosenQ.id,
        questionText: chosenQ.question_text,
        options: [
          chosenQ.option_a_text || 'Option A',
          chosenQ.option_b_text || 'Option B',
          chosenQ.option_c_text || 'Option C',
          chosenQ.option_d_text || 'Option D'
        ],
        correctAnswer: chosenQ.correct_answer,
        explanation: chosenQ.explanation_text,
        active: true,
      };

      await saveQOTD(newQotd);
      setIsQotdModalOpen(false);
      setActionFeedback({ type: 'success', message: `Question of the Day scheduled for ${qotdDate}!` });
      loadData();
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Failed to save QOTD.' });
    } finally {
      setIsSavingQotd(false);
    }
  };

  const handleDeleteQOTD = async (date: string) => {
    if (!confirm(`Remove Question of the Day for ${date}?`)) return;
    try {
      await deleteQOTD(date);
      setActionFeedback({ type: 'success', message: `QOTD for ${date} removed.` });
      loadData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to delete QOTD.' });
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await saveAppConfig(config);
      setActionFeedback({ type: 'success', message: 'Application remote configuration saved successfully!' });
    } catch (err: any) {
      console.error(err);
      setActionFeedback({ type: 'error', message: err.message || 'Error saving remote app configuration.' });
    } finally {
      setSavingConfig(false);
    }
  };

  const filteredQuestions = questions.filter((q) =>
    q.question_text.toLowerCase().includes(qotdSearch.toLowerCase()) ||
    q.subject.toLowerCase().includes(qotdSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Feedback Banner */}
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
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">App Content, QOTD & Remote Config</h1>
        <p className="text-xs text-slate-500 mt-1">
          Remotely control promotional banners, Question of the Day, announcements, AdMob ads, and emergency maintenance.
        </p>
      </div>

      {/* 1. Question of the Day (QOTD) Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles size={16} className="text-brand-600" /> Question of the Day (QOTD)
            </h2>
            <p className="text-xs text-slate-500">Daily featured challenge for students with streak tracking</p>
          </div>
          <button
            onClick={() => setIsQotdModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus size={14} /> Schedule QOTD
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {qotdList.map((item) => (
            <div key={item.date} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 bg-brand-50 text-brand-700 font-bold text-xs rounded-full border border-brand-200 flex items-center gap-1">
                    <Calendar size={12} /> {item.date}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {item.questionId}</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 line-clamp-2">
                  {item.questionText || `Question ID: ${item.questionId}`}
                </p>
              </div>

              <button
                onClick={() => handleDeleteQOTD(item.date)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                title="Remove QOTD"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {qotdList.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No Question of the Day scheduled yet. Click "Schedule QOTD" to configure today's question.
            </div>
          )}
        </div>
      </div>

      {/* 2. Home Banners Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <ImageIcon size={16} className="text-brand-600" /> Home Screen Promotional Banners
            </h2>
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
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-bold text-slate-800 truncate">{b.title}</div>
                  <div className="text-[10px] text-slate-400 truncate">Route: {b.targetRoute}</div>
                </div>
                <button
                  onClick={() => handleDeleteBanner(b.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
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

      {/* 3. Announcements / Notices Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Bell size={16} className="text-brand-600" /> Announcements & Exam Notices
            </h2>
            <p className="text-xs text-slate-500">Official notifications, exam date updates, and syllabus alerts</p>
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

      {/* 4. Application Remote Configuration & AdMob */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Settings2 size={16} className="text-brand-600" /> Remote App Configuration & AdMob Ads
            </h2>
            <p className="text-xs text-slate-500">
              Control emergency maintenance, AdMob interstitial ads, and support contact channels remotely.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-6">
          {/* Maintenance Switch */}
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.maintenanceMode}
                onChange={(e) => setConfig({ ...config, maintenanceMode: e.target.checked })}
                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
              />
              <div>
                <span className="text-xs font-bold text-amber-900">Maintenance Mode</span>
                <p className="text-[11px] text-amber-700">Display maintenance screen on Android student app during server updates</p>
              </div>
            </label>

            {config.maintenanceMode && (
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">Maintenance Message</label>
                <input
                  type="text"
                  value={config.maintenanceMessage || ''}
                  onChange={(e) => setConfig({ ...config, maintenanceMessage: e.target.value })}
                  placeholder="App is temporarily down for maintenance..."
                  className="w-full text-xs p-2.5 border border-amber-300 rounded-xl bg-white"
                />
              </div>
            )}
          </div>

          {/* AdMob Remote Controls */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <DollarSign size={16} className="text-emerald-600" /> Google Mobile Ads (AdMob) Remote Configuration
            </div>
            <p className="text-[11px] text-slate-500">
              Ads are shown strictly after free mock test submission and practice quiz results. Paid mock tests are always 100% ad-free.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-2 cursor-pointer p-3 bg-white border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  checked={config.adsEnabled}
                  onChange={(e) => setConfig({ ...config, adsEnabled: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Master Ads Switch</span>
                  <span className="text-[10px] text-slate-400">Enable/disable all ads</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 bg-white border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  checked={config.freeTestResultAdEnabled}
                  onChange={(e) => setConfig({ ...config, freeTestResultAdEnabled: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Free Test Result Ad</span>
                  <span className="text-[10px] text-slate-400">Interstitial on submit</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 bg-white border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  checked={config.quizResultAdEnabled}
                  onChange={(e) => setConfig({ ...config, quizResultAdEnabled: e.target.checked })}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Quiz Practice Result Ad</span>
                  <span className="text-[10px] text-slate-400">Interstitial on quiz finish</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Ad Frequency Cap (Tests)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.adFrequency}
                  onChange={(e) => setConfig({ ...config, adFrequency: parseInt(e.target.value) || 1 })}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                />
                <span className="text-[10px] text-slate-400">1 = Every test, 2 = Every 2nd test</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Custom AdMob Banner ID (Optional)</label>
                <input
                  type="text"
                  value={config.admobBannerId || ''}
                  onChange={(e) => setConfig({ ...config, admobBannerId: e.target.value })}
                  placeholder="ca-app-pub-xxx/yyy"
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Custom Interstitial ID (Optional)</label>
                <input
                  type="text"
                  value={config.admobInterstitialId || ''}
                  onChange={(e) => setConfig({ ...config, admobInterstitialId: e.target.value })}
                  placeholder="ca-app-pub-xxx/yyy"
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Contact and Links */}
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

      {/* QOTD Modal */}
      <Modal isOpen={isQotdModalOpen} onClose={() => setIsQotdModalOpen(false)} title="Schedule Question of the Day">
        <form onSubmit={handleSaveQOTD} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Date</label>
            <input
              type="date"
              required
              value={qotdDate}
              onChange={(e) => setQotdDate(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Question from Bank</label>
            <input
              type="text"
              placeholder="Search questions by text or subject..."
              value={qotdSearch}
              onChange={(e) => setQotdSearch(e.target.value)}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg mb-2"
            />

            <select
              value={selectedQuestionId}
              onChange={(e) => setSelectedQuestionId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white outline-none"
              size={5}
            >
              {filteredQuestions.map((q) => (
                <option key={q.id} value={q.id}>
                  [{q.subject}] {q.question_text.slice(0, 70)}...
                </option>
              ))}
            </select>
          </div>

          {selectedQuestionId && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <span className="font-bold text-slate-700 block">Selected Preview:</span>
              <p className="text-slate-800">{questions.find((q) => q.id === selectedQuestionId)?.question_text}</p>
              <div className="text-[10px] text-emerald-700 font-semibold">
                Correct Answer: Option {questions.find((q) => q.id === selectedQuestionId)?.correct_answer}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsQotdModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingQotd || !selectedQuestionId}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50"
            >
              {isSavingQotd ? 'Saving...' : 'Set QOTD'}
            </button>
          </div>
        </form>
      </Modal>

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
              disabled={isSavingBanner}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50"
            >
              {isSavingBanner ? 'Saving...' : 'Save Banner'}
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
              disabled={isSavingNotice}
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50"
            >
              {isSavingNotice ? 'Publishing...' : 'Publish Notice'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
