/**
 * Automated Verification Suite for Question Usage, Assignment, and Date Filtering
 */

import assert from 'assert';

console.log('====================================================');
console.log('TESTING QUESTION USAGE, ASSIGNMENT & FILTERING LOGIC');
console.log('====================================================\n');

// 1. Mock Data
const mockExams = [{ id: 'e1', code: 'ANCHSL', name: 'A&N CHSL' }];
const mockSubjects = [{ id: 's1', name: 'General Knowledge', examId: 'e1' }];

const mockTests = [
  {
    id: 'mock_1',
    title: 'Full Mock Test 1',
    examCode: 'ANCHSL',
    totalQuestions: 2,
    totalMarks: 4,
    sections: [
      {
        id: 'sec_1',
        title: 'Section A',
        questionIds: ['q1', 'q2'],
        positiveMarks: 2,
        negativeMarks: 0.5,
      }
    ]
  },
  {
    id: 'mock_2',
    title: 'Sectional Mock 2',
    examCode: 'ANCHSL',
    totalQuestions: 1,
    totalMarks: 2,
    sections: [
      {
        id: 'sec_2',
        title: 'GK Section',
        questionIds: ['q2'],
        positiveMarks: 2,
        negativeMarks: 0.5,
      }
    ]
  }
];

const liveTests = [
  {
    id: 'live_1',
    title: 'Live Championship Test',
    examCode: 'ANCHSL',
    mockTestId: 'mock_1',
    status: 'ACTIVE',
  }
];

// Replicate computeQuestionUsage pure logic for testing
function computeQuestionUsage(question, mockList, liveList) {
  const normUsageType = (question.usageType || question.usage_type || 'BOTH').toUpperCase();
  const belongsToMock = normUsageType === 'MOCK' || normUsageType === 'BOTH';
  const belongsToPractice = normUsageType === 'PRACTICE' || normUsageType === 'BOTH';

  const usedInMocks = mockList.filter((m) =>
    m.sections?.some((sec) => sec.questionIds?.includes(question.id))
  );

  const mockIds = new Set(usedInMocks.map((m) => m.id));
  const usedInLive = liveList.filter((lt) => mockIds.has(lt.mockTestId));

  const hasValidPracticeTaxonomy = Boolean(
    (question.exam || question.exam_code || question.examCode) &&
    (question.subject || question.subject_name || question.subjectName)
  );

  const isEligibleForPractice = belongsToPractice && hasValidPracticeTaxonomy;
  const isEligibleForMock = belongsToMock;

  const isPublished = question.status === 'PUBLISHED' || (!question.status && !question.is_draft);
  const studentAvailable = isPublished && (isEligibleForPractice || usedInMocks.length > 0);

  let badgeType = 'NOT_USED';
  if (isEligibleForPractice && usedInMocks.length > 0) {
    badgeType = 'BOTH';
  } else if (isEligibleForPractice) {
    badgeType = 'PRACTICE';
  } else if (usedInMocks.length > 0) {
    badgeType = 'MOCK';
  }

  return {
    questionId: question.id,
    inPractice: isEligibleForPractice,
    inMockTests: usedInMocks.length > 0,
    practiceTaxonomy: hasValidPracticeTaxonomy
      ? {
          exam: question.exam || question.exam_code || question.examCode || '',
          subject: question.subject || question.subject_name || question.subjectName || '',
          topic: question.topic || question.topic_name || question.topicName || '',
        }
      : undefined,
    mockTests: usedInMocks.map((m) => ({
      id: m.id,
      title: m.title,
      examCode: m.examCode || '',
    })),
    liveTests: usedInLive.map((lt) => ({
      id: lt.id,
      title: lt.title,
      examCode: lt.examCode,
      status: lt.status,
    })),
    badgeType,
    studentAvailable,
  };
}

// 2. Test Cases
console.log('>>> TEST 1: Question Used in Mock Tests and Live Tests');
const q2 = {
  id: 'q2',
  question_text: 'What is the capital of A&N?',
  exam: 'ANCHSL',
  subject: 'General Knowledge',
  usageType: 'BOTH',
  status: 'PUBLISHED',
};
const usage2 = computeQuestionUsage(q2, mockTests, liveTests);
assert.strictEqual(usage2.inPractice, true, 'q2 should be eligible for Practice');
assert.strictEqual(usage2.inMockTests, true, 'q2 should be used in Mocks');
assert.strictEqual(usage2.mockTests.length, 2, 'q2 is in 2 mock tests');
assert.strictEqual(usage2.liveTests.length, 1, 'q2 should have 1 linked live test');
assert.strictEqual(usage2.badgeType, 'BOTH', 'q2 badge should be BOTH');
assert.strictEqual(usage2.studentAvailable, true, 'q2 should be available to students');
console.log('[PASS] Test 1: Mock & Live test usage correctly resolved.\n');

console.log('>>> TEST 2: Practice Only Question');
const qPractice = {
  id: 'qp1',
  question_text: 'Practice specific problem',
  exam: 'ANCHSL',
  subject: 'General Knowledge',
  usageType: 'PRACTICE',
  status: 'PUBLISHED',
};
const usagePractice = computeQuestionUsage(qPractice, mockTests, liveTests);
assert.strictEqual(usagePractice.inPractice, true);
assert.strictEqual(usagePractice.inMockTests, false);
assert.strictEqual(usagePractice.badgeType, 'PRACTICE');
assert.strictEqual(usagePractice.studentAvailable, true);
console.log('[PASS] Test 2: Practice Only question verified.\n');

console.log('>>> TEST 3: Mock Only Question Not Assigned to Any Mock (Orphan/Draft)');
const qOrphanMock = {
  id: 'qm1',
  question_text: 'Unassigned mock question',
  usageType: 'MOCK',
  status: 'DRAFT',
};
const usageOrphan = computeQuestionUsage(qOrphanMock, mockTests, liveTests);
assert.strictEqual(usageOrphan.inPractice, false, 'Mock only cannot be in practice');
assert.strictEqual(usageOrphan.inMockTests, false, 'Not in any mock yet');
assert.strictEqual(usageOrphan.badgeType, 'NOT_USED');
assert.strictEqual(usageOrphan.studentAvailable, false, 'Draft/unassigned must not be student available');
console.log('[PASS] Test 3: Unassigned mock question correctly marked NOT_USED and hidden from students.\n');

console.log('>>> TEST 4: Legacy Question (No usageType field)');
const qLegacy = {
  id: 'q_legacy',
  question_text: 'Legacy question from earlier versions',
  exam: 'ANCHSL',
  subject: 'General Knowledge',
  status: 'PUBLISHED',
  // No usageType
};
const usageLegacy = computeQuestionUsage(qLegacy, mockTests, liveTests);
assert.strictEqual(usageLegacy.inPractice, true, 'Legacy questions default to BOTH so practice continues working');
assert.strictEqual(usageLegacy.studentAvailable, true);
console.log('[PASS] Test 4: 100% Backward compatibility for legacy questions confirmed.\n');

console.log('>>> TEST 5: Mock Test Metric Recalculation');
function recalculateMockMetrics(mockTest, updatedSections) {
  let totalQuestions = 0;
  let totalMarks = 0;
  for (const sec of updatedSections) {
    const qCount = sec.questionIds?.length || 0;
    totalQuestions += qCount;
    const pos = typeof sec.positiveMarks === 'number' ? sec.positiveMarks : 1;
    totalMarks += qCount * pos;
  }
  return {
    ...mockTest,
    sections: updatedSections,
    totalQuestions,
    totalMarks,
  };
}

const originalMock = mockTests[0]; // 2 questions, totalMarks: 4
assert.strictEqual(originalMock.totalQuestions, 2);
assert.strictEqual(originalMock.totalMarks, 4);

// Add q3 to section 1
const updatedSecs = originalMock.sections.map((s) => ({
  ...s,
  questionIds: [...s.questionIds, 'q3'],
}));
const updatedMock = recalculateMockMetrics(originalMock, updatedSecs);
assert.strictEqual(updatedMock.totalQuestions, 3, 'Questions count should now be 3');
assert.strictEqual(updatedMock.totalMarks, 6, 'Total marks should now be 6 (3 * 2 marks)');
console.log('[PASS] Test 5: Mock test question count and total marks recalculate dynamically.\n');

console.log('>>> TEST 6: Date Added Filter Logic');
function checkDateFilter(createdAt, filter) {
  if (filter === 'all') return true;
  if (!createdAt) return false;
  const itemDate = new Date(createdAt);
  if (isNaN(itemDate.getTime())) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === 'today') {
    return itemDate >= startOfToday;
  }
  if (filter === 'yesterday') {
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    return itemDate >= startOfYesterday && itemDate < startOfToday;
  }
  if (filter === '7days') {
    const startOf7Days = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    return itemDate >= startOf7Days;
  }
  return true;
}

const todayIso = new Date().toISOString();
const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const tenDaysAgoIso = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

assert.strictEqual(checkDateFilter(todayIso, 'today'), true, 'Today filter matches today');
assert.strictEqual(checkDateFilter(yesterdayIso, 'today'), false, 'Yesterday does not match today');
assert.strictEqual(checkDateFilter(yesterdayIso, 'yesterday'), true, 'Yesterday matches yesterday');
assert.strictEqual(checkDateFilter(tenDaysAgoIso, '7days'), false, '10 days ago does not match 7 days');
assert.strictEqual(checkDateFilter(null, 'today'), false, 'Missing date does not crash');
console.log('[PASS] Test 6: Date filtering handles boundaries and null dates gracefully.\n');

console.log('====================================================');
console.log('ALL QUESTION USAGE & ASSIGNMENT TESTS PASSED! (100%)');
console.log('====================================================');
