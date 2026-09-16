import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle2, Server, Globe, ExternalLink, RefreshCw } from 'lucide-react';
import { fetchRecentActivities } from '../firebase/firestore';
import { AdminActivity } from '../types';
import { auth } from '../firebase/config';

export const Settings: React.FC = () => {
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const acts = await fetchRecentActivities(25);
      setActivities(acts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const currentUser = auth.currentUser;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">System & Audit Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review backend security status, cloud synchronization, and administrator audit logs.
        </p>
      </div>

      {/* Deployment & Firebase Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Server size={16} className="text-brand-600" /> Infrastructure & Architecture Status
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-400 block mb-1">Backend Database</span>
            <span className="font-extrabold text-slate-800 text-sm">Google Cloud Firestore</span>
            <div className="mt-2 flex items-center gap-1.5 text-emerald-600 font-semibold text-[11px]">
              <CheckCircle2 size={13} /> Project: andaman-quiz
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-400 block mb-1">Web Admin Hosting</span>
            <span className="font-extrabold text-slate-800 text-sm">Cloudflare Pages</span>
            <div className="mt-2 flex items-center gap-1.5 text-sky-600 font-semibold text-[11px]">
              <Globe size={13} /> SPA Routing Enabled (_redirects)
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="font-bold text-slate-400 block mb-1">Current Active Admin</span>
            <span className="font-extrabold text-slate-800 text-sm truncate block">{currentUser?.email}</span>
            <div className="mt-2 flex items-center gap-1.5 text-brand-700 font-semibold text-[11px]">
              <Shield size={13} /> Verified Superadministrator
            </div>
          </div>
        </div>
      </div>

      {/* Complete Audit Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Administrator Activity Audit Log</h2>
            <p className="text-xs text-slate-500">Immutable record of changes made from the Web Admin</p>
          </div>
          <button
            onClick={loadActivities}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            title="Refresh Log"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {activities.map((act) => (
            <div key={act.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{act.action}</span>
                  <span className="text-[10px] text-slate-400">{new Date(act.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-slate-600 mt-0.5">{act.details}</p>
                <div className="text-[10px] text-slate-400 mt-1">Admin: {act.adminEmail}</div>
              </div>
            </div>
          ))}

          {activities.length === 0 && !loading && (
            <div className="p-8 text-center text-xs text-slate-400">
              No audit logs recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
