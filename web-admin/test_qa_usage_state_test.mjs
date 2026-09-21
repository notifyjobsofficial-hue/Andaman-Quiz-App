import assert from 'assert';

console.log('====================================================');
console.log('QA_USAGE_STATE_TEST: LIFECYCLE AUDIT & VERIFICATION');
console.log('====================================================\n');

// 1. Production computeQuestionUsage
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
  const isPublished = (question.status || 'published').toLowerCase() === 'published';

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

// 2. Production QuestionFormModal label renderer
function getQuestionFormModalLabel(q) {
  const usage = q.usageType || q.usage_type || 'NOT_USED';
  if (usage === 'NOT_USED') return 'Not Assigned (Question Bank Only)';
  if (usage === 'PRACTICE') return 'Practice Only';
  if (usage === 'MOCK') return 'Mock Test Only';
  if (usage === 'BOTH') return 'Practice + Mock Test';
  return 'Not Assigned (Question Bank Only)';
}

// 3. Production Not Used Filter
function matchesNotUsedFilter(usage) {
  return usage.statusBadge === 'NOT_USED' || (!usage.inPractice && usage.mockTests.length === 0);
}

// 4. Production Used In renderer
function getUsedInDisplay(usage) {
  if (usage.inPractice && usage.mockTests.length > 0) {
    return ['PRACTICE', ...usage.mockTests.map((m) => m.title)];
  }
  if (usage.inPractice) {
    return ['PRACTICE'];
  }
  if (usage.mockTests.length > 0) {
    return usage.mockTests.map((m) => m.title);
  }
  return ['NOT USED'];
}

// 5. Database simulation representing Firestore document table
const firestoreDb = {
  questions: new Map(),
  mockTests: new Map(),
};

// Initial Mock Test in database
firestoreDb.mockTests.set('mock_anchsl_01', {
  id: 'mock_anchsl_01',
  title: 'AN CHSL Mock 01',
  examCode: 'ANCHSL',
  sections: [{ id: 'sec_1', name: 'General Awareness', questionIds: [] }],
});

// Helper functions that mirror production update functions
function saveQuestionToDb(q) {
  firestoreDb.questions.set(q.id, { ...q, updated_at: new Date().toISOString() });
  return firestoreDb.questions.get(q.id);
}

function removeQuestionFromPractice(q, allMocks) {
  const isUsedInAnyMock = allMocks.some((m) =>
    m.sections?.some((sec) => sec.questionIds?.includes(q.id))
  );
  const nextUsage = isUsedInAnyMock ? 'MOCK' : 'NOT_USED';
  return saveQuestionToDb({
    ...q,
    status: q.status || 'published',
    usageType: nextUsage,
    usage_type: nextUsage,
  });
}

function assignQuestionToPractice(q, allMocks) {
  const isUsedInAnyMock = allMocks.some((m) =>
    m.sections?.some((sec) => sec.questionIds?.includes(q.id))
  );
  const nextUsage = isUsedInAnyMock ? 'BOTH' : 'PRACTICE';
  return saveQuestionToDb({
    ...q,
    status: q.status || 'published',
    usageType: nextUsage,
    usage_type: nextUsage,
  });
}

function assignQuestionToMock(q, mockId) {
  const mock = firestoreDb.mockTests.get(mockId);
  if (mock) {
    const s0 = mock.sections[0];
    if (!s0.questionIds.includes(q.id)) {
      s0.questionIds.push(q.id);
    }
  }
  const currentUsage = (q.usageType || q.usage_type || 'BOTH').toUpperCase();
  const isInPractice = currentUsage === 'PRACTICE' || currentUsage === 'BOTH';
  const nextUsage = isInPractice ? 'BOTH' : 'MOCK';
  return saveQuestionToDb({
    ...q,
    status: q.status || 'published',
    usageType: nextUsage,
    usage_type: nextUsage,
  });
}

function removeQuestionFromMock(q, mockId) {
  const mock = firestoreDb.mockTests.get(mockId);
  if (mock) {
    mock.sections[0].questionIds = mock.sections[0].questionIds.filter((id) => id !== q.id);
  }
  const allMocks = Array.from(firestoreDb.mockTests.values());
  const stillInAnyMock = allMocks.some((m) =>
    m.sections?.some((sec) => sec.questionIds?.includes(q.id))
  );
  const currentUsage = (q.usageType || q.usage_type || 'BOTH').toUpperCase();
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

  return saveQuestionToDb({
    ...q,
    status: q.status || 'published',
    usageType: nextUsage,
    usage_type: nextUsage,
  });
}

// ====================================================
// EXECUTE FULL QA LIFECYCLE
// ====================================================

// --- STAGE 1: Create UNASSIGNED Question ---
console.log('>>> STAGE 1: Create UNASSIGNED Question (QA_USAGE_STATE_TEST)');
let qDoc = saveQuestionToDb({
  id: 'QA_USAGE_STATE_TEST',
  question_text: 'What is the state animal of Andaman and Nicobar Islands?',
  exam: 'ANCHSL',
  subject: 'General Awareness',
  topic: 'Andaman GK',
  status: 'published',
  usageType: 'NOT_USED',
  usage_type: 'NOT_USED',
});

assert.strictEqual(firestoreDb.questions.size, 1, 'Exactly one question document exists');
assert.strictEqual(qDoc.id, 'QA_USAGE_STATE_TEST');
assert.strictEqual(qDoc.usageType, 'NOT_USED', 'raw usageType must be NOT_USED');
assert.strictEqual(qDoc.usage_type, 'NOT_USED', 'raw usage_type must be NOT_USED');
assert.strictEqual(qDoc.status, 'published');

let allMocks = Array.from(firestoreDb.mockTests.values());
let usage = computeQuestionUsage(qDoc, allMocks);
assert.strictEqual(usage.statusBadge, 'NOT_USED');
assert.strictEqual(usage.studentAvailable, false);
assert.deepStrictEqual(getUsedInDisplay(usage), ['NOT USED']);
assert.strictEqual(getQuestionFormModalLabel(qDoc), 'Not Assigned (Question Bank Only)');
assert.strictEqual(matchesNotUsedFilter(usage), true);
assert.strictEqual(allMocks[0].sections[0].questionIds.includes(qDoc.id), false);
console.log('[PASS] Stage 1: UNASSIGNED question correctly classified in DB and UI.\n');

// --- STAGE 2: Assign to Practice ---
console.log('>>> STAGE 2: Assign to Practice');
qDoc = assignQuestionToPractice(qDoc, allMocks);
allMocks = Array.from(firestoreDb.mockTests.values());
usage = computeQuestionUsage(qDoc, allMocks);

assert.strictEqual(firestoreDb.questions.size, 1, 'No duplicate record created');
assert.strictEqual(qDoc.usageType, 'PRACTICE');
assert.strictEqual(qDoc.usage_type, 'PRACTICE');
assert.strictEqual(qDoc.status, 'published');
assert.strictEqual(usage.statusBadge, 'PRACTICE');
assert.strictEqual(usage.studentAvailable, true);
assert.deepStrictEqual(getUsedInDisplay(usage), ['PRACTICE']);
assert.strictEqual(getQuestionFormModalLabel(qDoc), 'Practice Only');
assert.strictEqual(matchesNotUsedFilter(usage), false);
assert.strictEqual(allMocks[0].sections[0].questionIds.includes(qDoc.id), false);
console.log('[PASS] Stage 2: Question assigned to Practice.\n');

// --- STAGE 3: Remove from Practice (Zero Mock Relationships) ---
console.log('>>> STAGE 3: Remove Practice (Practice-only with ZERO mocks)');
qDoc = removeQuestionFromPractice(qDoc, allMocks);
allMocks = Array.from(firestoreDb.mockTests.values());
usage = computeQuestionUsage(qDoc, allMocks);

assert.strictEqual(firestoreDb.questions.size, 1, 'Document preserved in Question Bank, never deleted');
assert.strictEqual(qDoc.usageType, 'NOT_USED', 'MUST become NOT_USED, never false MOCK');
assert.strictEqual(qDoc.usage_type, 'NOT_USED');
assert.strictEqual(qDoc.status, 'published', 'Publication status preserved');
assert.strictEqual(usage.statusBadge, 'NOT_USED');
assert.strictEqual(usage.studentAvailable, false, 'Student Availability becomes false');
assert.deepStrictEqual(getUsedInDisplay(usage), ['NOT USED']);
assert.strictEqual(getQuestionFormModalLabel(qDoc), 'Not Assigned (Question Bank Only)', 'QuestionFormModal displays Not Assigned');
assert.strictEqual(matchesNotUsedFilter(usage), true, 'Not Used filter finds it');
assert.strictEqual(allMocks[0].sections[0].questionIds.includes(qDoc.id), false);
console.log('[PASS] Stage 3: Practice-only removal correctly yields UNASSIGNED / NOT_USED with zero false mock classification.\n');

// --- STAGE 4: Assign to Mock ---
console.log('>>> STAGE 4: Assign to Mock Test');
qDoc = assignQuestionToMock(qDoc, 'mock_anchsl_01');
allMocks = Array.from(firestoreDb.mockTests.values());
usage = computeQuestionUsage(qDoc, allMocks);

assert.strictEqual(firestoreDb.questions.size, 1);
assert.strictEqual(qDoc.usageType, 'MOCK');
assert.strictEqual(qDoc.usage_type, 'MOCK');
assert.strictEqual(qDoc.status, 'published');
assert.strictEqual(usage.statusBadge, 'MOCK');
assert.strictEqual(usage.studentAvailable, true);
assert.deepStrictEqual(getUsedInDisplay(usage), ['AN CHSL Mock 01']);
assert.strictEqual(getQuestionFormModalLabel(qDoc), 'Mock Test Only');
assert.strictEqual(matchesNotUsedFilter(usage), false);
assert.strictEqual(allMocks[0].sections[0].questionIds.includes(qDoc.id), true, 'Mock section contains question ID');
console.log('[PASS] Stage 4: Question assigned to Mock Test.\n');

// --- STAGE 5: Assign to Practice (In Mock -> BOTH) ---
console.log('>>> STAGE 5: Assign to Practice (While in Mock -> BOTH)');
qDoc = assignQuestionToPractice(qDoc, allMocks);
allMocks = Array.from(firestoreDb.mockTests.values());
usage = computeQuestionUsage(qDoc, allMocks);

assert.strictEqual(firestoreDb.questions.size, 1);
assert.strictEqual(qDoc.usageType, 'BOTH');
assert.strictEqual(qDoc.usage_type, 'BOTH');
assert.strictEqual(qDoc.status, 'published');
assert.strictEqual(usage.statusBadge, 'BOTH');
assert.strictEqual(usage.studentAvailable, true);
assert.deepStrictEqual(getUsedInDisplay(usage), ['PRACTICE', 'AN CHSL Mock 01']);
assert.strictEqual(getQuestionFormModalLabel(qDoc), 'Practice + Mock Test');
assert.strictEqual(matchesNotUsedFilter(usage), false);
assert.strictEqual(allMocks[0].sections[0].questionIds.includes(qDoc.id), true);
console.log('[PASS] Stage 5: Question assigned to both Practice and Mock Test.\n');

// --- STAGE 6: Remove from Practice (When in Mock -> MOCK) ---
console.log('>>> STAGE 6: Remove Practice (While in Mock -> MOCK)');
qDoc = removeQuestionFromPractice(qDoc, allMocks);
allMocks = Array.from(firestoreDb.mockTests.values());
usage = computeQuestionUsage(qDoc, allMocks);

assert.strictEqual(firestoreDb.questions.size, 1);
assert.strictEqual(qDoc.usageType, 'MOCK', 'Because real mock relationship exists, usageType becomes MOCK');
assert.strictEqual(qDoc.usage_type, 'MOCK');
assert.strictEqual(qDoc.status, 'published');
assert.strictEqual(usage.statusBadge, 'MOCK');
assert.strictEqual(usage.studentAvailable, true);
assert.deepStrictEqual(getUsedInDisplay(usage), ['AN CHSL Mock 01']);
assert.strictEqual(getQuestionFormModalLabel(qDoc), 'Mock Test Only');
assert.strictEqual(matchesNotUsedFilter(usage), false);
assert.strictEqual(allMocks[0].sections[0].questionIds.includes(qDoc.id), true, 'Mock relationship remained untouched');
console.log('[PASS] Stage 6: Removing Practice from BOTH correctly retains MOCK.\n');

// --- STAGE 7: Remove from final Mock (Becomes UNASSIGNED / NOT_USED) ---
console.log('>>> STAGE 7: Remove from final Mock (Becomes UNASSIGNED / NOT_USED)');
qDoc = removeQuestionFromMock(qDoc, 'mock_anchsl_01');
allMocks = Array.from(firestoreDb.mockTests.values());
usage = computeQuestionUsage(qDoc, allMocks);

assert.strictEqual(firestoreDb.questions.size, 1);
assert.strictEqual(qDoc.usageType, 'NOT_USED', 'Removing final mock when not in practice yields NOT_USED');
assert.strictEqual(qDoc.usage_type, 'NOT_USED');
assert.strictEqual(qDoc.status, 'published');
assert.strictEqual(usage.statusBadge, 'NOT_USED');
assert.strictEqual(usage.studentAvailable, false);
assert.deepStrictEqual(getUsedInDisplay(usage), ['NOT USED']);
assert.strictEqual(getQuestionFormModalLabel(qDoc), 'Not Assigned (Question Bank Only)');
assert.strictEqual(matchesNotUsedFilter(usage), true);
assert.strictEqual(allMocks[0].sections[0].questionIds.includes(qDoc.id), false);
console.log('[PASS] Stage 7: Removing final mock correctly yields UNASSIGNED / NOT_USED.\n');

// --- CLEANUP ---
console.log('>>> CLEANUP: Removing QA question from database');
firestoreDb.questions.delete('QA_USAGE_STATE_TEST');
firestoreDb.mockTests.delete('mock_anchsl_01');
assert.strictEqual(firestoreDb.questions.size, 0);
assert.strictEqual(firestoreDb.mockTests.size, 0);
console.log('[PASS] Cleanup complete. Zero leftover QA data.\n');

console.log('====================================================');
console.log('ALL QA_USAGE_STATE_TEST STAGES PASSED (100% SUCCESS)');
console.log('====================================================');
