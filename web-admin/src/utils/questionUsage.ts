import { Question, MockTest, LiveTestItem, QuestionUsageSummary } from '../types';
import { saveMockTest, saveQuestion } from '../firebase/firestore';

/**
 * Computes canonical, relationship-driven question usage without duplicating data.
 * Checks Mock Test sections, linked Live Tests, and Practice eligibility.
 */
export function computeQuestionUsage(
  question: Question,
  mockTests: MockTest[],
  liveTests: LiveTestItem[] = []
): QuestionUsageSummary {
  // 1. Mock Test Usage (by checking whether any mock's sections contain this question ID)
  const referencingMocks = mockTests.filter((m) =>
    m.sections?.some((sec) => sec.questionIds?.includes(question.id))
  ).map((m) => ({
    id: m.id,
    title: m.title || 'Untitled Mock',
    examCode: m.examCode || '',
  }));

  // 2. Live Tests linked via those Mock Tests
  const linkedLiveTests: { id: string; title: string; mockTestId: string }[] = [];
  const mockIdSet = new Set(referencingMocks.map((m) => m.id));

  liveTests.forEach((lt) => {
    const linkedId = lt.testId || lt.mockTestId || '';
    if (mockIdSet.has(linkedId)) {
      linkedLiveTests.push({
        id: lt.id,
        title: lt.title || 'Live Test',
        mockTestId: linkedId,
      });
    }
  });

  // 3. Practice Assignment (independent of publication status)
  const rawUsage = (question.usageType || question.usage_type || 'BOTH').toUpperCase();
  const isEligibleUsage = rawUsage === 'PRACTICE' || rawUsage === 'BOTH';
  const hasTaxonomy = !!(question.exam && question.subject);
  const isPublished = question.status === 'published';

  // inPractice represents whether question is assigned to Practice
  const inPractice = isEligibleUsage && hasTaxonomy;

  // 4. Student Availability: Requires status === 'published' AND valid assignment
  const studentAvailable = isPublished && (inPractice || referencingMocks.length > 0);

  // 5. Status Badge (shows WHERE it is assigned, independent of publication status)
  let statusBadge: 'PRACTICE' | 'MOCK' | 'BOTH' | 'NOT_USED' = 'NOT_USED';
  if (inPractice && referencingMocks.length > 0) {
    statusBadge = 'BOTH';
  } else if (inPractice) {
    statusBadge = 'PRACTICE';
  } else if (referencingMocks.length > 0) {
    statusBadge = 'MOCK';
  } else {
    statusBadge = 'NOT_USED';
  }

  return {
    inPractice,
    practiceTaxonomy: hasTaxonomy
      ? { exam: question.exam, subject: question.subject, topic: question.topic }
      : undefined,
    mockTests: referencingMocks,
    liveTests: linkedLiveTests,
    studentAvailable,
    statusBadge,
  };
}

/**
 * Assigns a question to Practice by updating its usageType while preserving existing status.
 */
export async function assignQuestionToPractice(
  question: Question,
  isUsedInAnyMock: boolean = false
): Promise<Question> {
  const updated: Question = {
    ...question,
    // Preserve existing status; do NOT automatically publish drafts
    status: question.status || 'published',
    usageType: isUsedInAnyMock ? 'BOTH' : 'PRACTICE',
    usage_type: isUsedInAnyMock ? 'BOTH' : 'PRACTICE',
    updated_at: new Date().toISOString(),
  };
  await saveQuestion(updated);
  return updated;
}

/**
 * Removes a question from Practice while preserving Mock Test usage and existing status.
 * Determines real mock relationships from mockTests or boolean flag.
 * If question is in >= 1 mock: usageType = 'MOCK'.
 * If question is in 0 mocks: usageType = 'NOT_USED' (UNASSIGNED).
 */
export async function removeQuestionFromPractice(
  question: Question,
  allMockTestsOrIsUsedInAnyMock: MockTest[] | boolean = false
): Promise<Question> {
  let isUsedInAnyMock = false;
  if (typeof allMockTestsOrIsUsedInAnyMock === 'boolean') {
    isUsedInAnyMock = allMockTestsOrIsUsedInAnyMock;
  } else if (Array.isArray(allMockTestsOrIsUsedInAnyMock)) {
    isUsedInAnyMock = allMockTestsOrIsUsedInAnyMock.some((m) =>
      m.sections?.some((sec) => sec.questionIds?.includes(question.id))
    );
  }

  const nextUsage: 'MOCK' | 'NOT_USED' = isUsedInAnyMock ? 'MOCK' : 'NOT_USED';

  const updated: Question = {
    ...question,
    status: question.status || 'published',
    usageType: nextUsage,
    usage_type: nextUsage,
    updated_at: new Date().toISOString(),
  };
  await saveQuestion(updated);
  return updated;
}

/**
 * Assigns one or more questions to a Mock Test.
 * Automatically avoids duplicates, appends to the target section,
 * recalculates total questions & marks, and updates mock & question records.
 */
export async function assignQuestionsToMockTest(
  questionIds: string[],
  mockTestId: string,
  allMockTests: MockTest[],
  allQuestions: Question[] = [],
  targetSectionId?: string
): Promise<{ updatedMock: MockTest; newlyAssignedCount: number }> {
  const targetMock = allMockTests.find((m) => m.id === mockTestId);
  if (!targetMock) {
    throw new Error(`Mock Test with ID ${mockTestId} was not found.`);
  }

  // Ensure sections exist
  const sections = targetMock.sections && targetMock.sections.length > 0
    ? [...targetMock.sections.map((s) => ({ ...s, questionIds: [...(s.questionIds || [])] }))]
    : [{ id: 'sec_1', name: 'General Section', questionIds: [] }];

  // Find target section
  let section = targetSectionId ? sections.find((s) => s.id === targetSectionId) : sections[0];
  if (!section) {
    section = sections[0];
  }

  // Identify questions already in this mock across ANY section
  const existingInMock = new Set<string>();
  sections.forEach((s) => s.questionIds.forEach((id) => existingInMock.add(id)));

  let newlyAssigned = 0;
  questionIds.forEach((id) => {
    if (!existingInMock.has(id)) {
      section.questionIds.push(id);
      existingInMock.add(id);
      newlyAssigned++;
    }
  });

  // Recalculate Mock Metrics
  const totalQuestions = sections.reduce((acc, s) => acc + s.questionIds.length, 0);
  const totalMarks = sections.reduce((total, sec) => {
    return (
      total +
      sec.questionIds.reduce((secTotal, qId) => {
        const q = allQuestions.find((item) => item.id === qId);
        return secTotal + (q?.positive_marks ?? targetMock.positiveMarks ?? 2);
      }, 0)
    );
  }, 0);

  const updatedMock: MockTest = {
    ...targetMock,
    sections,
    totalQuestions,
    totalMarks,
  };

  await saveMockTest(updatedMock);

  // Update question usage types to BOTH (if eligible for practice) or MOCK
  for (const qId of questionIds) {
    const q = allQuestions.find((item) => item.id === qId);
    if (q) {
      const currentUsage = (q.usageType || q.usage_type || 'BOTH').toUpperCase();
      const nextUsage = (currentUsage === 'PRACTICE' || currentUsage === 'BOTH') ? 'BOTH' : 'MOCK';
      if (q.usageType !== nextUsage) {
        await saveQuestion({
          ...q,
          status: q.status || 'published',
          usageType: nextUsage,
          usage_type: nextUsage,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  return { updatedMock, newlyAssignedCount: newlyAssigned };
}

/**
 * Removes one or more questions from a Mock Test across all its sections.
 */
export async function removeQuestionsFromMockTest(
  questionIds: string[],
  mockTestId: string,
  allMockTests: MockTest[],
  allQuestions: Question[] = []
): Promise<MockTest> {
  const targetMock = allMockTests.find((m) => m.id === mockTestId);
  if (!targetMock || !targetMock.sections) {
    return targetMock || ({} as MockTest);
  }

  const removeSet = new Set(questionIds);
  const updatedSections = targetMock.sections.map((sec) => ({
    ...sec,
    questionIds: sec.questionIds.filter((id) => !removeSet.has(id)),
  }));

  const totalQuestions = updatedSections.reduce((acc, s) => acc + s.questionIds.length, 0);
  const totalMarks = updatedSections.reduce((total, sec) => {
    return (
      total +
      sec.questionIds.reduce((secTotal, qId) => {
        const q = allQuestions.find((item) => item.id === qId);
        return secTotal + (q?.positive_marks ?? targetMock.positiveMarks ?? 2);
      }, 0)
    );
  }, 0);

  const updatedMock: MockTest = {
    ...targetMock,
    sections: updatedSections,
    totalQuestions,
    totalMarks,
  };

  await saveMockTest(updatedMock);

  // Update question usage types based on remaining mock relationships
  const remainingMocks = allMockTests.map((m) => (m.id === mockTestId ? updatedMock : m));

  for (const qId of questionIds) {
    const q = allQuestions.find((item) => item.id === qId);
    if (q) {
      const stillInAnyMock = remainingMocks.some((m) =>
        m.sections?.some((sec) => sec.questionIds?.includes(qId))
      );
      const currentUsage = (q.usageType || q.usage_type || 'BOTH').toUpperCase();
      const isInPractice = currentUsage === 'PRACTICE' || currentUsage === 'BOTH';

      let nextUsage: 'PRACTICE' | 'MOCK' | 'BOTH' | 'NOT_USED';
      if (isInPractice && stillInAnyMock) {
        nextUsage = 'BOTH';
      } else if (isInPractice) {
        nextUsage = 'PRACTICE';
      } else if (stillInAnyMock) {
        nextUsage = 'MOCK';
      } else {
        nextUsage = 'NOT_USED';
      }

      if (q.usageType !== nextUsage || q.usage_type !== nextUsage) {
        await saveQuestion({
          ...q,
          status: q.status || 'published',
          usageType: nextUsage,
          usage_type: nextUsage,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  return updatedMock;
}
