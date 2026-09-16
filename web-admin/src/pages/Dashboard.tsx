import React, { useEffect, useState } from 'react';
import {
  FolderTree,
  BookOpen,
  HelpCircle,
  FileCheck,
  PlusCircle,
  UploadCloud,
  Layers,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Lock
} from 'lucide-react';
import {
  fetchExams,
  fetchCategories,
  fetchSubjects,
  fetchQuestions,
  fetchMockTests,
  fetchRecentActivities
} from '../firebase/firestore';
import { Exam, ExamCategory, Subject, Question, MockTest, AdminActivity } from '../types';
import { Badge } from '../components/common/Badge';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [activities, setActivities] = useState<AdminActivity[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ex, cat, sub, q, m, act] = await Promise.all([
        fetchExams().catch(() => []),
        fetchCategories().catch(() => []),
        fetchSubjects().catch(() => []),
        fetchQuestions(500).catch(() => []),
        fetchMockTests().catch(() => []),
        fetchRecentActivities(8).catch(() => []),
      ]);
      setExams(ex);
      setCategories(cat);
      setSubjects(sub);
      setQuestions(q);
      setMockTests(m);
      setActivities(act);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const freeTestsCount = mockTests.filter((t) => t.isFree).length;
  const paidTestsCount = mockTests.filter((t) => !t.isFree).length;
  const publishedTestsCount = mockTests.filter((t) => t.status === 'published').length;
  const draftTestsCount = mockTests.filter((t) => t.status === 'draft').length;

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30 mb-3">
            <ShieldCheck size={14} /> Production Administrator Console
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Andaman Quiz Overview</h1>
          <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-xl">
            Live database controls for competitive examinations, questions bank, and Free/Paid mock test series.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => onNavigate('import')}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-600/30"
          >
            <UploadCloud size={16} />
            <span>Bulk Import</span>
          </button>
          <button
            onClick={() => onNavigate('questions')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition border border-slate-700"
          >
            <PlusCircle size={16} />
            <span>Add Question</span>
          </button>
          <button
            onClick={() => onNavigate('tests')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Layers size={16} />
            <span>New Mock Test</span>
          </button>
        </div>
      </div>

      {/* Primary Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Questions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question Bank</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <HelpCircle size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
            {loading ? '...' : questions.length}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-emerald-600">Active Questions</span>
          </div>
        </div>

        {/* Mock Tests */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Mock Tests</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileCheck size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
            {loading ? '...' : mockTests.length}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span className="text-emerald-700 font-bold">{freeTestsCount} Free</span>
            <span>•</span>
            <span className="text-amber-700 font-bold">{paidTestsCount} Paid</span>
          </div>
        </div>

        {/* Exams Catalog */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Exams</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FolderTree size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
            {loading ? '...' : exams.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            <span>Across {categories.length} Categories</span>
          </div>
        </div>

        {/* Subjects */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Curriculum Subjects</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <BookOpen size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
            {loading ? '...' : subjects.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            <span>Specialized A&N + SSC syllabus</span>
          </div>
        </div>
      </div>

      {/* Tests Breakdown Badges */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
        <span className="font-bold text-slate-700">Exam Series Status:</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold">
            Published: {publishedTestsCount}
          </span>
          <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold">
            Drafts: {draftTestsCount}
          </span>
          <span className="px-3 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full font-bold">
            Free Access: {freeTestsCount}
          </span>
          <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-bold">
            Paid Access: {paidTestsCount}
          </span>
        </div>
      </div>

      {/* Two Column Layout: Recent Tests & Recent Admin Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Mock Tests */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Mock Tests</h2>
              <p className="text-xs text-slate-500">Live published and draft examinations</p>
            </div>
            <button
              onClick={() => onNavigate('tests')}
              className="text-xs font-bold text-brand-600 hover:text-brand-700"
            >
              View All Tests →
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {mockTests.slice(0, 5).map((test) => (
              <div key={test.id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">{test.title}</span>
                    <Badge variant={test.isFree ? 'success' : 'warning'}>
                      {test.isFree ? 'FREE' : `PAID ₹${test.price || 99}`}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {test.examCode} • {test.totalQuestions} Questions • {test.durationMinutes} mins • {test.totalMarks} Marks
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    test.status === 'published' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 bg-slate-100'
                  }`}>
                    {test.status}
                  </span>
                </div>
              </div>
            ))}

            {mockTests.length === 0 && !loading && (
              <div className="p-8 text-center text-xs text-slate-400">
                No mock tests configured yet. Click "New Mock Test" to create one.
              </div>
            )}
          </div>
        </div>

        {/* Recent Admin Activity Log */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Audit Activity</h2>
            <Clock size={16} className="text-slate-400" />
          </div>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {activities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 text-xs">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 size={12} className="text-brand-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-800">{act.action}</div>
                  <p className="text-slate-500 text-[11px] leading-tight mt-0.5">{act.details}</p>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {act.adminEmail} • {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {activities.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                No recent activity logged.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
