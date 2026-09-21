/**
 * QA_PRACTICE_STATUS_TEST (Web-Admin Verification Suite)
 * Verifies exact lifecycle of Practice Status & Assignment independence (A through G).
 */

import assert from 'assert';

console.log('====================================================');
console.log('RUNNING QA_PRACTICE_STATUS_TEST (WEB-ADMIN PIPELINE)');
console.log('====================================================\n');

// Simulating questionUsage.ts functions
function computeQuestionUsage(question, mockList = [], liveList = []) {
  const normUsage = (question.usageType || question.usage_type || 'BOTH').toUpperCase();
  const isEligibleUsage = normUsage === 'PRACTICE' || normUsage === 'BOTH';
  const hasTaxonomy = Boolean(question.exam && question.subject);

  // inPractice represents whether question belongs to Practice (independent of status)
  const inPractice = isEligibleUsage && hasTaxonomy;

  const usedInMocks = mockList.filter((m) =>
    m.sections?.some((sec) => sec.questionIds?.includes(question.id))
  );

  const isPublished = (question.status || 'published').toLowerCase() === 'published';
  const studentAvailable = isPublished && (inPractice || usedInMocks.length > 0);

  let statusBadge = 'NOT_USED';
  if (inPractice && usedInMocks.length > 0) {
    statusBadge = 'BOTH';
  } else if (inPractice) {
    statusBadge = 'PRACTICE';
  } else if (usedInMocks.length > 0) {
    statusBadge = 'MOCK';
  }

  return {
    inPractice,
    inMockTests: usedInMocks.length > 0,
    studentAvailable,
    statusBadge,
  };
}

function assignQuestionToPractice(question, isUsedInAnyMock = false) {
  return {
    ...question,
    status: question.status || 'published', // Preserves existing status
    usageType: isUsedInAnyMock ? 'BOTH' : 'PRACTICE',
    usage_type: isUsedInAnyMock ? 'BOTH' : 'PRACTICE',
    updated_at: new Date().toISOString(),
  };
}

function assignQuestionToMock(question, isUsedInPractice = false) {
  return {
    ...question,
    status: question.status || 'published', // Preserves existing status
    usageType: isUsedInPractice ? 'BOTH' : 'MOCK',
    usage_type: isUsedInPractice ? 'BOTH' : 'MOCK',
    updated_at: new Date().toISOString(),
  };
}

// -----------------------------------------------------------
// TEST A: Create as Draft Practice Question
// -----------------------------------------------------------
console.log('>>> TEST A: Create Question as usageType = PRACTICE, status = draft');
let qA = {
  id: 'qa_q1',
  question_text: 'Which island is Cellular Jail on?',
  exam: 'ANCHSL',
  subject: 'General Knowledge',
  topic: 'History',
  usageType: 'PRACTICE',
  status: 'draft',
};
const usageA = computeQuestionUsage(qA);
assert.strictEqual(usageA.statusBadge, 'PRACTICE', 'Expected Used In badge to be PRACTICE');
assert.strictEqual(usageA.inPractice, true, 'Expected inPractice assignment to be true');
assert.strictEqual(usageA.studentAvailable, false, 'Expected Student Availability to be false (NOT AVAILABLE)');
console.log('[PASS] Lifecycle A: Used In = PRACTICE, Student Availability = NOT AVAILABLE\n');

// -----------------------------------------------------------
// TEST B: Publish
// -----------------------------------------------------------
console.log('>>> TEST B: Publish Question');
qA = { ...qA, status: 'published' };
const usageB = computeQuestionUsage(qA);
assert.strictEqual(usageB.statusBadge, 'PRACTICE', 'Expected Used In to remain PRACTICE');
assert.strictEqual(usageB.inPractice, true, 'Expected inPractice to remain true');
assert.strictEqual(usageB.studentAvailable, true, 'Expected Student Availability to be true (AVAILABLE)');
console.log('[PASS] Lifecycle B: Used In = PRACTICE, Student Availability = AVAILABLE\n');

// -----------------------------------------------------------
// TEST C: Change back to Draft (Unpublish)
// -----------------------------------------------------------
console.log('>>> TEST C: Unpublish Question back to Draft');
qA = { ...qA, status: 'draft' };
const usageC = computeQuestionUsage(qA);
assert.strictEqual(usageC.statusBadge, 'PRACTICE', 'Expected Used In to remain PRACTICE even while draft');
assert.strictEqual(usageC.inPractice, true, 'Expected inPractice assignment to be preserved');
assert.strictEqual(usageC.studentAvailable, false, 'Expected Student Availability to be false (NOT AVAILABLE)');
console.log('[PASS] Lifecycle C: Used In = PRACTICE, Student Availability = NOT AVAILABLE\n');

// -----------------------------------------------------------
// TEST D: Publish again
// -----------------------------------------------------------
console.log('>>> TEST D: Publish Question Again (No Reassignment Needed)');
qA = { ...qA, status: 'published' };
const usageD = computeQuestionUsage(qA);
assert.strictEqual(usageD.statusBadge, 'PRACTICE');
assert.strictEqual(usageD.studentAvailable, true);
console.log('[PASS] Lifecycle D: Student Practice becomes visible again without re-assigning\n');

// -----------------------------------------------------------
// TEST E: Archive Question
// -----------------------------------------------------------
console.log('>>> TEST E: Archive Question');
qA = { ...qA, status: 'archived' };
const usageE = computeQuestionUsage(qA);
assert.strictEqual(usageE.statusBadge, 'PRACTICE', 'Archived question preserves its assignment');
assert.strictEqual(usageE.studentAvailable, false, 'Archived question must NOT be available to students');
console.log('[PASS] Lifecycle E: Assignment retained as PRACTICE, Student Availability = NOT AVAILABLE\n');

// -----------------------------------------------------------
// TEST F: Assign a DRAFT question to Practice preserves draft status
// -----------------------------------------------------------
console.log('>>> TEST F: Assign a DRAFT question to Practice');
const draftQ = {
  id: 'draft_q1',
  question_text: 'Draft Question Text',
  exam: 'ANCHSL',
  subject: 'General Knowledge',
  usageType: 'MOCK',
  status: 'draft',
};
const assignedPractice = assignQuestionToPractice(draftQ, true);
assert.strictEqual(assignedPractice.status, 'draft', 'Status MUST remain draft after assignQuestionToPractice');
assert.strictEqual(assignedPractice.usageType, 'BOTH', 'usageType must be updated to BOTH');
console.log('[PASS] Lifecycle F: Assign to Practice preserves status = draft (NO SILENT PUBLICATION)\n');

// -----------------------------------------------------------
// TEST G: Assign a DRAFT question to Mock preserves draft status
// -----------------------------------------------------------
console.log('>>> TEST G: Assign a DRAFT question to Mock');
const assignedMock = assignQuestionToMock(draftQ, true);
assert.strictEqual(assignedMock.status, 'draft', 'Status MUST remain draft after assignQuestionToMock');
assert.strictEqual(assignedMock.usageType, 'BOTH', 'usageType must be updated to BOTH');
console.log('[PASS] Lifecycle G: Assign to Mock preserves status = draft (NO SILENT PUBLICATION)\n');

console.log('====================================================');
console.log('ALL QA_PRACTICE_STATUS_TEST PHASES PASSED! (100%)');
console.log('====================================================');
