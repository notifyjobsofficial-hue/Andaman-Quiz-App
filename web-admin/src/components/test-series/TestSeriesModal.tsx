import React, { useState, useEffect } from 'react';
import { Upload, Link as LinkIcon, AlertCircle, Loader2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { TestSeries, Exam, SeriesValidityType } from '../../types';
import { uploadImage } from '../../firebase/storage';

interface TestSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  series: TestSeries | null;
  exams: Exam[];
  onSave: (series: TestSeries) => Promise<void>;
}

export const TestSeriesModal: React.FC<TestSeriesModalProps> = ({
  isOpen,
  onClose,
  series,
  exams,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [examCode, setExamCode] = useState('');
  const [description, setDescription] = useState('');

  // Thumbnail
  const [thumbnailMode, setThumbnailMode] = useState<'upload' | 'url'>('upload');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [thumbnailProgress, setThumbnailProgress] = useState(0);

  // Banner
  const [bannerMode, setBannerMode] = useState<'upload' | 'url'>('upload');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerProgress, setBannerProgress] = useState(0);

  // Pricing
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState<number | ''>(199);
  const [originalPrice, setOriginalPrice] = useState<number | ''>(499);
  const [offerPrice, setOfferPrice] = useState<number | ''>('');
  const [productId, setProductId] = useState('');

  // Validity
  const [validityType, setValidityType] = useState<SeriesValidityType>('DAYS_FROM_ACTIVATION');
  const [validityDays, setValidityDays] = useState<number>(365);
  const [expiryAt, setExpiryAt] = useState('');

  // Status & Metadata
  const [isFeatured, setIsFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('published');
  const [tagsInput, setTagsInput] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (series) {
      setTitle(series.title);
      setSubtitle(series.subtitle || '');
      setExamCode(series.examCode);
      setDescription(series.description || '');
      setThumbnailUrl(series.thumbnailUrl || '');
      setBannerUrl(series.bannerUrl || '');
      setIsFree(series.isFree ?? true);
      setPrice(series.price ?? 199);
      setOriginalPrice(series.originalPrice ?? 499);
      setOfferPrice(series.offerPrice ?? '');
      setProductId(series.productId || '');
      setValidityType(series.validityType || (series.expiryAt ? 'FIXED_EXPIRY' : 'DAYS_FROM_ACTIVATION'));
      setValidityDays(series.validityDays ?? 365);
      setExpiryAt(series.expiryAt ? series.expiryAt.slice(0, 10) : '');
      setIsFeatured(series.isFeatured ?? false);
      setSortOrder(series.sortOrder ?? 0);
      setStatus(series.status ?? 'published');
      setTagsInput(series.tags?.join(', ') || '');
    } else {
      setTitle('');
      setSubtitle('');
      setExamCode(exams[0]?.code || 'ANCHSL');
      setDescription('');
      setThumbnailUrl('');
      setBannerUrl('');
      setIsFree(true);
      setPrice(199);
      setOriginalPrice(499);
      setOfferPrice('');
      setProductId('');
      setValidityType('DAYS_FROM_ACTIVATION');
      setValidityDays(365);
      setExpiryAt('');
      setIsFeatured(false);
      setSortOrder(0);
      setStatus('published');
      setTagsInput('');
    }
    setError(null);
  }, [series, exams, isOpen]);

  const validateHttpsUrl = (url: string): boolean => {
    if (!url) return true;
    return /^https:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+$/.test(url.trim());
  };

  const handleUploadImage = async (
    file: File,
    type: 'thumbnail' | 'banner'
  ) => {
    setError(null);
    const seriesId = series?.id || `series_${Date.now()}`;
    const folder = `test_series/${seriesId}`;

    try {
      if (type === 'thumbnail') {
        setThumbnailUploading(true);
        setThumbnailProgress(0);
        const url = await uploadImage(file, folder, (p) => setThumbnailProgress(p));
        setThumbnailUrl(url);
      } else {
        setBannerUploading(true);
        setBannerProgress(0);
        const url = await uploadImage(file, folder, (p) => setBannerProgress(p));
        setBannerUrl(url);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Failed to upload ${type}: ${err.message || 'Storage error'}`);
    } finally {
      if (type === 'thumbnail') setThumbnailUploading(false);
      else setBannerUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Test Series title is required.');
      return;
    }

    if (!examCode) {
      setError('Please select an Exam.');
      return;
    }

    // Image URL validations
    if (thumbnailUrl && !validateHttpsUrl(thumbnailUrl)) {
      setError('Thumbnail URL must be a valid HTTPS URL (e.g., https://...). Local files or insecure URLs are not allowed.');
      return;
    }
    if (bannerUrl && !validateHttpsUrl(bannerUrl)) {
      setError('Banner URL must be a valid HTTPS URL (e.g., https://...). Local files or insecure URLs are not allowed.');
      return;
    }

    // Paid Pricing & Product ID Validation
    let cleanPrice: number | undefined = undefined;
    let cleanOriginalPrice: number | undefined = undefined;
    let cleanOfferPrice: number | undefined = undefined;
    let cleanProductId: string | undefined = undefined;

    if (!isFree) {
      if (price === '' || isNaN(Number(price)) || Number(price) <= 0) {
        setError('Price must be greater than ₹0 for paid Test Series.');
        return;
      }
      cleanPrice = Number(price);

      const cleanPid = productId.trim();
      if (!cleanPid) {
        setError('Google Play Product ID (SKU) is required for paid Test Series (e.g. series_andaman_gk_2026).');
        return;
      }
      cleanProductId = cleanPid;

      if (originalPrice !== '' && !isNaN(Number(originalPrice))) {
        cleanOriginalPrice = Number(originalPrice);
      }
      if (offerPrice !== '' && !isNaN(Number(offerPrice))) {
        cleanOfferPrice = Number(offerPrice);
      }
    }

    // Validity validation
    let cleanExpiryAt: string | undefined = undefined;
    let cleanValidityDays = validityDays;

    if (validityType === 'FIXED_EXPIRY') {
      if (!expiryAt) {
        setError('Please select an expiration date for Fixed Expiry validity.');
        return;
      }
      const expDate = new Date(expiryAt);
      if (isNaN(expDate.getTime())) {
        setError('Invalid expiration date format.');
        return;
      }
      cleanExpiryAt = expDate.toISOString();
    } else if (validityType === 'DAYS_FROM_ACTIVATION') {
      if (!validityDays || validityDays <= 0) {
        setError('Validity days must be a positive number (e.g. 365).');
        return;
      }
      cleanValidityDays = validityDays;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const nowIso = new Date().toISOString();
    const id = series ? series.id : `series_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const seriesData: TestSeries = {
      id,
      title: cleanTitle,
      subtitle: subtitle.trim() || undefined,
      examCode,
      description: description.trim(),
      thumbnailUrl: thumbnailUrl.trim() || undefined,
      bannerUrl: bannerUrl.trim() || undefined,
      isFree,
      price: cleanPrice,
      originalPrice: cleanOriginalPrice,
      offerPrice: cleanOfferPrice,
      productId: cleanProductId,
      validityType,
      validityDays: validityType === 'DAYS_FROM_ACTIVATION' ? cleanValidityDays : 0,
      expiryAt: cleanExpiryAt,
      isFeatured,
      sortOrder: Number(sortOrder) || 0,
      status,
      totalTests: series ? series.totalTests : 0,
      totalFolders: series ? series.totalFolders : 0,
      tags,
      createdAt: series ? series.createdAt : nowIso,
      updatedAt: nowIso,
    };

    setSaving(true);
    try {
      await onSave(seriesData);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save test series.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={series ? 'Edit Test Series' : 'Create New Test Series'}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">General Information</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Series Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Andaman CHSL 2026 Complete Test Series"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subtitle (Optional)
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. 50 Full Mocks + 30 Sectional Tests + Detailed Explanations"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Exam <span className="text-red-500">*</span>
              </label>
              <select
                value={examCode}
                onChange={(e) => setExamCode(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
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
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="draft">Draft (Admin Only)</option>
                <option value="published">Published (Visible to Students)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Highlights
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Comprehensive test series covering all tier-1 syllabus..."
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* Media & Artwork */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Artwork & Media</h4>

          {/* Thumbnail */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-brand-600" />
                Thumbnail Image
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setThumbnailMode('upload')}
                  className={`px-2 py-0.5 rounded font-medium transition ${thumbnailMode === 'upload' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setThumbnailMode('url')}
                  className={`px-2 py-0.5 rounded font-medium transition ${thumbnailMode === 'url' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  Direct HTTPS URL
                </button>
              </div>
            </div>

            {thumbnailMode === 'upload' ? (
              <div className="flex items-center gap-3">
                <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-brand-500 bg-white py-2.5 px-4 rounded-xl text-xs text-slate-600 transition">
                  <Upload size={14} />
                  <span>{thumbnailUploading ? `Uploading... (${thumbnailProgress}%)` : 'Select Thumbnail (JPEG/PNG/WebP)'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={thumbnailUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, 'thumbnail');
                    }}
                  />
                </label>
                {thumbnailUrl && (
                  <img src={thumbnailUrl} alt="Thumbnail preview" className="w-12 h-12 rounded-lg object-cover border border-slate-200 shadow-xs" />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <LinkIcon size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="url"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                  />
                </div>
                {thumbnailUrl && (
                  <img src={thumbnailUrl} alt="Thumbnail preview" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shadow-xs" />
                )}
              </div>
            )}
          </div>

          {/* Banner */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-emerald-600" />
                Banner Header Image (Optional)
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setBannerMode('upload')}
                  className={`px-2 py-0.5 rounded font-medium transition ${bannerMode === 'upload' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setBannerMode('url')}
                  className={`px-2 py-0.5 rounded font-medium transition ${bannerMode === 'url' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  Direct HTTPS URL
                </button>
              </div>
            </div>

            {bannerMode === 'upload' ? (
              <div className="flex items-center gap-3">
                <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-brand-500 bg-white py-2.5 px-4 rounded-xl text-xs text-slate-600 transition">
                  <Upload size={14} />
                  <span>{bannerUploading ? `Uploading... (${bannerProgress}%)` : 'Select Wide Banner Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={bannerUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file, 'banner');
                    }}
                  />
                </label>
                {bannerUrl && (
                  <img src={bannerUrl} alt="Banner preview" className="w-20 h-10 rounded-lg object-cover border border-slate-200 shadow-xs" />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <LinkIcon size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="url"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                  />
                </div>
                {bannerUrl && (
                  <img src={bannerUrl} alt="Banner preview" className="w-20 h-10 rounded-lg object-cover border border-slate-200 shadow-xs" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pricing & Google Play Product SKU */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Access & Monetization</h4>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="accessType"
                  checked={isFree}
                  onChange={() => setIsFree(true)}
                  className="text-brand-600"
                />
                <span className="text-emerald-700">Free Series</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="accessType"
                  checked={!isFree}
                  onChange={() => setIsFree(false)}
                  className="text-brand-600"
                />
                <span className="text-amber-700">Paid Bundle / Test Series</span>
              </label>
            </div>
          </div>

          {!isFree && (
            <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selling Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                    placeholder="199"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Original / MRP (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                    placeholder="499"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Offer Price (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Play In-App Product ID (SKU) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  placeholder="e.g. series_andaman_chsl_2026"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-mono"
                  required={!isFree}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Must match the exact in-app product ID created in Google Play Console.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Validity Configuration */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Validity & Expiry</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Validity Type
              </label>
              <select
                value={validityType}
                onChange={(e) => setValidityType(e.target.value as SeriesValidityType)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="DAYS_FROM_ACTIVATION">Days from Activation / Purchase</option>
                <option value="FIXED_EXPIRY">Fixed Expiry Date</option>
                <option value="LIFETIME">Lifetime Access</option>
              </select>
            </div>

            {validityType === 'DAYS_FROM_ACTIVATION' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Duration (Days) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={validityDays}
                  onChange={(e) => setValidityDays(Number(e.target.value))}
                  placeholder="365"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  required
                />
              </div>
            )}

            {validityType === 'FIXED_EXPIRY' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expiry Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={expiryAt}
                  onChange={(e) => setExpiryAt(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Discovery & Tags */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Discovery & Highlights</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <span>Feature on App Home Screen</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tags / Badges (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Full Length, PYQs, Andaman GK, 2026 Pattern"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Form Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || thumbnailUploading || bannerUploading}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>{series ? 'Update Series' : 'Create Series'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
