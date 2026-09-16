import React, { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  Save,
  ChevronRight,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { fetchMockTests, saveMockTest, fetchQuestions, fetchSubjects } from '../firebase/firestore';
import { MockTest, Question, TestSection, Subject } from '../types';
import { Badge } from '../components/common/Badge';

interface TestBuilderProps {
  initialTestId?: string;
}

export const TestBuilder: React.FC<TestBuilderProps> = ({ initialTestId }) => {
  const [mockTests, setMockTests] = useState<MockTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>(initialTestId || '');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active section inside the selected test
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  // Question picker filters
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [selectedPickerIds, setSelectedPickerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, q, s] = await Promise.all([fetchMockTests(), fetchQuestions(1000), fetchSubjects()]);
      setMockTests(m);
      setAllQuestions(q);
      setSubjects(s);

      const targetId = initialTestId || (m[0]?.id ?? '');
      setSelectedTestId(targetId);

      const currentTest = m.find((t) => t.id === targetId) || m[0];
      if (currentTest && currentTest.sections.length > 0) {
        setActiveSectionId(currentTest.sections[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentTest = mockTests.find((t) => t.id === selectedTestId);
  const currentSection = currentTest?.sections.find((s) => s.id === activeSectionId);

  // Set of all question IDs already assigned across ALL sections in this test
  const assignedQuestionIds = new Set<string>();
  currentTest?.sections.forEach((sec) => {
    sec.questionIds.forEach((id) => assignedQuestionIds.add(id));
  });

  // Questions available in the picker (excluding already assigned to this test)
  const availableQuestions = allQuestions.filter((q) => {
    const isAlreadyAssigned = assignedQuestionIds.has(q.id);
    const matchesSearch = q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) || q.topic.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = subjectFilter === 'ALL' || q.subject === subjectFilter;
    return !isAlreadyAssigned && matchesSearch && matchesSubject;
  });

  const handleAddSection = () => {
    if (!currentTest) return;
    const secName = prompt('Enter new section name (e.g. Andaman GK & Administration):');
    if (!secName) return;

    const newSec: TestSection = {
      id: `sec_${Date.now()}`,
      name: secName.trim(),
      questionIds: [],
    };

    const updatedTest: MockTest = {
      ...currentTest,
      sections: [...currentTest.sections, newSec],
    };

    setMockTests(mockTests.map((t) => (t.id === updatedTest.id ? updatedTest : t)));
    setActiveSectionId(newSec.id);
  };

  const handleRemoveSection = (secId: string) => {
    if (!currentTest) return;
    if (currentTest.sections.length <= 1) {
      alert('A test must contain at least one section.');
      return;
    }
    if (confirm('Delete this section and remove its assigned questions?')) {
      const updatedTest: MockTest = {
        ...currentTest,
        sections: currentTest.sections.filter((s) => s.id !== secId),
      };
      setMockTests(mockTests.map((t) => (t.id === updatedTest.id ? updatedTest : t)));
      if (activeSectionId === secId) {
        setActiveSectionId(updatedTest.sections[0].id);
      }
    }
  };

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
  };

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

  const handleSaveToFirestore = async () => {
    if (!currentTest) return;
    setIsSaving(true);
    setActionFeedback(null);
    try {
      await saveMockTest(currentTest);
      setActionFeedback({
        type: 'success',
        message: `Successfully saved ${totalQuestionsInTest} questions across ${currentTest.sections.length} sections to Cloud Firestore!`
      });
    } catch (err: any) {
      console.error(err);
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to save test structure to Cloud Firestore.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalQuestionsInTest = currentTest?.sections.reduce((acc, s) => acc + s.questionIds.length, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Action Feedback Banner */}
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

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Test Question Builder</h1>
          <p className="text-xs text-slate-500 mt-1">
            Build section-wise CBT test papers by picking questions from the centralized Question Bank.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedTestId}
            onChange={(e) => {
              setSelectedTestId(e.target.value);
              const t = mockTests.find((m) => m.id === e.target.value);
              if (t && t.sections.length > 0) setActiveSectionId(t.sections[0].id);
            }}
            className="text-xs font-bold p-2.5 border border-slate-200 rounded-xl bg-white outline-none shadow-xs"
          >
            {mockTests.map((m) => (
              <option key={m.id} value={m.id}>{m.title} ({m.examCode})</option>
            ))}
          </select>

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
          {/* Status Breakdown Bar */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm">{currentTest.title}</span>
              <Badge variant="info">{currentTest.examCode}</Badge>
              <Badge variant={currentTest.isFree ? 'success' : 'warning'}>
                {currentTest.isFree ? 'FREE' : `PAID ₹${currentTest.price}`}
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-700">
                Total Questions: <span className="text-brand-600 text-sm font-black">{totalQuestionsInTest}</span>
              </span>
              <div className="flex items-center gap-2 text-slate-500">
                {currentTest.sections.map((sec) => (
                  <span key={sec.id} className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                    {sec.name}: {sec.questionIds.length}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Two-Pane Builder Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Sections and Current Questions (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Section Tabs */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-700">
                  <span>Sections ({currentTest.sections.length})</span>
                  <button
                    onClick={handleAddSection}
                    className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Section
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  {currentTest.sections.map((sec) => {
                    const isActive = sec.id === activeSectionId;
                    return (
                      <div
                        key={sec.id}
                        onClick={() => setActiveSectionId(sec.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition ${
                          isActive ? 'bg-brand-50 border border-brand-200 text-brand-900 font-bold' : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Layers size={14} className={isActive ? 'text-brand-600' : 'text-slate-400'} />
                          <span>{sec.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-full font-bold text-[10px]">
                            {sec.questionIds.length} Qs
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSection(sec.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Remove Section"
                          >
                            <Trash2 size={12} />
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
                    Questions in "{currentSection?.name}" ({currentSection?.questionIds.length || 0})
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {currentSection?.questionIds.map((qId, index) => {
                    const q = allQuestions.find((item) => item.id === qId);
                    return (
                      <div key={qId} className="p-3 flex items-start justify-between gap-3 text-xs hover:bg-slate-50">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 line-clamp-2">
                            {q?.question_text || `[Question ID: ${qId}]`}
                          </p>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex gap-2">
                            <span>{q?.subject || 'Subject'}</span>
                            <span>•</span>
                            <span>Ans: {q?.correct_answer || '-'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveQuestionFromSection(qId)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition shrink-0"
                          title="Remove from Section"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}

                  {(!currentSection || currentSection.questionIds.length === 0) && (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No questions added to this section yet. Select questions from the Question Bank on the right and click "Add Selected".
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Question Bank Picker (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Question Bank (Pick for "{currentSection?.name}")
                  </span>
                  {selectedPickerIds.size > 0 && (
                    <button
                      onClick={handleAddSelectedQuestions}
                      className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus size={14} /> Add {selectedPickerIds.size} Selected Questions
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search questions to add..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white outline-none"
                    />
                  </div>

                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="text-xs p-1.5 border border-slate-200 rounded-xl bg-white outline-none"
                  >
                    <option value="ALL">All Subjects</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Available Questions List */}
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
                        isSelected ? 'bg-brand-50/50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 mt-0.5 cursor-pointer"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="neutral">{q.subject}</Badge>
                          <Badge variant={q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Hard' ? 'danger' : 'warning'}>
                            {q.difficulty}
                          </Badge>
                          <span className="text-[10px] text-slate-400">{q.topic}</span>
                        </div>
                        <p className="font-medium text-slate-800 line-clamp-2">
                          {q.question_text}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {availableQuestions.length === 0 && (
                  <div className="p-12 text-center text-xs text-slate-400">
                    No unassigned questions found matching the filter.
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
