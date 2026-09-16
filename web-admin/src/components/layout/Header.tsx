import React from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { logoutAdmin } from '../../firebase/auth';
import { auth } from '../../firebase/config';

export const Header: React.FC = () => {
  const email = auth.currentUser?.email || 'Administrator';

  const handleLogout = async () => {
    if (confirm('Are you sure you want to sign out of Andaman Quiz Admin?')) {
      await logoutAdmin();
      window.location.reload();
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Cloud Firestore Connected
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 pl-3">
          <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 font-bold text-xs">
            <ShieldCheck size={16} />
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-bold text-slate-800 leading-tight">{email}</div>
            <div className="text-[10px] text-slate-400 font-medium">Authorized Admin</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition border border-transparent hover:border-rose-100"
          title="Sign Out"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
