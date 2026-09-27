import React, { useState, useEffect, useMemo } from 'react';
import {
  Upload,
  Link as LinkIcon,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  FileText,
  FileCheck,
  Eye,
  Trash2,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Image as ImageIcon,
  BookOpen,
  Compass,
  Download
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { StudyMaterial, StudyFolder, Exam, Subject, Topic, StudyMaterialType } from '../../types';
import { uploadPdfFile, uploadImage } from '../../firebase/storage';

interface StudyMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: StudyMaterial | null;
  folders: StudyFolder[];
  exams: Exam[];
  subjects: Subject[];
  topics: Topic[];
  onSave: (material: StudyMaterial) => Promise<void>;
}

export const StudyMaterialModal: React.FC<StudyMaterialModalProps> = ({
  isOpen,
  onClose,
  material,
  folders,
  exams,
  subjects,
  topics,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [examCode, setExamCode] = useState('');
  const [folderId, setFolderId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [topicId, setTopicId] = useState<string>('');
  const [materialType, setMaterialType] = useState<StudyMaterialType>('PDF');

  // Thumbnail
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

  // PDF Specifics
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSizeBytes, setFileSizeBytes] = useState<number | undefined>(undefined);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  // Article / Notes Specifics
  const [articleContent, setArticleContent] = useState('');
  const [previewArticle, setPreviewArticle] = useState(false);

  // External Link Specifics
  const [externalUrl, setExternalUrl] = useState('');
  const [buttonLabel, setButtonLabel] = useState('');
  const [sourceName, setSourceName] = useState('');

  // Access & Attributes
  const [isFree, setIsFree] = useState(true);
  const [downloadAllowed, setDownloadAllowed] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('published');
  const [publishDateType, setPublishDateType] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (material) {
      setTitle(material.title);
      setDescription(material.description || '');
      setExamCode(material.examCode || exams[0]?.code || 'ANCHSL');
      setFolderId(material.folderId || '');
      setSubjectId(material.subjectId || '');
      setTopicId(material.topicId || '');
      setMaterialType(material.materialType || 'PDF');
      setThumbnailUrl(material.thumbnailUrl || '');
      setFileUrl(material.fileUrl || '');
      setFileName(material.fileName || '');
      setFileSizeBytes(material.fileSizeBytes);
      setArticleContent(material.articleContent || '');
      setExternalUrl(material.externalUrl || '');
      setButtonLabel(material.buttonLabel || '');
      setSourceName(material.sourceName || '');
      setIsFree(material.isFree ?? true);
      setDownloadAllowed(material.downloadAllowed ?? true);
      setIsFeatured(material.isFeatured ?? false);
      setSortOrder(material.sortOrder ?? 0);
      setStatus(material.status || 'published');
      const isFuture = material.publishDate && new Date(material.publishDate).getTime() > Date.now();
      setPublishDateType(isFuture ? 'schedule' : 'now');
      setScheduledDate(material.publishDate ? material.publishDate.slice(0, 16) : '');
    } else {
      setTitle('');
      setDescription('');
      setExamCode(exams[0]?.code || 'ANCHSL');
      setFolderId(folders[0]?.id || '');
      setSubjectId('');
      setTopicId('');
      setMaterialType('PDF');
      setThumbnailUrl('');
      setFileUrl('');
      setFileName('');
      setFileSizeBytes(undefined);
      setArticleContent('');
      setExternalUrl('');
      setButtonLabel('');
      setSourceName('');
      setIsFree(true);
      setDownloadAllowed(true);
      setIsFeatured(false);
      setSortOrder(0);
      setStatus('published');
      setPublishDateType('now');
      setScheduledDate('');
    }
    setPreviewArticle(false);
    setError(null);
  }, [material, exams, folders, isOpen]);

  // Filtered taxonomy
  const filteredFolders = useMemo(() => {
    return folders.filter((f) => !f.examCode || f.examCode === examCode);
  }, [folders, examCode]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => !s.examCodes || s.examCodes.includes(examCode));
  }, [subjects, examCode]);

  const filteredTopics = useMemo(() => {
    return topics.filter((t) => !subjectId || t.subjectId === subjectId);
  }, [topics, subjectId]);

  // Check parent draft status
  const parentFolder = useMemo(() => {
    if (!folderId || folderId === 'ROOT') return null;
    return folders.find((f) => f.id === folderId);
  }, [folders, folderId]);

  const validateHttpsUrl = (url: string): boolean => {
    if (!url) return true;
    return /^https:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+$/.test(url.trim());
  };

  const handleUploadPdf = async (file: File) => {
    setError(null);
    if (!file.type && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF document.');
      return;
    }
    if (file.type && file.type !== 'application/pdf') {
      setError('Invalid file format. Only PDF files are permitted.');
      return;
    }

    const materialId = material?.id || `mat_${Date.now()}`;
    const folder = `study_materials/${materialId}`;

    setPdfUploading(true);
    setPdfProgress(0);
    try {
      const res = await uploadPdfFile(file, folder, (p) => setPdfProgress(p.percent));
      setFileUrl(res.downloadUrl);
      setFileName(file.name);
      setFileSizeBytes(file.size);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to upload PDF: ${err.message || 'Storage error'}`);
    } finally {
      setPdfUploading(false);
    }
  };

  const handleUploadThumbnail = async (file: File) => {
    setError(null);
    const materialId = material?.id || `mat_${Date.now()}`;
    const folder = `study_materials/${materialId}`;

    setThumbnailUploading(true);
    try {
      const url = await uploadImage(file, folder);
      setThumbnailUrl(url);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to upload thumbnail: ${err.message || 'Storage error'}`);
    } finally {
      setThumbnailUploading(false);
    }
  };

  const insertMarkdown = (syntax: string, placeholder: string = 'text') => {
    if (syntax === 'h2') {
      setArticleContent((prev) => `${prev}\n\n## Section Title\n`);
    } else if (syntax === 'bold') {
      setArticleContent((prev) => `${prev} **${placeholder}** `);
    } else if (syntax === 'italic') {
      setArticleContent((prev) => `${prev} *${placeholder}* `);
    } else if (syntax === 'bullet') {
      setArticleContent((prev) => `${prev}\n- Item 1\n- Item 2\n- Item 3\n`);
    } else if (syntax === 'numbered') {
      setArticleContent((prev) => `${prev}\n1. Step 1\n2. Step 2\n3. Step 3\n`);
    } else if (syntax === 'link') {
      setArticleContent((prev) => `${prev} [Link Label](https://...) `);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Material title is required.');
      return;
    }

    if (!examCode) {
      setError('Please select an Exam.');
      return;
    }

    // Type-specific validations
    if (materialType === 'PDF') {
      if (!fileUrl) {
        setError('Please upload a PDF document for PDF material type.');
        return;
      }
      if (!validateHttpsUrl(fileUrl)) {
        setError('PDF URL must be a valid secure HTTPS storage link.');
        return;
      }
    } else if (materialType === 'ARTICLE') {
      if (!articleContent.trim()) {
        setError('Article content cannot be empty.');
        return;
      }
    } else if (materialType === 'EXTERNAL_LINK') {
      if (!externalUrl.trim()) {
        setError('External destination URL is required.');
        return;
      }
      if (!validateHttpsUrl(externalUrl)) {
        setError('External link must be a valid secure HTTPS URL (e.g. https://...).');
        return;
      }
    } else if (materialType === 'IMAGE_NOTE') {
      if (!fileUrl && !thumbnailUrl) {
        setError('Please upload an image or provide an image URL for Image Note.');
        return;
      }
      const imgUrl = fileUrl || thumbnailUrl;
      if (!validateHttpsUrl(imgUrl)) {
        setError('Image Note URL must be a valid secure HTTPS URL.');
        return;
      }
    } else if (materialType === 'SYLLABUS') {
      if (!articleContent.trim() && !fileUrl && !externalUrl.trim()) {
        setError('Syllabus requires either an outline summary, official PDF, or reference URL.');
        return;
      }
      if (externalUrl && !validateHttpsUrl(externalUrl)) {
        setError('Official Syllabus URL must be a valid HTTPS URL.');
        return;
      }
    } else if (materialType === 'STRATEGY') {
      if (!articleContent.trim() && !fileUrl) {
        setError('Strategy requires article content or an attached PDF guide.');
        return;
      }
    }

    // Publication date determination
    let cleanPublishDate = new Date().toISOString();
    if (publishDateType === 'schedule') {
      if (!scheduledDate) {
        setError('Please select a scheduled publication date.');
        return;
      }
      const sDate = new Date(scheduledDate);
      if (isNaN(sDate.getTime())) {
        setError('Invalid scheduled publication date.');
        return;
      }
      cleanPublishDate = sDate.toISOString();
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const materialId = material ? material.id : `mat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const data: StudyMaterial = {
        id: materialId,
        folderId: folderId === 'ROOT' ? '' : folderId,
        examCode,
        subjectId: subjectId || undefined,
        topicId: topicId || undefined,
        title: cleanTitle,
        description: description.trim() || undefined,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        materialType,
        fileUrl: fileUrl.trim() || undefined,
        fileName: fileName.trim() || undefined,
        fileSizeBytes,
        articleContent: articleContent.trim() || undefined,
        externalUrl: externalUrl.trim() || undefined,
        buttonLabel: buttonLabel.trim() || undefined,
        sourceName: sourceName.trim() || undefined,
        isFree,
        downloadAllowed,
        sortOrder: Number(sortOrder) || 0,
        isFeatured,
        status,
        publishDate: cleanPublishDate,
        createdAt: material ? material.createdAt : nowIso,
        updatedAt: nowIso,
      };

      await onSave(data);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save study material.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={material ? 'Edit Study Material' : 'Add Study Material'}
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Parent Folder Draft Warning */}
        {parentFolder && parentFolder.status === 'draft' && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Parent Folder is in Draft Mode: </span>
              Folder <em>"{parentFolder.title}"</em> is unpublished. Even if this material is set to Published, students will not see it until the parent folder is published.
            </div>
          </div>
        )}

        {/* Material Type Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Material Format / Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {[
              { type: 'PDF', label: 'PDF Document', icon: FileCheck },
              { type: 'ARTICLE', label: 'Article / Notes', icon: FileText },
              { type: 'IMAGE_NOTE', label: 'Image Note', icon: ImageIcon },
              { type: 'EXTERNAL_LINK', label: 'External Link', icon: ExternalLink },
              { type: 'SYLLABUS', label: 'Syllabus', icon: BookOpen },
              { type: 'STRATEGY', label: 'Study Strategy', icon: Compass },
            ].map((opt) => {
              const Icon = opt.icon;
              const isSelected = materialType === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setMaterialType(opt.type as StudyMaterialType)}
                  className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 transition ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50/70 text-brand-700 shadow-2xs font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <Icon size={18} className={isSelected ? 'text-brand-600' : 'text-slate-400'} />
                  <span className="text-[11px] leading-tight">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Basic Metadata */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Resource Information</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Material Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Andaman History & Geography Complete Revision Notes"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                required
              />
            </div>

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
                Parent Folder
              </label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="ROOT">No Folder / Root Material</option>
                {filteredFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.title} ({f.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject (Optional)
              </label>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setTopicId('');
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="">General / All Subjects</option>
                {filteredSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Topic (Optional)
              </label>
              <select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                disabled={!subjectId}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium disabled:opacity-50"
              >
                <option value="">All Topics</option>
                {filteredTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Overview
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Concise summary of what this document covers..."
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* Type-Specific Content Editors */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Content & Assets</h4>

          {/* 1. PDF Upload */}
          {materialType === 'PDF' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                PDF Document <span className="text-red-500">*</span>
              </label>

              {fileUrl ? (
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                      <FileCheck size={16} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 block truncate">
                        {fileName || 'document.pdf'}
                      </span>
                      {fileSizeBytes && (
                        <span className="text-[11px] text-slate-500">
                          {(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 transition"
                    >
                      <Eye size={12} /> Preview
                    </a>

                    <label className="cursor-pointer px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition">
                      <RefreshCw size={12} /> Replace
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        disabled={pdfUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadPdf(f);
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setFileUrl('');
                        setFileName('');
                        setFileSizeBytes(undefined);
                      }}
                      className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Remove PDF"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-brand-500 bg-white p-6 rounded-xl text-center space-y-2 transition">
                  <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Upload size={18} />
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-brand-600">Click to upload PDF</span> or drag and drop
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {pdfUploading ? `Uploading... (${pdfProgress}%)` : 'Supports official PDF materials up to 50MB'}
                  </p>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={pdfUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadPdf(f);
                    }}
                  />
                </label>
              )}
            </div>
          )}

          {/* 2. Article / Notes Editor */}
          {materialType === 'ARTICLE' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Article & Study Notes Content (Markdown) <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPreviewArticle(!previewArticle)}
                  className="px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition"
                >
                  {previewArticle ? 'Edit Markdown' : 'Preview Note'}
                </button>
              </div>

              {!previewArticle ? (
                <div className="space-y-2">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => insertMarkdown('h2')}
                      className="px-2 py-0.5 font-bold hover:bg-slate-100 rounded"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('bold')}
                      className="px-2 py-0.5 font-bold hover:bg-slate-100 rounded"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('italic')}
                      className="px-2 py-0.5 italic hover:bg-slate-100 rounded"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('bullet')}
                      className="px-2 py-0.5 hover:bg-slate-100 rounded"
                    >
                      • List
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('numbered')}
                      className="px-2 py-0.5 hover:bg-slate-100 rounded"
                    >
                      1. List
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown('link')}
                      className="px-2 py-0.5 hover:bg-slate-100 rounded"
                    >
                      Link
                    </button>
                  </div>

                  <textarea
                    rows={8}
                    value={articleContent}
                    onChange={(e) => setArticleContent(e.target.value)}
                    placeholder="Write structured study notes using markdown..."
                    className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-mono bg-white resize-y"
                    required
                  />
                </div>
              ) : (
                <div className="p-4 bg-white rounded-xl border border-slate-200 min-h-48 text-xs prose prose-slate max-w-none">
                  {articleContent ? (
                    <div className="whitespace-pre-wrap">{articleContent}</div>
                  ) : (
                    <span className="text-slate-400 italic">No content to preview.</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. Image Note */}
          {materialType === 'IMAGE_NOTE' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Image Note (Diagram, Formula Sheet, Infographic) <span className="text-red-500">*</span>
              </label>

              <div className="flex items-center gap-3">
                <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-brand-500 bg-white py-3 px-4 rounded-xl text-xs text-slate-600 transition">
                  <Upload size={14} />
                  <span>{thumbnailUploading ? 'Uploading Image...' : 'Upload Image Note'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={thumbnailUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadThumbnail(f);
                    }}
                  />
                </label>

                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt="Image Note Preview"
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
                  />
                )}
              </div>
            </div>
          )}

          {/* 4. External Link */}
          {materialType === 'EXTERNAL_LINK' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                External Link Configuration <span className="text-red-500">*</span>
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination URL (HTTPS Only) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <LinkIcon size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://ssc.gov.in/..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Button Label
                  </label>
                  <input
                    type="text"
                    value={buttonLabel}
                    onChange={(e) => setButtonLabel(e.target.value)}
                    placeholder="e.g. Visit Official Website"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Source / Authority Name
                  </label>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="e.g. Staff Selection Commission"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. Syllabus Material */}
          {materialType === 'SYLLABUS' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Syllabus Outline & Official References
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Syllabus Breakdown (Markdown)
                </label>
                <textarea
                  rows={4}
                  value={articleContent}
                  onChange={(e) => setArticleContent(e.target.value)}
                  placeholder="Section-by-section syllabus topics..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white resize-y"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official PDF Document (Optional)
                  </label>
                  <label className="cursor-pointer flex items-center gap-2 border border-slate-300 bg-white py-2 px-3 rounded-xl text-xs text-slate-700 hover:bg-slate-100 transition truncate">
                    <Upload size={14} className="shrink-0" />
                    <span className="truncate">{fileName || 'Upload Official Notification PDF'}</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadPdf(f);
                      }}
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Notification URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. Strategy Material */}
          {materialType === 'STRATEGY' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Strategy & Preparation Plan
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Strategy Guide & Timeline (Markdown) <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={5}
                  value={articleContent}
                  onChange={(e) => setArticleContent(e.target.value)}
                  placeholder="30-day roadmap, time allocation per subject, recommended mock frequency..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Optional Study Plan Chart / PDF Guide
                </label>
                <label className="cursor-pointer flex items-center gap-2 border border-slate-300 bg-white py-2 px-3 rounded-xl text-xs text-slate-700 hover:bg-slate-100 transition truncate">
                  <Upload size={14} className="shrink-0" />
                  <span className="truncate">{fileName || 'Upload Printable Study Schedule PDF'}</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadPdf(f);
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Access, Scheduling & Discovery */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Access & Publication</h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Access Level
              </label>
              <select
                value={isFree ? 'FREE' : 'PAID'}
                onChange={(e) => setIsFree(e.target.value === 'FREE')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="FREE">Free Material</option>
                <option value="PAID">Paid / Premium Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Publication Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Publication Timing
              </label>
              <select
                value={publishDateType}
                onChange={(e) => setPublishDateType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
              >
                <option value="now">Publish Immediately</option>
                <option value="schedule">Schedule for Date</option>
              </select>
            </div>

            {publishDateType === 'schedule' && (
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scheduled Release Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                  required
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={downloadAllowed}
                onChange={(e) => setDownloadAllowed(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded"
              />
              <span className="flex items-center gap-1">
                <Download size={13} /> Allow Offline Download in App
              </span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded"
              />
              <span className="flex items-center gap-1">
                <Sparkles size={13} /> Mark as Featured Resource
              </span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
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
            disabled={saving || pdfUploading || thumbnailUploading}
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
                <span>{material ? 'Update Material' : 'Save Material'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
