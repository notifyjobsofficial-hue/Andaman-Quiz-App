import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FileCheck,
  Clock,
  Award,
  HelpCircle,
  AlertTriangle,
  Lock,
  Sparkles,
  Calendar,
  Layers
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { TestSeries, TestSeriesFolder, TestSeriesItem, MockTest } from '../../types';

interface SeriesPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  series: TestSeries | null;
  folders: TestSeriesFolder[];
  itemsByFolder: Record<string, TestSeriesItem[]>;
  canonicalMocks: Record<string, MockTest>;
}

export const SeriesPreviewModal: React.FC<SeriesPreviewModalProps> = ({
  isOpen,
  onClose,
  series,
  folders,
  itemsByFolder,
  canonicalMocks,
}) => {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  if (!series) return null;

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Check publication chain invariants
  const chainWarnings: { folderName: string; itemTitle: string; testId: string }[] = [];
  folders.forEach((folder) => {
    const items = itemsByFolder[folder.id] || [];
    items.forEach((item) => {
      const mock = canonicalMocks[item.testId];
      if (item.status === 'published' && (!mock || mock.status === 'draft')) {
        chainWarnings.push({
          folderName: folder.title,
          itemTitle: mock ? mock.title : `Unknown Test (${item.testId})`,
          testId: item.testId,
        });
      }
    });
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student View & Structural Preview"
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Warning Banner if Publication Chain is Broken */}
        {chainWarnings.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertTriangle size={16} className="text-amber-600" />
              <span>Publication Chain Warning ({chainWarnings.length} Issue{chainWarnings.length !== 1 ? 's' : ''})</span>
            </div>
            <p className="text-[11px] text-amber-800">
              The following published items point to canonical Mock Tests that are in <strong>Draft</strong> mode. Students cannot access tests whose canonical mock is Draft:
            </p>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px] font-medium text-amber-950">
              {chainWarnings.map((w, idx) => (
                <li key={idx}>
                  Folder <em>"{w.folderName}"</em>: <strong>{w.itemTitle}</strong> (ID: {w.testId})
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Series Header Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 shadow-md">
          {series.bannerUrl && (
            <div
              className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
              style={{ backgroundImage: `url(${series.bannerUrl})` }}
            />
          )}

          <div className="relative z-10 flex flex-col md:flex-row items-start gap-5">
            {series.thumbnailUrl ? (
              <img
                src={series.thumbnailUrl}
                alt={series.title}
                className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border-2 border-white/20 shadow-lg shrink-0"
              />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-brand-600/30 border border-white/20 flex items-center justify-center shrink-0">
                <Layers size={36} className="text-brand-300" />
              </div>
            )}

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-500 text-white uppercase tracking-wider">
                  {series.examCode}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  series.status === 'published'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {series.status.toUpperCase()}
                </span>
                {series.isFeatured && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 flex items-center gap-1">
                    <Sparkles size={11} /> Featured
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-xl font-black tracking-tight text-white">{series.title}</h2>
                {series.subtitle && (
                  <p className="text-xs text-slate-300 mt-0.5 font-medium">{series.subtitle}</p>
                )}
              </div>

              {series.description && (
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {series.description}
                </p>
              )}

              {/* Pricing & Validity Banner */}
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  {series.isFree ? (
                    <span className="text-emerald-400 font-extrabold text-sm">FREE ACCESS</span>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-white font-black text-lg">₹{series.price}</span>
                      {series.originalPrice && (
                        <span className="text-slate-400 line-through text-xs">₹{series.originalPrice}</span>
                      )}
                      {series.productId && (
                        <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-2 py-0.5 rounded">
                          SKU: {series.productId}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-slate-400">•</div>

                <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                  <Calendar size={13} className="text-brand-400" />
                  <span>
                    {series.validityType === 'LIFETIME'
                      ? 'Lifetime Validity'
                      : series.validityType === 'FIXED_EXPIRY' && series.expiryAt
                      ? `Valid until ${new Date(series.expiryAt).toLocaleDateString()}`
                      : `${series.validityDays || 365} Days from purchase`}
                  </span>
                </div>

                <div className="text-slate-400">•</div>

                <div className="text-slate-300 text-[11px] font-semibold">
                  {folders.length} Folder{folders.length !== 1 ? 's' : ''} • {series.totalTests || 0} Test{series.totalTests !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Folder Hierarchy Tree */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
            <span>CURRICULUM CONTENT STRUCTURE</span>
            <span className="text-slate-400 font-normal text-[11px]">
              {folders.length} folder{folders.length !== 1 ? 's' : ''}
            </span>
          </div>

          {folders.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50">
              No folders added to this series yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {folders.map((folder, folderIdx) => {
                const isCollapsed = collapsedFolders[folder.id];
                const items = itemsByFolder[folder.id] || [];

                return (
                  <div
                    key={folder.id}
                    className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs"
                  >
                    {/* Folder Header */}
                    <button
                      type="button"
                      onClick={() => toggleFolder(folder.id)}
                      className="w-full p-3.5 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 transition text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        {isCollapsed ? (
                          <ChevronRight size={16} className="text-slate-400" />
                        ) : (
                          <ChevronDown size={16} className="text-slate-400" />
                        )}
                        <Folder size={18} className="text-brand-600 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-800">
                              {folderIdx + 1}. {folder.title}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              folder.status === 'published'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                              {folder.status}
                            </span>
                          </div>
                          {folder.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{folder.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px]">
                          {items.length} Test{items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>

                    {/* Folder Items List */}
                    {!isCollapsed && (
                      <div className="divide-y divide-slate-100">
                        {items.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-xs italic">
                            Folder is empty.
                          </div>
                        ) : (
                          items.map((item, itemIdx) => {
                            const mock = canonicalMocks[item.testId];
                            const isMockDraft = !mock || mock.status === 'draft';

                            return (
                              <div
                                key={item.id}
                                className="p-3 pl-10 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileCheck size={16} className="text-slate-400 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-bold text-slate-800 truncate">
                                        {itemIdx + 1}. {mock ? mock.title : `Canonical Test (${item.testId})`}
                                      </span>
                                      
                                      {/* Access Mode Badge */}
                                      {item.accessMode === 'FREE_PREVIEW' ? (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          FREE PREVIEW
                                        </span>
                                      ) : item.accessMode === 'LOCKED_UNTIL_DATE' ? (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                          <Lock size={10} />
                                          {item.unlockAt ? `Unlocks ${new Date(item.unlockAt).toLocaleDateString()}` : 'Scheduled'}
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                          INCLUDED
                                        </span>
                                      )}

                                      {/* Canonical Draft warning badge */}
                                      {isMockDraft && (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                          Mock is Draft
                                        </span>
                                      )}
                                    </div>

                                    {mock ? (
                                      <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                                        <span className="flex items-center gap-1">
                                          <HelpCircle size={11} /> {mock.totalQuestions || 0} Qs
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
                                    ) : (
                                      <span className="text-[11px] text-red-500 font-semibold">
                                        Referenced mock test not found in database
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0 text-right">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.status === 'published'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    Item: {item.status}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </Modal>
  );
};
