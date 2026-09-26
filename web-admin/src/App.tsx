import React, { useState, useEffect } from 'react';
import { onAdminAuthChanged } from './firebase/auth';
import { Login } from './pages/Login';
import { AdminLayout } from './components/layout/AdminLayout';
import { Dashboard } from './pages/Dashboard';
import { QuestionBank } from './pages/QuestionBank';
import { PracticeQuestions } from './pages/PracticeQuestions';
import { BulkImport } from './pages/BulkImport';
import { AiPdfImport } from './pages/AiPdfImport';
import { MockTests } from './pages/MockTests';
import { TestBuilder } from './pages/TestBuilder';
import { CategoriesExams } from './pages/CategoriesExams';
import { SubjectsTopics } from './pages/SubjectsTopics';
import { AppContent } from './pages/AppContent';
import { NoticeBoard } from './pages/NoticeBoard';
import { LiveTests } from './pages/LiveTests';
import { Settings } from './pages/Settings';
import { TestSeriesPage } from './pages/TestSeriesPage';
import { TestSeriesContentBuilder } from './pages/TestSeriesContentBuilder';
import { Loader2 } from 'lucide-react';

export function App() {
  const [authState, setAuthState] = useState<{
    isLoading: boolean;
    isAuthenticated: boolean;
  }>({
    isLoading: true,
    isAuthenticated: false,
  });

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [builderTestId, setBuilderTestId] = useState<string>('');
  const [builderSeriesId, setBuilderSeriesId] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAdminAuthChanged((user, isAuthorized) => {
      setAuthState({
        isLoading: false,
        isAuthenticated: !!user && isAuthorized,
      });
    });

    return () => unsubscribe();
  }, []);

  if (authState.isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="animate-spin text-brand-500" size={36} />
        <span className="text-xs font-semibold text-slate-400">Verifying Administrator Authorization...</span>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return <Login onLoginSuccess={() => setAuthState({ isLoading: false, isAuthenticated: true })} />;
  }

  return (
    <AdminLayout currentTab={currentTab} onSelectTab={setCurrentTab}>
      {currentTab === 'dashboard' && <Dashboard onNavigate={setCurrentTab} />}
      {currentTab === 'questions' && (
        <QuestionBank
          mode="all"
          onNavigateToMock={(testId) => {
            setBuilderTestId(testId);
            setCurrentTab('test-builder');
          }}
        />
      )}
      {currentTab === 'practice-questions' && (
        <PracticeQuestions onNavigateToTab={setCurrentTab} />
      )}
      {currentTab === 'import' && <BulkImport />}
      {currentTab === 'ai-pdf-import' && <AiPdfImport onNavigateToTab={setCurrentTab} />}
      {currentTab === 'tests' && (
        <MockTests
          onNavigateToBuilder={(testId) => {
            setBuilderTestId(testId);
            setCurrentTab('test-builder');
          }}
        />
      )}
      {currentTab === 'test-series' && (
        <TestSeriesPage
          onNavigateToBuilder={(seriesId) => {
            setBuilderSeriesId(seriesId);
            setCurrentTab('test-series-builder');
          }}
          onNavigateToMockBuilder={(testId) => {
            setBuilderTestId(testId);
            setCurrentTab('test-builder');
          }}
        />
      )}
      {currentTab === 'test-series-builder' && (
        <TestSeriesContentBuilder
          seriesId={builderSeriesId}
          onBack={() => setCurrentTab('test-series')}
          onNavigateToMockBuilder={(testId) => {
            setBuilderTestId(testId);
            setCurrentTab('test-builder');
          }}
        />
      )}
      {currentTab === 'live-tests' && <LiveTests />}
      {currentTab === 'test-builder' && (
        <TestBuilder
          initialTestId={builderTestId}
          onNavigate={setCurrentTab}
        />
      )}
      {currentTab === 'notices' && <NoticeBoard />}
      {currentTab === 'categories-exams' && <CategoriesExams />}
      {currentTab === 'subjects' && <SubjectsTopics />}
      {currentTab === 'content' && <AppContent />}
      {currentTab === 'settings' && <Settings />}
    </AdminLayout>
  );
}

export default App;
