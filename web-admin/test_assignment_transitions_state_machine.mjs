import assert from 'assert';

console.log('====================================================');
console.log('TESTING COMPLETE ASSIGNMENT STATE MACHINE & TRANSITIONS');
console.log('====================================================\n');

// 1. Core relationship and usage computation
function computeQuestionUsage(question, mockTests, liveTests = []) {
  const referencingMocks = mockTests.filter((m) =>
    m.sections?.some((sec) => sec.questionIds?.includes(question.id))
  ).map((m) => ({
    id: m.id,
    title: m.title || 'Untitled Mock',
    examCode: m.examCode || '',
  }));

  const rawUsage = (question.usageType || question.usage_type || 'BOTH').toUpperCase();
  const isEligibleUsage = rawUsage === 'PRACTICE' || rawUsage === 'BOTH';
  const hasTaxonomy = !!(question.exam && question.subject);
  const isPublished = question.status === 'published';

  const inPractice = isEligibleUsage && hasTaxonomy;
  const studentAvailable = isPublished && (inPractice || referencingMocks.length > 0);

  let statusBadge = 'NOT_USED';
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
    mockTests: referencingMocks,
    studentAvailable,
    statusBadge,
  };
}

// 2. Transition functions matching production logic
function assignToPractice(question, mockTests) {
  const isUsedInAnyMock = mockTests.some((m) =>
    m.sections?.some((sec) => sec.questionIds?.includes(question.id))
  );
  const nextUsage = isUsedInAnyMock ? 'BOTH' : 'PRACTICE';
  return {
    ...question,
    status: question.status || 'published', // preserves status
    usageType: nextUsage,
    usage_type: nextUsage,
  };
}

function removeFromPractice(question, mockTests) {
  const isUsedInAnyMock = mockTests.some((m) =>
    m.sections?.some((sec) => sec.questionIds?.includes(question.id))
  );
  const nextUsage = isUsedInAnyMock ? 'MOCK' : 'NOT_USED';
  return {
    ...question,
    status: question.status || 'published', // preserves status
    usageType: nextUsage,
    usage_type: nextUsage,
  };
}

function assignToMock(question, targetMockId, allMockTests) {
  const updatedMocks = allMockTests.map((m) => {
    if (m.id === targetMockId) {
      const sec0 = m.sections?.[0] || { id: 's1', questionIds: [] };
      const qIds = Array.from(new Set([...sec0.questionIds, question.id]));
      return {
        ...m,
        sections: [{ ...sec0, questionIds: qIds }],
      };
    }
    return m;
  });

  const currentUsage = (question.usageType || question.usage_type || 'BOTH').toUpperCase();
  const isInPractice = currentUsage === 'PRACTICE' || currentUsage === 'BOTH';
  const nextUsage = isInPractice ? 'BOTH' : 'MOCK';

  const updatedQ = {
    ...question,
    status: question.status || 'published', // preserves status
    usageType: nextUsage,
    usage_type: nextUsage,
  };

  return { updatedQ, updatedMocks };
}

function removeFromMock(question, targetMockId, allMockTests) {
  const updatedMocks = allMockTests.map((m) => {
    if (m.id === targetMockId) {
      const updatedSecs = (m.sections || []).map((sec) => ({
        ...sec,
        questionIds: sec.questionIds.filter((id) => id !== question.id),
      }));
      return {
        ...m,
        sections: updatedSecs,
      };
    }
    return m;
  });

  const stillInAnyMock = updatedMocks.some((m) =>
    m.sections?.some((sec) => sec.questionIds?.includes(question.id))
  );
  const currentUsage = (question.usageType || question.usage_type || 'BOTH').toUpperCase();
  const isInPractice = currentUsage === 'PRACTICE' || currentUsage === 'BOTH';

  let nextUsage;
  if (isInPractice && stillInAnyMock) {
    nextUsage = 'BOTH';
  } else if (isInPractice) {
    nextUsage = 'PRACTICE';
  } else if (stillInAnyMock) {
    nextUsage = 'MOCK';
  } else {
    nextUsage = 'NOT_USED';
  }

  const updatedQ = {
    ...question,
    status: question.status || 'published', // preserves status
    usageType: nextUsage,
    usage_type: nextUsage,
  };

  return { updatedQ, updatedMocks };
}

// Initial mock test fixtures
let mockTests = [
  { id: 'mock_1', title: 'AN CHSL Mock 01', examCode: 'ANCHSL', sections: [{ id: 's1', questionIds: [] }] },
  { id: 'mock_2', title: 'AN CHSL Mock 02', examCode: 'ANCHSL', sections: [{ id: 's2', questionIds: [] }] },
];

// ====================================================
// STATE MACHINE TEST SCENARIOS
// ====================================================

// --- TRANSITION 1: UNASSIGNED -> Assign Practice = PRACTICE ---
console.log('>>> TRANSITION 1: UNASSIGNED -> Assign Practice = PRACTICE');
let q = {
  id: 'q_sm_test',
  question_text: 'State Machine Test Question',
  exam: 'ANCHSL',
  subject: 'General Awareness',
  topic: 'History',
  status: 'published',
  usageType: 'NOT_USED',
  usage_type: 'NOT_USED',
};

let usage = computeQuestionUsage(q, mockTests);
assert.strictEqual(q.usageType, 'NOT_USED');
assert.strictEqual(usage.statusBadge, 'NOT_USED');
assert.strictEqual(usage.studentAvailable, false);

q = assignToPractice(q, mockTests);
usage = computeQuestionUsage(q, mockTests);
assert.strictEqual(q.usageType, 'PRACTICE');
assert.strictEqual(q.usage_type, 'PRACTICE');
assert.strictEqual(usage.statusBadge, 'PRACTICE');
assert.strictEqual(usage.inPractice, true);
assert.strictEqual(usage.studentAvailable, true);
console.log('[PASS] Transition 1: UNASSIGNED -> Assign Practice = PRACTICE\n');

// --- TRANSITION 2: PRACTICE -> Assign Mock = BOTH ---
console.log('>>> TRANSITION 2: PRACTICE -> Assign Mock = BOTH');
let res = assignToMock(q, 'mock_1', mockTests);
q = res.updatedQ;
mockTests = res.updatedMocks;
usage = computeQuestionUsage(q, mockTests);
assert.strictEqual(q.usageType, 'BOTH');
assert.strictEqual(q.usage_type, 'BOTH');
assert.strictEqual(usage.statusBadge, 'BOTH');
assert.strictEqual(usage.mockTests.length, 1);
assert.strictEqual(usage.mockTests[0].title, 'AN CHSL Mock 01');
assert.strictEqual(usage.studentAvailable, true);
console.log('[PASS] Transition 2: PRACTICE -> Assign Mock = BOTH\n');

// --- TRANSITION 3: BOTH -> Assign second Mock = BOTH ---
console.log('>>> TRANSITION 3: BOTH -> Assign second Mock = BOTH');
res = assignToMock(q, 'mock_2', mockTests);
q = res.updatedQ;
mockTests = res.updatedMocks;
usage = computeQuestionUsage(q, mockTests);
assert.strictEqual(q.usageType, 'BOTH');
assert.strictEqual(usage.mockTests.length, 2);
console.log('[PASS] Transition 3: BOTH -> Assign second Mock = BOTH\n');

// --- TRANSITION 4: BOTH -> Remove one of several Mocks = BOTH ---
console.log('>>> TRANSITION 4: BOTH -> Remove one of several Mocks = BOTH');
res = removeFromMock(q, 'mock_2', mockTests);
q = res.updatedQ;
mockTests = res.updatedMocks;
usage = computeQuestionUsage(q, mockTests);
assert.strictEqual(q.usageType, 'BOTH');
assert.strictEqual(usage.statusBadge, 'BOTH');
assert.strictEqual(usage.mockTests.length, 1);
assert.strictEqual(usage.mockTests[0].id, 'mock_1');
console.log('[PASS] Transition 4: BOTH -> Remove one of several Mocks = BOTH\n');

// --- TRANSITION 5: BOTH -> Remove Practice = MOCK ---
console.log('>>> TRANSITION 5: BOTH -> Remove Practice = MOCK');
q = removeFromPractice(q, mockTests);
usage = computeQuestionUsage(q, mockTests);
assert.strictEqual(q.usageType, 'MOCK');
assert.strictEqual(q.usage_type, 'MOCK');
assert.strictEqual(usage.statusBadge, 'MOCK');
assert.strictEqual(usage.inPractice, false);
assert.strictEqual(usage.mockTests.length, 1);
assert.strictEqual(usage.mockTests[0].title, 'AN CHSL Mock 01');
assert.strictEqual(usage.studentAvailable, true, 'Still student available via mock');
console.log('[PASS] Transition 5: BOTH -> Remove Practice = MOCK\n');

// --- TRANSITION 6: MOCK -> Assign Practice = BOTH ---
console.log('>>> TRANSITION 6: MOCK -> Assign Practice = BOTH');
q = assignToPractice(q, mockTests);
usage = computeQuestionUsage(q, mockTests);
assert.strictEqual(q.usageType, 'BOTH');
assert.strictEqual(usage.statusBadge, 'BOTH');
assert.strictEqual(usage.inPractice, true);
console.log('[PASS] Transition 6: MOCK -> Assign Practice = BOTH\n');

// --- TRANSITION 7: BOTH -> Remove final Mock = PRACTICE ---
console.log('>>> TRANSITION 7: BOTH -> Remove final Mock = PRACTICE');
res = removeFromMock(q, 'mock_1', mockTests);
q = res.updatedQ;
mockTests = res.updatedMocks;
usage = computeQuestionUsage(q, mockTests);
assert.strictEqual(q.usageType, 'PRACTICE');
assert.strictEqual(q.usage_type, 'PRACTICE');
assert.strictEqual(usage.statusBadge, 'PRACTICE');
assert.strictEqual(usage.inPractice, true);
assert.strictEqual(usage.mockTests.length, 0);
assert.strictEqual(usage.studentAvailable, true);
console.log('[PASS] Transition 7: BOTH -> Remove final Mock = PRACTICE\n');

// --- TRANSITION 8: PRACTICE -> Remove Practice = UNASSIGNED (NOT_USED) ---
console.log('>>> TRANSITION 8: PRACTICE -> Remove Practice = UNASSIGNED (NOT_USED)');
q = removeFromPractice(q, mockTests);
usage = computeQuestionUsage(q, mockTests);
assert.strictEqual(q.usageType, 'NOT_USED');
assert.strictEqual(q.usage_type, 'NOT_USED');
assert.strictEqual(usage.statusBadge, 'NOT_USED');
assert.strictEqual(usage.inPractice, false);
assert.strictEqual(usage.mockTests.length, 0);
assert.strictEqual(usage.studentAvailable, false, 'Unassigned must not be student available');
console.log('[PASS] Transition 8: PRACTICE -> Remove Practice = UNASSIGNED (NOT_USED)\n');

// --- TRANSITION 9: UNASSIGNED -> Assign Mock = MOCK ---
console.log('>>> TRANSITION 9: UNASSIGNED -> Assign Mock = MOCK');
res = assignToMock(q, 'mock_1', mockTests);
q = res.updatedQ;
mockTests = res.updatedMocks;
usage = computeQuestionUsage(q, mockTests);
assert.strictEqual(q.usageType, 'MOCK');
assert.strictEqual(q.usage_type, 'MOCK');
assert.strictEqual(usage.statusBadge, 'MOCK');
assert.strictEqual(usage.inPractice, false);
assert.strictEqual(usage.mockTests.length, 1);
assert.strictEqual(usage.studentAvailable, true);
console.log('[PASS] Transition 9: UNASSIGNED -> Assign Mock = MOCK\n');

// --- TRANSITION 10: MOCK -> Remove final Mock = UNASSIGNED (NOT_USED) ---
console.log('>>> TRANSITION 10: MOCK -> Remove final Mock = UNASSIGNED (NOT_USED)');
res = removeFromMock(q, 'mock_1', mockTests);
q = res.updatedQ;
mockTests = res.updatedMocks;
usage = computeQuestionUsage(q, mockTests);
assert.strictEqual(q.usageType, 'NOT_USED');
assert.strictEqual(q.usage_type, 'NOT_USED');
assert.strictEqual(usage.statusBadge, 'NOT_USED');
assert.strictEqual(usage.inPractice, false);
assert.strictEqual(usage.mockTests.length, 0);
assert.strictEqual(usage.studentAvailable, false);
console.log('[PASS] Transition 10: MOCK -> Remove final Mock = UNASSIGNED (NOT_USED)\n');

// --- TRANSITION 11: STATUS INDEPENDENCE ACROSS TRANSITIONS ---
console.log('>>> TRANSITION 11: Status Independence (Draft Preserved)');
let qDraft = {
  id: 'q_draft_test',
  question_text: 'Draft Question',
  exam: 'ANCHSL',
  subject: 'General Awareness',
  topic: 'History',
  status: 'draft', // DRAFT
  usageType: 'PRACTICE',
  usage_type: 'PRACTICE',
};

// Remove Practice from Draft
let qDraftRemoved = removeFromPractice(qDraft, mockTests);
assert.strictEqual(qDraftRemoved.status, 'draft', 'Status MUST remain draft');
assert.strictEqual(qDraftRemoved.usageType, 'NOT_USED', 'Usage becomes NOT_USED');
let usageDraft = computeQuestionUsage(qDraftRemoved, mockTests);
assert.strictEqual(usageDraft.studentAvailable, false, 'Draft unassigned question must not be available');

// Assign Draft to Mock
let resDraft = assignToMock(qDraftRemoved, 'mock_1', mockTests);
assert.strictEqual(resDraft.updatedQ.status, 'draft', 'Status MUST remain draft when assigned to mock');
assert.strictEqual(resDraft.updatedQ.usageType, 'MOCK');
usageDraft = computeQuestionUsage(resDraft.updatedQ, resDraft.updatedMocks);
assert.strictEqual(usageDraft.studentAvailable, false, 'Draft mock question MUST NOT be available to students');
console.log('[PASS] Transition 11: Status independence rigorously verified (draft is never silently published).\n');

console.log('====================================================');
console.log('ALL 11 STATE MACHINE & TRANSITION TESTS PASSED (100%)');
console.log('====================================================');
