import React from 'react';
import {
  LayoutDashboard,
  HelpCircle,
  UploadCloud,
  FileCheck,
  Layers,
  BookOpen,
  FolderTree,
  Bell,
  Settings,
  X,
  Radio,
  Image as ImageIcon
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'questions', label: 'Question Bank', icon: HelpCircle },
    { id: 'import', label: 'Bulk Question Import', icon: UploadCloud, badge: 'Core' },
    { id: 'tests', label: 'Mock Tests & Pricing', icon: FileCheck },
    { id: 'live-tests', label: 'Live Tests', icon: Radio },
    { id: 'test-builder', label: 'Test Question Builder', icon: Layers },
    { id: 'notices', label: 'Notice Board', icon: Bell },
    { id: 'categories-exams', label: 'Categories & Exams', icon: FolderTree },
    { id: 'subjects', label: 'Subjects & Topics', icon: BookOpen },
    { id: 'content', label: 'Banners & Notices', icon: ImageIcon },
    { id: 'settings', label: 'System & Audit', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center font-extrabold text-white text-lg shadow-md">
              A
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-wide text-white leading-tight">ANDAMAN QUIZ</div>
              <div className="text-[10px] font-semibold text-brand-400 tracking-wider">ADMIN CONTROL</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-brand-900/50 text-brand-400 border border-brand-800'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
          Andaman Quiz v2026.1<br />
          Cloudflare Pages Ready
        </div>
      </aside>
    </>
  );
};
