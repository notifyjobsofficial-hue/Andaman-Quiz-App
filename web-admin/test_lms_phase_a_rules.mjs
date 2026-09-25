/**
 * LMS Phase A Security Rules & Data Invariant Verification Suite
 *
 * Simulates Firestore security rules evaluation against a mock database state
 * to verify all 19 mandatory security & draft isolation scenarios.
 *
 * Scenarios:
 *  1. Test Series: published series -> ALLOW
 *  2. Test Series: draft series -> DENIED
 *  3. Test Series: archived series -> DENIED
 *  4. Test Series: published folder + draft parent series -> DENIED
 *  5. Test Series: draft folder + published parent series -> DENIED
 *  6. Test Series: published item + draft parent folder -> DENIED
 *  7. Study Library: published material in published folder -> ALLOW
 *  8. Study Library: draft material -> DENIED
 *  9. Study Library: published material in draft folder -> DENIED
 * 10. Career Goals: published -> ALLOW
 * 11. Career Goals: draft -> DENIED
 * 12. Current Affairs: published -> ALLOW
 * 13. Current Affairs: draft -> DENIED
 * 14. Battle: published battle -> ALLOW
 * 15. Battle: unpublished/draft/cancelled battle -> DENIED
 * 16. Battle Registration: student attempts to write rank on creation -> DENIED
 * 17. Battle Registration: student attempts to inject authoritative verifiedScore/rank on submission -> DENIED
 * 18. Battle Registration: unverified client telemetry submission (PENDING_VERIFICATION) -> ALLOW
 * 19. Admin: authorized admin can read/write draft content across all collections -> ALLOW
 */

import assert from 'assert';

console.log('================================================================');
console.log('TESTING LMS PHASE A SECURITY RULES & DATA INVARIANTS (19 SCENARIOS)');
console.log('================================================================\n');

// Mock Database Store
const mockDb = {
  test_series: {
    ts_pub: { id: 'ts_pub', title: 'Published Series', status: 'published' },
    ts_draft: { id: 'ts_draft', title: 'Draft Series', status: 'draft' },
    ts_archived: { id: 'ts_archived', title: 'Archived Series', status: 'archived' },
  },
  test_series_folders: {
    // folder in published series
    'ts_pub/f_pub': { id: 'f_pub', seriesId: 'ts_pub', title: 'Published Folder in Pub Series', status: 'published' },
    'ts_pub/f_draft': { id: 'f_draft', seriesId: 'ts_pub', title: 'Draft Folder in Pub Series', status: 'draft' },
    // folder in draft series
    'ts_draft/f_pub_in_draft_parent': { id: 'f_pub_in_draft_parent', seriesId: 'ts_draft', title: 'Pub Folder in Draft Series', status: 'published' },
  },
  test_series_items: {
    'ts_pub/f_pub/item_pub': { id: 'item_pub', seriesId: 'ts_pub', folderId: 'f_pub', status: 'published', testId: 't1' },
    'ts_pub/f_pub/item_draft': { id: 'item_draft', seriesId: 'ts_pub', folderId: 'f_pub', status: 'draft', testId: 't2' },
    'ts_pub/f_draft/item_pub_in_draft_folder': { id: 'item_pub_in_draft_folder', seriesId: 'ts_pub', folderId: 'f_draft', status: 'published', testId: 't3' },
    'ts_draft/f_pub_in_draft_parent/item_pub_in_draft_series': { id: 'item_pub_in_draft_series', seriesId: 'ts_draft', folderId: 'f_pub_in_draft_parent', status: 'published', testId: 't4' },
  },
  study_folders: {
    sf_pub: { id: 'sf_pub', title: 'Published Study Folder', status: 'published' },
    sf_draft: { id: 'sf_draft', title: 'Draft Study Folder', status: 'draft' },
  },
  study_materials: {
    sm_pub_in_pub_folder: { id: 'sm_pub_in_pub_folder', folderId: 'sf_pub', title: 'Pub Notes', status: 'published' },
    sm_draft_in_pub_folder: { id: 'sm_draft_in_pub_folder', folderId: 'sf_pub', title: 'Draft Notes', status: 'draft' },
    sm_pub_in_draft_folder: { id: 'sm_pub_in_draft_folder', folderId: 'sf_draft', title: 'Pub Notes in Draft Folder', status: 'published' },
  },
  career_goals: {
    goal_pub: { id: 'goal_pub', title: 'AN Police SI', status: 'published' },
    goal_draft: { id: 'goal_draft', title: 'AN Forest Ranger (WIP)', status: 'draft' },
  },
  current_affairs: {
    ca_pub: { id: 'ca_pub', title: 'Port Blair Port Expansion', status: 'published' },
    ca_draft: { id: 'ca_draft', title: 'Draft CA Article', status: 'draft' },
  },
  battles: {
    battle_pub_upcoming: { id: 'battle_pub_upcoming', title: 'Sunday Battle', isPublished: true, status: 'UPCOMING', startAt: new Date(Date.now() + 3600000), durationMinutes: 90 },
    battle_pub_live: { id: 'battle_pub_live', title: 'Live Battle', isPublished: true, status: 'LIVE', startAt: new Date(Date.now() - 300000), durationMinutes: 60 },
    battle_draft: { id: 'battle_draft', title: 'Draft Battle', isPublished: false, status: 'UPCOMING', startAt: new Date(Date.now() + 3600000), durationMinutes: 60 },
    battle_cancelled: { id: 'battle_cancelled', title: 'Cancelled Battle', isPublished: false, status: 'CANCELLED', startAt: new Date(Date.now() + 3600000), durationMinutes: 60 },
  }
};

// Helper: check if auth is Admin
function isAdmin(auth) {
  return !!(auth && auth.token && auth.token.admin);
}

// -------------------------------------------------------------
// Rule Evaluators matching firestore.rules
// -------------------------------------------------------------

// Test Series Read Rule
function canReadTestSeries(auth, seriesId) {
  const doc = mockDb.test_series[seriesId];
  if (!doc) return false;
  return isAdmin(auth) || (doc.status === 'published');
}

// Test Series Folder Read Rule
function canReadTestSeriesFolder(auth, seriesId, folderId) {
  const parentSeries = mockDb.test_series[seriesId];
  const folder = mockDb.test_series_folders[`${seriesId}/${folderId}`];
  if (!folder) return false;
  if (isAdmin(auth)) return true;

  // Rule: resource.data.status == 'published' && get(parentSeries).data.status == 'published'
  return folder.status === 'published' && parentSeries && parentSeries.status === 'published';
}

// Test Series Item Read Rule
function canReadTestSeriesItem(auth, seriesId, folderId, itemId) {
  const parentSeries = mockDb.test_series[seriesId];
  const parentFolder = mockDb.test_series_folders[`${seriesId}/${folderId}`];
  const item = mockDb.test_series_items[`${seriesId}/${folderId}/${itemId}`];
  if (!item) return false;
  if (isAdmin(auth)) return true;

  // Rule: item.status == 'published' && parentFolder.status == 'published' && parentSeries.status == 'published'
  return (
    item.status === 'published' &&
    parentFolder && parentFolder.status === 'published' &&
    parentSeries && parentSeries.status === 'published'
  );
}

// Study Folder Read Rule
function canReadStudyFolder(auth, folderId) {
  const folder = mockDb.study_folders[folderId];
  if (!folder) return false;
  return isAdmin(auth) || (folder.status === 'published');
}

// Study Material Read Rule
function canReadStudyMaterial(auth, materialId) {
  const mat = mockDb.study_materials[materialId];
  if (!mat) return false;
  if (isAdmin(auth)) return true;

  if (mat.status !== 'published') return false;
  if (mat.folderId) {
    const folder = mockDb.study_folders[mat.folderId];
    if (!folder || folder.status !== 'published') return false;
  }
  return true;
}

// Career Goals Read Rule
function canReadCareerGoal(auth, goalId) {
  const goal = mockDb.career_goals[goalId];
  if (!goal) return false;
  return isAdmin(auth) || (goal.status === 'published');
}

// Current Affairs Read Rule
function canReadCurrentAffairs(auth, itemId) {
  const ca = mockDb.current_affairs[itemId];
  if (!ca) return false;
  return isAdmin(auth) || (ca.status === 'published');
}

// Battle Read Rule
function canReadBattle(auth, battleId) {
  const b = mockDb.battles[battleId];
  if (!b) return false;
  if (isAdmin(auth)) return true;
  return b.isPublished === true;
}

// Battle Registration Create Rule
function canCreateBattleRegistration(auth, battleId, data) {
  if (isAdmin(auth)) return true;

  const allowedKeys = [
    'id', 'battleId', 'testId', 'studentName', 'mobile',
    'installationId', 'registeredAt', 'status'
  ];

  if (!Object.keys(data).every(k => allowedKeys.includes(k))) return false;
  if (data.battleId !== battleId) return false;
  if (typeof data.testId !== 'string') return false;
  if (typeof data.studentName !== 'string' || data.studentName.length === 0 || data.studentName.length > 100) return false;
  if (typeof data.installationId !== 'string' || data.installationId.length === 0 || data.installationId.length > 100) return false;
  if (!data.registeredAt) return false;
  if (data.status !== 'REGISTERED') return false;

  // Disallow client rank or verifiedScore on creation
  if ('rank' in data) return false;
  if ('verifiedScore' in data) return false;

  return true;
}

// Battle Registration Update Rule
function canUpdateBattleRegistration(auth, currentData, updatedData, requestTime = new Date()) {
  if (isAdmin(auth)) return true;

  const affectedKeys = Object.keys(updatedData).filter(k => updatedData[k] !== currentData[k]);
  const battle = mockDb.battles[currentData.battleId];

  // Transition to LOBBY
  if (
    updatedData.status === 'LOBBY' &&
    currentData.status === 'REGISTERED'
  ) {
    return affectedKeys.every(k => ['status'].includes(k));
  }

  // Transition to STARTED: requires server requestTime within battle window
  if (
    updatedData.status === 'STARTED' &&
    (currentData.status === 'REGISTERED' || currentData.status === 'LOBBY')
  ) {
    if (!affectedKeys.every(k => ['status', 'startedAt'].includes(k))) return false;
    if (battle) {
      if (requestTime < battle.startAt) return false;
      const endAt = battle.endAt || new Date(battle.startAt.getTime() + (battle.durationMinutes || 60) * 60000);
      if (requestTime >= endAt) return false;
    }
    return true;
  }

  // Transition to SUBMITTED: STRICT REQUIREMENT: previous status MUST be 'STARTED'
  if (
    updatedData.status === 'SUBMITTED' &&
    currentData.status === 'STARTED'
  ) {
    if (!updatedData.submittedAt) return false;
    if (updatedData.resultStatus && updatedData.resultStatus !== 'PENDING_VERIFICATION') return false;

    // Forbidden client fields
    if (affectedKeys.includes('rank')) return false;
    if (affectedKeys.includes('verifiedScore')) return false;
    if (affectedKeys.includes('verifiedAccuracy')) return false;
    if (affectedKeys.includes('leaderboardTime')) return false;

    const allowedSubmitKeys = [
      'status', 'submittedAt', 'clientScore', 'clientAccuracy',
      'timeTakenSeconds', 'answers', 'resultStatus'
    ];
    return affectedKeys.every(k => allowedSubmitKeys.includes(k));
  }

  return false;
}

const studentAuth = null;
const adminAuth = { token: { admin: true } };

// =============================================================
// RUNNING THE 19 MANDATORY TEST SCENARIOS
// =============================================================

// Scenario 1: Test Series: published series -> ALLOW
console.log('Scenario 1: Test Series - Published series read by student');
assert.strictEqual(canReadTestSeries(studentAuth, 'ts_pub'), true, 'Published series must be readable');
console.log('  ✓ ALLOWED: Student can read published series.\n');

// Scenario 2: Test Series: draft series -> DENIED
console.log('Scenario 2: Test Series - Draft series read by student');
assert.strictEqual(canReadTestSeries(studentAuth, 'ts_draft'), false, 'Draft series must be denied');
console.log('  ✓ DENIED: Student cannot read draft series.\n');

// Scenario 3: Test Series: archived series -> DENIED
console.log('Scenario 3: Test Series - Archived series read by student');
assert.strictEqual(canReadTestSeries(studentAuth, 'ts_archived'), false, 'Archived series must be denied');
console.log('  ✓ DENIED: Student cannot read archived series.\n');

// Scenario 4: Test Series: published folder + draft parent series -> DENIED
console.log('Scenario 4: Test Series - Published folder with draft parent series');
assert.strictEqual(canReadTestSeriesFolder(studentAuth, 'ts_draft', 'f_pub_in_draft_parent'), false, 'Folder in draft series must be denied');
console.log('  ✓ DENIED: Student cannot read folder whose parent series is draft.\n');

// Scenario 5: Test Series: draft folder + published parent series -> DENIED
console.log('Scenario 5: Test Series - Draft folder with published parent series');
assert.strictEqual(canReadTestSeriesFolder(studentAuth, 'ts_pub', 'f_draft'), false, 'Draft folder must be denied');
console.log('  ✓ DENIED: Student cannot read draft folder in published series.\n');

// Scenario 6: Test Series: published item + draft parent folder (or draft series) -> DENIED
console.log('Scenario 6: Test Series - Published item with draft parent folder / series');
assert.strictEqual(canReadTestSeriesItem(studentAuth, 'ts_pub', 'f_draft', 'item_pub_in_draft_folder'), false, 'Item in draft folder must be denied');
assert.strictEqual(canReadTestSeriesItem(studentAuth, 'ts_draft', 'f_pub_in_draft_parent', 'item_pub_in_draft_series'), false, 'Item in draft series must be denied');
assert.strictEqual(canReadTestSeriesItem(studentAuth, 'ts_pub', 'f_pub', 'item_pub'), true, 'Item in published chain must be allowed');
console.log('  ✓ DENIED: Parent chain isolation blocks items in draft folders or draft series.\n');

// Scenario 7: Study Library: published material in published folder -> ALLOW
console.log('Scenario 7: Study Library - Published material in published folder');
assert.strictEqual(canReadStudyMaterial(studentAuth, 'sm_pub_in_pub_folder'), true, 'Published material in pub folder must be allowed');
console.log('  ✓ ALLOWED: Student can read published material in published folder.\n');

// Scenario 8: Study Library: draft material -> DENIED
console.log('Scenario 8: Study Library - Draft material in published folder');
assert.strictEqual(canReadStudyMaterial(studentAuth, 'sm_draft_in_pub_folder'), false, 'Draft material must be denied');
console.log('  ✓ DENIED: Student cannot read draft material.\n');

// Scenario 9: Study Library: published material in draft folder -> DENIED
console.log('Scenario 9: Study Library - Published material in draft folder');
assert.strictEqual(canReadStudyMaterial(studentAuth, 'sm_pub_in_draft_folder'), false, 'Published material in draft folder must be denied');
console.log('  ✓ DENIED: Student cannot read material whose parent folder is draft.\n');

// Scenario 10: Career Goals: published -> ALLOW
console.log('Scenario 10: Career Goals - Published goal read by student');
assert.strictEqual(canReadCareerGoal(studentAuth, 'goal_pub'), true, 'Published career goal must be allowed');
console.log('  ✓ ALLOWED: Student can read published career goal.\n');

// Scenario 11: Career Goals: draft -> DENIED
console.log('Scenario 11: Career Goals - Draft goal read by student');
assert.strictEqual(canReadCareerGoal(studentAuth, 'goal_draft'), false, 'Draft career goal must be denied');
console.log('  ✓ DENIED: Student cannot read draft career goal.\n');

// Scenario 12: Current Affairs: published -> ALLOW
console.log('Scenario 12: Current Affairs - Published current affairs read by student');
assert.strictEqual(canReadCurrentAffairs(studentAuth, 'ca_pub'), true, 'Published CA must be allowed');
console.log('  ✓ ALLOWED: Student can read published current affairs.\n');

// Scenario 13: Current Affairs: draft -> DENIED
console.log('Scenario 13: Current Affairs - Draft current affairs read by student');
assert.strictEqual(canReadCurrentAffairs(studentAuth, 'ca_draft'), false, 'Draft CA must be denied');
console.log('  ✓ DENIED: Student cannot read draft current affairs.\n');

// Scenario 14: Battle: published battle -> ALLOW
console.log('Scenario 14: Battle - Published and upcoming/live battle read by student');
assert.strictEqual(canReadBattle(studentAuth, 'battle_pub_upcoming'), true, 'Upcoming battle must be allowed');
assert.strictEqual(canReadBattle(studentAuth, 'battle_pub_live'), true, 'Live battle must be allowed');
console.log('  ✓ ALLOWED: Student can read published upcoming and live battles.\n');

// Scenario 15: Battle: unpublished/draft/cancelled battle -> DENIED
console.log('Scenario 15: Battle - Unpublished, draft, or cancelled battle read by student');
assert.strictEqual(canReadBattle(studentAuth, 'battle_draft'), false, 'Draft battle must be denied');
assert.strictEqual(canReadBattle(studentAuth, 'battle_cancelled'), false, 'Cancelled battle must be denied');
console.log('  ✓ DENIED: Student cannot read draft or cancelled battles.\n');

// Scenario 16: Battle Registration: student attempts to write rank on creation -> DENIED
console.log('Scenario 16: Battle Registration - Student attempts to write rank on creation');
const regWithRank = {
  id: 'reg_tamper_01',
  battleId: 'battle_pub_upcoming',
  testId: 'test_cgl_01',
  studentName: 'Hacker Student',
  installationId: 'inst_hacker_1',
  registeredAt: new Date().toISOString(),
  status: 'REGISTERED',
  rank: 1, // Malicious rank injection
};
assert.strictEqual(canCreateBattleRegistration(studentAuth, 'battle_pub_upcoming', regWithRank), false, 'Creation with rank must be denied');
console.log('  ✓ DENIED: Client cannot inject rank on registration creation.\n');

// Scenario 17: Battle Registration: student attempts to inject authoritative verifiedScore/rank on submission -> DENIED
console.log('Scenario 17: Battle Registration - Student attempts to inject verifiedScore / rank on submission');
const initialReg = {
  id: 'reg_valid_01',
  battleId: 'battle_pub_live',
  testId: 'test_cgl_01',
  studentName: 'Priya Verma',
  installationId: 'inst_student_01',
  registeredAt: new Date().toISOString(),
  status: 'STARTED',
};

const submissionTamperingWithRank = {
  ...initialReg,
  status: 'SUBMITTED',
  submittedAt: new Date().toISOString(),
  clientScore: 90,
  rank: 1, // Malicious rank override
};
assert.strictEqual(canUpdateBattleRegistration(studentAuth, initialReg, submissionTamperingWithRank), false, 'Update with rank must be denied');

const submissionTamperingWithVerifiedScore = {
  ...initialReg,
  status: 'SUBMITTED',
  submittedAt: new Date().toISOString(),
  clientScore: 90,
  verifiedScore: 100, // Malicious verifiedScore injection
};
assert.strictEqual(canUpdateBattleRegistration(studentAuth, initialReg, submissionTamperingWithVerifiedScore), false, 'Update with verifiedScore must be denied');
console.log('  ✓ DENIED: Student cannot inject rank or verifiedScore on battle submission.\n');

// Scenario 18: Battle Registration: unverified client telemetry submission (PENDING_VERIFICATION) -> ALLOW
console.log('Scenario 18: Battle Registration - Hardened Lifecycle & Server-Time Window');

// 18.1: REGISTERED -> SUBMITTED is strictly DENIED
const registeredReg = { ...initialReg, status: 'REGISTERED' };
assert.strictEqual(canUpdateBattleRegistration(studentAuth, registeredReg, { ...registeredReg, status: 'SUBMITTED', submittedAt: new Date().toISOString() }), false, 'REGISTERED -> SUBMITTED must be denied');
console.log('  ✓ DENIED: REGISTERED -> SUBMITTED is blocked (must be STARTED).');

// 18.2: LOBBY -> SUBMITTED is strictly DENIED
const lobbyReg = { ...initialReg, status: 'LOBBY' };
assert.strictEqual(canUpdateBattleRegistration(studentAuth, lobbyReg, { ...lobbyReg, status: 'SUBMITTED', submittedAt: new Date().toISOString() }), false, 'LOBBY -> SUBMITTED must be denied');
console.log('  ✓ DENIED: LOBBY -> SUBMITTED is blocked (must be STARTED).');

// 18.3: START before battle.startAt is strictly DENIED by request.time
const futureBattleReg = { id: 'reg_fut', battleId: 'battle_pub_upcoming', testId: 't1', studentName: 'Dan', installationId: 'i1', status: 'REGISTERED' };
assert.strictEqual(canUpdateBattleRegistration(studentAuth, futureBattleReg, { ...futureBattleReg, status: 'STARTED', startedAt: new Date().toISOString() }, new Date()), false, 'START before startAt must be denied');
console.log('  ✓ DENIED: START before startAt is blocked by request.time.');

// 18.4: START within live window is ALLOWED
const liveBattleReg = { id: 'reg_live', battleId: 'battle_pub_live', testId: 't1', studentName: 'Dan', installationId: 'i1', status: 'REGISTERED' };
assert.strictEqual(canUpdateBattleRegistration(studentAuth, liveBattleReg, { ...liveBattleReg, status: 'STARTED', startedAt: new Date().toISOString() }, new Date()), true, 'START within live window must be allowed');
console.log('  ✓ ALLOWED: START within live window permitted.');

// 18.5: Legitimate telemetry submission from STARTED
const validSubmission = {
  ...initialReg,
  status: 'SUBMITTED',
  submittedAt: new Date().toISOString(),
  clientScore: 84.5,
  clientAccuracy: 90.0,
  timeTakenSeconds: 2400,
  answers: { q1: 2, q2: 4 },
  resultStatus: 'PENDING_VERIFICATION',
};
assert.strictEqual(canUpdateBattleRegistration(studentAuth, initialReg, validSubmission), true, 'Valid telemetry submission from STARTED must be allowed');
console.log('  ✓ ALLOWED: Unauthenticated client in STARTED state can submit raw telemetry with PENDING_VERIFICATION status.\n');

// Scenario 19: Admin: authorized admin can read/write draft content across all collections -> ALLOW
console.log('Scenario 19: Admin - Authorized admin read/write access across all collections');
assert.strictEqual(canReadTestSeries(adminAuth, 'ts_draft'), true, 'Admin must read draft series');
assert.strictEqual(canReadTestSeriesFolder(adminAuth, 'ts_draft', 'f_pub_in_draft_parent'), true, 'Admin must read folder in draft series');
assert.strictEqual(canReadTestSeriesItem(adminAuth, 'ts_draft', 'f_pub_in_draft_parent', 'item_pub_in_draft_series'), true, 'Admin must read item in draft series');
assert.strictEqual(canReadStudyFolder(adminAuth, 'sf_draft'), true, 'Admin must read draft study folder');
assert.strictEqual(canReadStudyMaterial(adminAuth, 'sm_draft_in_pub_folder'), true, 'Admin must read draft study material');
assert.strictEqual(canReadStudyMaterial(adminAuth, 'sm_pub_in_draft_folder'), true, 'Admin must read material in draft folder');
assert.strictEqual(canReadCareerGoal(adminAuth, 'goal_draft'), true, 'Admin must read draft career goal');
assert.strictEqual(canReadCurrentAffairs(adminAuth, 'ca_draft'), true, 'Admin must read draft current affairs');
assert.strictEqual(canReadBattle(adminAuth, 'battle_draft'), true, 'Admin must read draft battle');
assert.strictEqual(canReadBattle(adminAuth, 'battle_cancelled'), true, 'Admin must read cancelled battle');
assert.strictEqual(canCreateBattleRegistration(adminAuth, 'battle_draft', regWithRank), true, 'Admin can manage registrations with admin rights');
console.log('  ✓ ALLOWED: Admin has unrestricted access to draft and management operations across all collections.\n');

console.log('================================================================');
console.log('ALL 19 MANDATORY LMS PHASE A SECURITY SCENARIOS PASSED (100%)');
console.log('================================================================');
