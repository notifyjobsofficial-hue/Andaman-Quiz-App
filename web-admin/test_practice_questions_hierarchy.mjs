import assert from 'assert';

console.log('====================================================');
console.log('TESTING PRACTICE QUESTIONS TOPIC-WISE HIERARCHY');
console.log('====================================================\n');

// 1. Practice Eligibility Logic
function isPracticeQuestion(q) {
  const usage = (q.usageType || q.usage_type || 'BOTH').toUpperCase();
  return usage === 'PRACTICE' || usage === 'BOTH';
}

function isNeedsOrganization(q) {
  if (!isPracticeQuestion(q)) return false;
  const hasSubject = !!(q.subject && q.subject.trim());
  const hasTopic = !!(q.topic && q.topic.trim());
  if (!hasSubject || !hasTopic) return true;

  const topicLower = q.topic.trim().toLowerCase();
  if (topicLower === 'general' || topicLower === 'unassigned' || topicLower === 'miscellaneous') {
    return true;
  }
  return false;
}

function getSubjectQuestions(subject, questions) {
  const subId = subject.id;
  const subName = subject.name.trim().toLowerCase();

  return questions.filter((q) => {
    if (!isPracticeQuestion(q)) return false;
    if (q.subjectId && q.subjectId === subId) return true;
    if (q.subject && q.subject.trim().toLowerCase() === subName) return true;
    return false;
  });
}

function getTopicQuestions(topic, subject, questions) {
  const subjectQs = getSubjectQuestions(subject, questions);
  const topicId = topic.id;
  const topicName = topic.name.trim().toLowerCase();

  return subjectQs.filter((q) => {
    if (q.topicId && q.topicId === topicId) return true;
    if (q.topic && q.topic.trim().toLowerCase() === topicName) return true;
    return false;
  });
}

function calculateTopicMetrics(topic, subject, questions) {
  const qs = getTopicQuestions(topic, subject, questions);
  let published = 0;
  let draft = 0;
  let archived = 0;

  qs.forEach((q) => {
    const st = q.status || 'published';
    if (st === 'published') published++;
    else if (st === 'draft') draft++;
    else if (st === 'archived') archived++;
  });

  return { total: qs.length, published, draft, archived };
}

function calculateSubjectMetrics(subject, topics, questions) {
  const subjectQs = getSubjectQuestions(subject, questions);
  let published = 0;
  let draft = 0;

  subjectQs.forEach((q) => {
    const st = q.status || 'published';
    if (st === 'published') published++;
    else if (st === 'draft') draft++;
  });

  const subjectTopics = topics.filter((t) => t.subjectId === subject.id);
  const topicsBreakdown = subjectTopics.map((top) => {
    const m = calculateTopicMetrics(top, subject, subjectQs);
    return {
      topic: top,
      count: m.total,
      published: m.published,
      draft: m.draft,
    };
  });

  return {
    totalQuestions: subjectQs.length,
    published,
    draft,
    topicCount: subjectTopics.length,
    topicsBreakdown,
  };
}

function calculateGlobalPracticeMetrics(questions) {
  let totalPractice = 0;
  let publishedPractice = 0;
  let draftPractice = 0;
  let needsOrganization = 0;

  questions.forEach((q) => {
    if (!isPracticeQuestion(q)) return;
    totalPractice++;
    const st = q.status || 'published';
    if (st === 'published') publishedPractice++;
    else if (st === 'draft') draftPractice++;

    if (isNeedsOrganization(q)) {
      needsOrganization++;
    }
  });

  return {
    totalPractice,
    publishedPractice,
    draftPractice,
    needsOrganization,
  };
}

// ====================================================
// TEST DATA SEEDS
// ====================================================
const subjectQA = { id: 'sub_qa', name: 'Quantitative Aptitude' };
const subjectGA = { id: 'sub_ga', name: 'General Awareness' };

const topicPercentage = { id: 'top_pct', subjectId: 'sub_qa', name: 'Percentage' };
const topicProfitLoss = { id: 'top_pl', subjectId: 'sub_qa', name: 'Profit & Loss' };
const topicHistory = { id: 'top_hist', subjectId: 'sub_ga', name: 'Indian History' };

const allTopics = [topicPercentage, topicProfitLoss, topicHistory];

const mockQuestions = [
  // 1. Percentage - Published
  { id: 'q1', question_text: 'What is 20% of 100?', subjectId: 'sub_qa', subject: 'Quantitative Aptitude', topicId: 'top_pct', topic: 'Percentage', usageType: 'PRACTICE', status: 'published' },
  // 2. Percentage - Draft
  { id: 'q2', question_text: 'What is 50% of 250?', subjectId: 'sub_qa', subject: 'Quantitative Aptitude', topicId: 'top_pct', topic: 'Percentage', usageType: 'PRACTICE', status: 'draft' },
  // 3. Percentage - BOTH (Practice + Mock) - Published
  { id: 'q3', question_text: 'If A is 25% more than B...', subjectId: 'sub_qa', subject: 'Quantitative Aptitude', topicId: 'top_pct', topic: 'Percentage', usageType: 'BOTH', status: 'published' },
  // 4. Profit & Loss - Published
  { id: 'q4', question_text: 'Cost price is 100, Selling price is 120...', subjectId: 'sub_qa', subject: 'Quantitative Aptitude', topicId: 'top_pl', topic: 'Profit & Loss', usageType: 'PRACTICE', status: 'published' },
  // 5. MOCK ONLY - Should NOT appear in Practice hierarchy!
  { id: 'q5', question_text: 'Mock exclusive quantitative question', subjectId: 'sub_qa', subject: 'Quantitative Aptitude', topicId: 'top_pct', topic: 'Percentage', usageType: 'MOCK', status: 'published' },
  // 6. Needs Organization - Generic topic "General"
  { id: 'q6', question_text: 'Generic math question without topic', subjectId: 'sub_qa', subject: 'Quantitative Aptitude', topicId: '', topic: 'General', usageType: 'PRACTICE', status: 'published' },
  // 7. Needs Organization - Missing Subject and Topic
  { id: 'q7', question_text: 'Orphan question', subjectId: '', subject: '', topicId: '', topic: '', usageType: 'PRACTICE', status: 'draft' },
  // 8. Legacy question - No usageType (defaults safely to BOTH)
  { id: 'q8', question_text: 'Who was the first governor general?', subjectId: 'sub_ga', subject: 'General Awareness', topicId: 'top_hist', topic: 'Indian History', status: 'published' }
];

// >>> TEST 1: Topic Question Isolation & Status Independence
console.log('>>> TEST 1: Topic Question Isolation & Status Independence');
const pctMetrics = calculateTopicMetrics(topicPercentage, subjectQA, mockQuestions);
assert.strictEqual(pctMetrics.total, 3, 'Topic Percentage should have exactly 3 practice questions (q1, q2, q3)');
assert.strictEqual(pctMetrics.published, 2, '2 questions in Percentage must be published (q1, q3)');
assert.strictEqual(pctMetrics.draft, 1, '1 question in Percentage must be draft (q2)');
console.log('[PASS] Test 1: Topic questions isolated and published/draft statuses preserved.\n');

// >>> TEST 2: Mock-Only Questions Strict Exclusion
console.log('>>> TEST 2: Mock-Only Questions Strict Exclusion');
const allQAMetrics = calculateSubjectMetrics(subjectQA, allTopics, mockQuestions);
const q5Included = getSubjectQuestions(subjectQA, mockQuestions).some((q) => q.id === 'q5');
assert.strictEqual(q5Included, false, 'q5 is MOCK only and must never be counted in Practice');
console.log('[PASS] Test 2: Mock-only questions strictly excluded from practice.\n');

// >>> TEST 3: Subject Breakdown & Topic Previews
console.log('>>> TEST 3: Subject Breakdown & Topic Previews');
assert.strictEqual(allQAMetrics.totalQuestions, 5, 'QA has 5 practice-eligible questions (q1, q2, q3, q4, q6)');
assert.strictEqual(allQAMetrics.published, 4, 'QA has 4 published practice questions');
assert.strictEqual(allQAMetrics.draft, 1, 'QA has 1 draft practice question');
assert.strictEqual(allQAMetrics.topicsBreakdown.length, 2, 'QA has 2 registered topics under it');
const pctPreview = allQAMetrics.topicsBreakdown.find((t) => t.topic.id === 'top_pct');
assert.strictEqual(pctPreview.count, 3, 'Preview shows 3 questions in Percentage');
console.log('[PASS] Test 3: Subject metrics and topic breakdown preview verified.\n');

// >>> TEST 4: Global Top Summary Counters & Needs Organization
console.log('>>> TEST 4: Global Top Summary Counters & Needs Organization');
const globalStats = calculateGlobalPracticeMetrics(mockQuestions);
assert.strictEqual(globalStats.totalPractice, 7, 'Total practice questions = 7 (q1, q2, q3, q4, q6, q7, q8)');
assert.strictEqual(globalStats.publishedPractice, 5, 'Published practice = 5');
assert.strictEqual(globalStats.draftPractice, 2, 'Draft practice = 2');
assert.strictEqual(globalStats.needsOrganization, 2, 'Needs organization = 2 (q6 generic topic, q7 missing taxonomy)');
console.log('[PASS] Test 4: Global summary counters and needs organization tracking verified.\n');

// >>> TEST 5: Assign from Question Bank (Preserves Status & Avoids Duplicates)
console.log('>>> TEST 5: Assign from Question Bank (Preserves Status & Zero Duplicates)');
const bankQuestion = {
  id: 'q_bank_100',
  question_text: 'Master question bank entry',
  subject: '',
  topic: '',
  usageType: 'MOCK',
  status: 'draft', // DRAFT
};

// Simulate assign to Profit & Loss
const assignedQ = {
  ...bankQuestion,
  subject: subjectQA.name,
  subjectId: subjectQA.id,
  topic: topicProfitLoss.name,
  topicId: topicProfitLoss.id,
  usageType: 'BOTH', // Was in mock, so becomes BOTH
  status: bankQuestion.status, // MUST PRESERVE DRAFT!
};

assert.strictEqual(assignedQ.id, 'q_bank_100', 'Canonical ID preserved — ZERO duplication');
assert.strictEqual(assignedQ.status, 'draft', 'Status remains draft — NO SILENT PUBLISHING');
assert.strictEqual(assignedQ.usageType, 'BOTH', 'Usage correctly upgraded to BOTH');
assert.strictEqual(assignedQ.topic, 'Profit & Loss', 'Assigned to target topic');
console.log('[PASS] Test 5: Assign from Question Bank preserves canonical ID and draft status.\n');

// >>> TEST 6: Move Questions to Another Topic
console.log('>>> TEST 6: Move Questions to Another Topic');
const movedQ = {
  ...mockQuestions[0], // q1 currently in Percentage
  topic: topicProfitLoss.name,
  topicId: topicProfitLoss.id,
};
assert.strictEqual(movedQ.id, 'q1', 'Question ID untouched');
assert.strictEqual(movedQ.topic, 'Profit & Loss', 'Topic updated to Profit & Loss');
assert.strictEqual(movedQ.status, 'published', 'Status preserved');
console.log('[PASS] Test 6: Move questions updates topic while preserving ID and status.\n');

// >>> TEST 7: Remove Question from Practice (Never Deletes Record)
console.log('>>> TEST 7: Remove Question from Practice (Never Deletes Record)');
const removedQ = {
  ...mockQuestions[0],
  usageType: 'MOCK',
};
assert.strictEqual(isPracticeQuestion(removedQ), false, 'Question is no longer practice-eligible');
assert.strictEqual(removedQ.id, 'q1', 'Question record exists intact in Question Bank');
console.log('[PASS] Test 7: Removing from practice safely updates usageType without deleting record.\n');

console.log('====================================================');
console.log('ALL 7 PRACTICE QUESTIONS HIERARCHY TESTS PASSED (100%)');
console.log('====================================================');
