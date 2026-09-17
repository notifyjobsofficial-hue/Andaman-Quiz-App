import React, { useEffect, useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  Save,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  FileCheck,
  Image as ImageIcon,
  CheckSquare,
  Square,
  AlertCircle,
  Loader2,
  ArrowRight,
  Filter
} from 'lucide-react';
import {
  fetchMockTests,
  saveMockTest,
  fetchQuestions,
  fetchExams,
  fetchSubjects,
  fetchTopics
} from '../firebase/firestore';
import { MockTest, Question, TestSection, Subject, Exam, Topic } from '../types';
import { Badge } from '../components/common/Badge';

interface TestBuilderProps {
  initialTestId?: string;
  onNavigate?: (tab: string) => void;
}

export const TestBuilder: React.FC<TestBuilderProps> = ({ initialTestId, onNavigate }) => {
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>(initialTestId || '');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active section inside the selected test
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  // Multi-Level Question Picker Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [examFilter, setExamFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [topicFilter, setTopicFilter] = useState('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState('ALL');

  // Selected for batch adding to active section
  const [selectedPickerIds, setSelectedPickerIds] = useState<Set<string>>(new Set());

  // Inline section creator state
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setActionFeedback(null);
    try {
      const [m, q, e, s, t] = await Promise.all([
        fetchMockTests(),
        fetchQuestions(2000),
        fetchExams().catch(() => []),
        fetchSubjects().catch(() => []),
        fetchTopics().catch(() => [])
      ]);

      setMockTests(m);
      setAllQuestions(q);
      setExams(e);
      setSubjects(s);
      setTopics(t);

      const targetId = initialTestId && m.some((test) => test.id === initialTestId)
        ? initialTestId
        : (m[0]?.id ?? '');
      setSelectedTestId(targetId);

      const current = m.find((test) => test.id === targetId) || m[0];
      if (current) {
        if (current.sections && current.sections.length > 0) {
          setActiveSectionId(current.sections[0].id);
        }
        if (current.examCode) {
          setExamFilter(current.examCode);
        }
      }
    } catch (err: any) {
      console.error('Failed to load data for TestBuilder:', err);
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to load test data from Cloud Firestore.'
      });
    } finally {
      setLoading(false);
    }
  };

  const currentTest = useMemo(() => {
    return mockTests.find((t) => t.id === selectedTestId);
  }, [mockTests, selectedTestId]);

  const currentSection = useMemo(() => {
    if (!currentTest || !currentTest.sections || currentTest.sections.length === 0) return null;
    return currentTest.sections.find((s) => s.id === activeSectionId) || currentTest.sections[0];
  }, [currentTest, activeSectionId]);

  // Set of all question IDs already assigned across ALL sections in this test
  const assignedQuestionIds = useMemo(() => {
    const ids = new Set<string>();
    currentTest?.sections.forEach((sec) => {
      sec.questionIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [currentTest]);

  // Filter topics based on chosen subjectFilter
  const availableTopicsForFilter = useMemo(() => {
    if (subjectFilter === 'ALL') return topics;
    const matchedSub = subjects.find((s) => s.name === subjectFilter);
    if (!matchedSub) return topics;
    return topics.filter((t) => t.subjectId === matchedSub.id);
  }, [subjectFilter, topics, subjects]);

  // Questions available in the picker (excluding already assigned to this test)
  const availableQuestions = useMemo(() => {
    return allQuestions.filter((q) => {
      // 1. Must not be already assigned to ANY section in this test
      if (assignedQuestionIds.has(q.id)) return false;

      // 2. Exam filter
      if (examFilter !== 'ALL' && q.exam !== examFilter) return false;

      // 3. Subject filter
      if (subjectFilter !== 'ALL' && q.subject !== subjectFilter) return false;

      // 4. Topic filter
      if (topicFilter !== 'ALL' && q.topic !== topicFilter) return false;

      // 5. Difficulty filter
      if (difficultyFilter !== 'ALL' && q.difficulty !== difficultyFilter) return false;

      // 6. Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesText = q.question_text.toLowerCase().includes(term);
        const matchesTopic = q.topic.toLowerCase().includes(term);
        const matchesId = q.id.toLowerCase().includes(term);
        if (!matchesText && !matchesTopic && !matchesId) return false;
      }

      return true;
    });
  }, [allQuestions, assignedQuestionIds, examFilter, subjectFilter, topicFilter, difficultyFilter, searchTerm]);

  // Total questions currently assigned across all sections
  const totalQuestionsInTest = useMemo(() => {
    return currentTest?.sections.reduce((acc, s) => acc + s.questionIds.length, 0) || 0;
  }, [currentTest]);

  // Calculated total marks based on assigned questions
  const calculatedTotalMarks = useMemo(() => {
    if (!currentTest) return 0;
    return currentTest.sections.reduce((total, sec) => {
      return (
        total +
        sec.questionIds.reduce((secTotal, qId) => {
          const q = allQuestions.find((item) => item.id === qId);
          return secTotal + (q?.positive_marks ?? currentTest.positiveMarks ?? 2);
        }, 0)
      );
    }, 0);
  }, [currentTest, allQuestions]);

  // Handle switching active mock test
  const handleSelectTest = (testId: string) => {
    setSelectedTestId(testId);
    setSelectedPickerIds(new Set());
    const t = mockTests.find((m) => m.id === testId);
    if (t) {
      if (t.sections && t.sections.length > 0) {
        setActiveSectionId(t.sections[0].id);
      } else {
        setActiveSectionId('');
      }
      if (t.examCode) {
        setExamFilter(t.examCode);
      }
    }
  };

  // Add Section (from subject or custom name)
  const handleAddSection = (nameToAdd?: string) => {
    if (!currentTest) return;
    const name = (nameToAdd || newSectionName).trim();
    if (!name) return;

    const newSec: TestSection = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name,
      questionIds: [],
    };

    const updatedTest: MockTest = {
      ...currentTest,
      sections: [...(currentTest.sections || []), newSec],
    };

    setMockTests(mockTests.map((t) => (t.id === updatedTest.id ? updatedTest : t)));
    setActiveSectionId(newSec.id);
    setNewSectionName('');
    setIsAddingSection(false);
  };

  // Remove Section
  const handleRemoveSection = (secId: string) => {
    if (!currentTest) return;
    if (currentTest.sections.length <= 1) {
      setActionFeedback({
        type: 'error',
        message: 'A mock test must contain at least one section.'
      });
      return;
    }

    if (confirm('Remove this section and all questions assigned to it?')) {
      const updatedSections = currentTest.sections.filter((s) => s.id !== secId);
      const totalQ = updatedSections.reduce((acc, s) => acc + s.questionIds.length, 0);

      const updatedTest: MockTest = {
        ...currentTest,
        totalQuestions: totalQ,
        sections: updatedSections,
      };

      setMockTests(mockTests.map((t) => (t.id === updatedTest.id ? updatedTest : t)));
      if (activeSectionId === secId) {
        setActiveSectionId(updatedSections[0].id);
      }
    }
  };

  // Move Question Up in Section Order
  const handleMoveQuestionUp = (index: number) => {
    if (!currentTest || !currentSection || index <= 0) return;

    const newQuestionIds = [...currentSection.questionIds];
    const temp = newQuestionIds[index - 1];
    newQuestionIds[index - 1] = newQuestionIds[index];
    newQuestionIds[index] = temp;

    const updatedSections = currentTest.sections.map((sec) =>
      sec.id === currentSection.id ? { ...sec, questionIds: newQuestionIds } : sec
    );

    const updatedTest: MockTest = {
      ...currentTest,
      sections: updatedSections,
    };

    setMockTests(mockTests.map((t) => (t.id === updatedTest.id ? updatedTest : t)));
  };

  // Move Question Down in Section Order
  const handleMoveQuestionDown = (index: number) => {
    if (!currentTest || !currentSection || index >= currentSection.questionIds.length - 1) return;

    const newQuestionIds = [...currentSection.questionIds];
    const temp = newQuestionIds[index + 1];
    newQuestionIds[index + 1] = newQuestionIds[index];
    newQuestionIds[index] = temp;

    const updatedSections = currentTest.sections.map((sec) =>
      sec.id === currentSection.id ? { ...sec, questionIds: newQuestionIds } : sec
    );

    const updatedTest: MockTest = {
      ...currentTest,
      sections: updatedSections,
    };

    setMockTests(mockTests.map((t) => (t.id === updatedTest.id ? updatedTest : t)));
  };

  // Add Selected Questions to Active Section
  const handleAddSelectedQuestions = () => {
    if (!currentTest || !currentSection || selectedPickerIds.size === 0) return;

    const updatedSections = currentTest.sections.map((sec) => {
      if (sec.id === currentSection.id) {
        return {
          ...sec,
          questionIds: [...sec.questionIds, ...Array.from(selectedPickerIds)],
        };
      }
      return sec;
    });

    const totalQ = updatedSections.reduce((acc, s) => acc + s.questionIds.length, 0);

    const updatedTest: MockTest = {
      ...currentTest,
      totalQuestions: totalQ,
      sections: updatedSections,
    };

    setMockTests(mockTests.map((t) => (t.id === updatedTest.id ? updatedTest : t)));
    setSelectedPickerIds(new Set());
    setActionFeedback({
      type: 'success',
      message: `Added questions to section "${currentSection.name}". Click "Save Test Questions" when finished.`
    });
  };

  // Remove Question from Section
  const handleRemoveQuestionFromSection = (qId: string) => {
    if (!currentTest || !currentSection) return;

    const updatedSections = currentTest.sections.map((sec) => {
      if (sec.id === currentSection.id) {
        return {
          ...sec,
          questionIds: sec.questionIds.filter((id) => id !== qId),
        };
      }
      return sec;
    });

    const totalQ = updatedSections.reduce((acc, s) => acc + s.questionIds.length, 0);

    const updatedTest: MockTest = {
      ...currentTest,
      totalQuestions: totalQ,
      sections: updatedSections,
    };

    setMockTests(mockTests.map((t) => (t.id === updatedTest.id ? updatedTest : t)));
  };

  // Select / Deselect All Filtered Questions in Question Bank
  const handleToggleSelectAllFiltered = () => {
    const allFilteredIds = availableQuestions.map((q) => q.id);
    const areAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedPickerIds.has(id));

    if (areAllSelected) {
      // Deselect all filtered
      const next = new Set(selectedPickerIds);
      allFilteredIds.forEach((id) => next.delete(id));
      setSelectedPickerIds(next);
    } else {
      // Select all filtered
      const next = new Set(selectedPickerIds);
      allFilteredIds.forEach((id) => next.add(id));
      setSelectedPickerIds(next);
    }
  };

  // Save Test Structure to Cloud Firestore
  const handleSaveToFirestore = async () => {
    if (!currentTest) return;

    setIsSaving(true);
    setActionFeedback(null);

    try {
      const updatedTest: MockTest = {
        ...currentTest,
        totalQuestions: totalQuestionsInTest,
      };

      await saveMockTest(updatedTest);

      // Update mockTests state
      setMockTests(mockTests.map((t) => (t.id === updatedTest.id ? updatedTest : t)));

      setActionFeedback({
        type: 'success',
        message: `Successfully saved ${totalQuestionsInTest} questions across ${currentTest.sections.length} sections to Cloud Firestore! Students will now see these exact questions.`
      });
    } catch (err: any) {
      console.error('Error saving mock test questions to Firestore:', err);
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to save test structure to Cloud Firestore.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-brand-600" size={36} />
        <span className="text-xs font-semibold text-slate-500">
          Loading Mock Tests and Question Bank from Cloud Firestore...
        </span>
      </div>
    );
  }

  // Empty State: No Mock Tests in Firestore
  if (mockTests.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-xl mx-auto my-12 shadow-sm space-y-4">
        <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto">
          <FileCheck size={32} />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">Create a mock test first.</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          There are no mock tests configured in Cloud Firestore yet. Please create a mock test under
          <strong> Mock Tests & Pricing</strong> before building sections and assigning questions.
        </p>
        <button
          onClick={() => onNavigate?.('tests')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
        >
          <span>Go to Mock Tests & Pricing</span>
          <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  // Empty State: Question Bank is Empty
  if (allQuestions.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-xl mx-auto my-12 shadow-sm space-y-4">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
          <HelpCircle size={32} />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">Import or create questions first.</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          The Question Bank is currently empty in Cloud Firestore. Add questions manually in the
          <strong> Question Bank</strong> or upload hundreds of questions at once via <strong>Bulk Import</strong>.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate?.('import')}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            Go to Bulk Import
          </button>
          <button
            onClick={() => onNavigate?.('questions')}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            Go to Question Bank
          </button>
        </div>
      </div>
    );
  }

  const areAllFilteredSelected =
    availableQuestions.length > 0 && availableQuestions.every((q) => selectedPickerIds.has(q.id));

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle size={15} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs px-2 py-0.5 rounded hover:bg-black/5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Test Question Builder</h1>
          <p className="text-xs text-slate-500 mt-1">
            Build section-wise CBT test papers by picking questions from the centralized Question Bank.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mock Test Selector Dropdown */}
          <select
            value={selectedTestId}
            onChange={(e) => handleSelectTest(e.target.value)}
            className="text-xs font-bold p-2.5 border border-slate-200 rounded-xl bg-white outline-none shadow-xs text-slate-800 min-w-[240px]"
          >
            {mockTests.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.examCode}) • {m.isFree ? 'FREE' : 'PAID'}
              </option>
            ))}
          </select>

          {/* Save Questions Button */}
          <button
            onClick={handleSaveToFirestore}
            disabled={isSaving || !currentTest}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
          >
            <Save size={14} />
            <span>{isSaving ? 'Saving...' : 'Save Test Questions'}</span>
          </button>
        </div>
      </div>

      {currentTest && (
        <>
          {/* Test Status Breakdown Bar */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-800 text-sm">{currentTest.title}</span>
              <Badge variant="info">{currentTest.examCode}</Badge>
              <Badge variant={currentTest.isFree ? 'success' : 'warning'}>
                {currentTest.isFree ? 'FREE' : `PAID ₹${currentTest.offerPrice || currentTest.price || 99}`}
              </Badge>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 font-semibold">{currentTest.durationMinutes} mins</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 font-semibold">Target: {currentTest.totalMarks} Marks</span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <span className="font-bold text-slate-700">
                Assigned Questions:{' '}
                <span className="text-brand-600 text-sm font-black">{totalQuestionsInTest}</span>
              </span>
              <span className="font-bold text-slate-700">
                Calculated Marks:{' '}
                <span className="text-emerald-700 text-sm font-black">{calculatedTotalMarks}</span>
                <span className="text-[10px] text-slate-400 ml-1">
                  (+{currentTest.positiveMarks ?? 2} / -{currentTest.negativeMarks ?? 0.5})
                </span>
              </span>
            </div>
          </div>

          {/* Two-Pane Builder Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Sections and Assigned Questions (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Sections List */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-700">
                  <span>Sections ({currentTest.sections?.length || 0})</span>
                  <button
                    onClick={() => setIsAddingSection(!isAddingSection)}
                    className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Section
                  </button>
                </div>

                {/* Inline Section Adder */}
                {isAddingSection && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 block">Quick-add from Curriculum:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {subjects.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleAddSection(sub.name)}
                          className="text-[10px] px-2 py-1 bg-white hover:bg-brand-50 hover:text-brand-700 border border-slate-200 rounded-lg font-semibold transition"
                        >
                          + {sub.name}
                        </button>
                      ))}
                    </div>

                    <div className="pt-1 flex gap-2">
                      <input
                        type="text"
                        placeholder="Or type custom section name..."
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        className="text-xs p-2 border border-slate-200 rounded-lg flex-1 bg-white outline-none"
                      />
                      <button
                        onClick={() => handleAddSection()}
                        disabled={!newSectionName.trim()}
                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Section Selection Cards */}
                <div className="flex flex-col gap-1.5">
                  {currentTest.sections?.map((sec) => {
                    const isActive = sec.id === (currentSection?.id || activeSectionId);
                    return (
                      <div
                        key={sec.id}
                        onClick={() => setActiveSectionId(sec.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition ${
                          isActive
                            ? 'bg-brand-50 border border-brand-300 text-brand-900 font-bold shadow-xs'
                            : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Layers size={14} className={isActive ? 'text-brand-600 shrink-0' : 'text-slate-400 shrink-0'} />
                          <span className="truncate">{sec.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-full font-bold text-[10px] text-slate-700">
                            {sec.questionIds.length} Qs
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSection(sec.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Remove Section"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Questions in Active Section */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-800">
                    Questions in "{currentSection?.name || 'Section'}" ({currentSection?.questionIds.length || 0})
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Use arrows to reorder</span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {currentSection?.questionIds.map((qId, index) => {
                    const q = allQuestions.find((item) => item.id === qId);
                    const isFirst = index === 0;
                    const isLast = index === currentSection.questionIds.length - 1;

                    return (
                      <div key={qId} className="p-3 flex items-start justify-between gap-2.5 text-xs hover:bg-slate-50">
                        {/* Number Index */}
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                          {index + 1}
                        </span>

                        {/* Question Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {q?.question_image_url && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-brand-700 bg-brand-50 px-1 rounded border border-brand-100">
                                <ImageIcon size={9} /> Image
                              </span>
                            )}
                            <span className="text-[10px] font-semibold text-slate-400 truncate">
                              {q?.subject || 'Subject'} • {q?.topic || 'Topic'}
                            </span>
                          </div>

                          <p className="font-medium text-slate-800 line-clamp-2">
                            {q?.question_text || `[Question: ${qId}]`}
                          </p>

                          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                            <span className="font-bold text-emerald-700">Ans: Option {q?.correct_answer || 'A'}</span>
                            <span>•</span>
                            <span>+{q?.positive_marks ?? 2} / -{q?.negative_marks ?? 0.5}</span>
                          </div>
                        </div>

                        {/* Order and Remove Controls */}
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          <button
                            onClick={() => handleMoveQuestionUp(index)}
                            disabled={isFirst}
                            className="p-1 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100 transition disabled:opacity-20"
                            title="Move Up"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => handleMoveQuestionDown(index)}
                            disabled={isLast}
                            className="p-1 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100 transition disabled:opacity-20"
                            title="Move Down"
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            onClick={() => handleRemoveQuestionFromSection(qId)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                            title="Remove from Section"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {(!currentSection || currentSection.questionIds.length === 0) && (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No questions assigned to this section yet.
                      <br />
                      Select questions from the Question Bank on the right and click "Add Selected".
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Question Bank Picker with Multi-Level Filters (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Question Bank (Pick for "{currentSection?.name || 'Section'}")
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {availableQuestions.length} unassigned questions match filters
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Select / Deselect All Filtered */}
                    {availableQuestions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleToggleSelectAllFiltered}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        {areAllFilteredSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                        <span>{areAllFilteredSelected ? 'Deselect All' : 'Select All Filtered'}</span>
                      </button>
                    )}

                    {/* Add Selected Button */}
                    {selectedPickerIds.size > 0 && (
                      <button
                        onClick={handleAddSelectedQuestions}
                        className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus size={14} /> Add {selectedPickerIds.size} Selected
                      </button>
                    )}
                  </div>
                </div>

                {/* Multi-Level Filters Grid: Exam -> Subject -> Topic -> Difficulty */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                  {/* Exam Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Exam</label>
                    <select
                      value={examFilter}
                      onChange={(e) => setExamFilter(e.target.value)}
                      className="w-full text-xs p-1.5 border border-slate-200 rounded-lg bg-white outline-none"
                    >
                      <option value="ALL">All Exams</option>
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.code}>{ex.name} ({ex.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Subject Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Subject</label>
                    <select
                      value={subjectFilter}
                      onChange={(e) => {
                        setSubjectFilter(e.target.value);
                        setTopicFilter('ALL');
                      }}
                      className="w-full text-xs p-1.5 border border-slate-200 rounded-lg bg-white outline-none"
                    >
                      <option value="ALL">All Subjects</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Topic Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Topic</label>
                    <select
                      value={topicFilter}
                      onChange={(e) => setTopicFilter(e.target.value)}
                      className="w-full text-xs p-1.5 border border-slate-200 rounded-lg bg-white outline-none"
                    >
                      <option value="ALL">All Topics</option>
                      {availableTopicsForFilter.map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Difficulty Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Difficulty</label>
                    <select
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                      className="w-full text-xs p-1.5 border border-slate-200 rounded-lg bg-white outline-none"
                    >
                      <option value="ALL">All Difficulties</option>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search question text, keyword, topic or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white outline-none"
                  />
                </div>
              </div>

              {/* Available Questions List with Rich Display */}
              <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[600px]">
                {availableQuestions.map((q) => {
                  const isSelected = selectedPickerIds.has(q.id);

                  return (
                    <div
                      key={q.id}
                      onClick={() => {
                        const next = new Set(selectedPickerIds);
                        if (next.has(q.id)) next.delete(q.id);
                        else next.add(q.id);
                        setSelectedPickerIds(next);
                      }}
                      className={`p-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition text-xs ${
                        isSelected ? 'bg-brand-50/60' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 mt-0.5 cursor-pointer shrink-0"
                      />

                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Meta Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="neutral">{q.subject}</Badge>
                          <Badge
                            variant={
                              q.difficulty === 'Easy'
                                ? 'success'
                                : q.difficulty === 'Hard'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {q.difficulty}
                          </Badge>
                          <span className="text-[10px] text-slate-400 truncate">{q.topic}</span>
                          {q.exam && <span className="text-[10px] text-slate-400">({q.exam})</span>}
                          <span className="text-[10px] font-semibold text-slate-400 ml-auto">
                            +{q.positive_marks} / -{q.negative_marks}
                          </span>
                        </div>

                        {/* Question Text */}
                        <p className="font-medium text-slate-800 line-clamp-2 leading-relaxed">
                          {q.question_text || '[Image Question]'}
                        </p>

                        {/* Image Indicator if question has image */}
                        {q.question_image_url && (
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-brand-700 pt-0.5">
                            <ImageIcon size={11} />
                            <span>Question includes diagram/image</span>
                          </div>
                        )}

                        {/* Option Indicators & Correct Answer */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              q.correct_answer === 'A'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            A: {q.option_a_text ? q.option_a_text.slice(0, 18) : (q.option_a_image_url ? '[Img]' : '-')}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              q.correct_answer === 'B'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            B: {q.option_b_text ? q.option_b_text.slice(0, 18) : (q.option_b_image_url ? '[Img]' : '-')}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              q.correct_answer === 'C'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            C: {q.option_c_text ? q.option_c_text.slice(0, 18) : (q.option_c_image_url ? '[Img]' : '-')}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold ${
                              q.correct_answer === 'D'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            D: {q.option_d_text ? q.option_d_text.slice(0, 18) : (q.option_d_image_url ? '[Img]' : '-')}
                          </span>
                          <span className="font-extrabold text-emerald-700 ml-1">
                            ✓ Correct: Option {q.correct_answer}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {availableQuestions.length === 0 && (
                  <div className="p-12 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-600">No unassigned questions found.</p>
                    <p>Try adjusting your exam, subject, topic, or difficulty filters above.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
