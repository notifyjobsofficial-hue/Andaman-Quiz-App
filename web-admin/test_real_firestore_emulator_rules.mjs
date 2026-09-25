/**
 * Official Firebase Firestore Rules Emulator Test Suite
 *
 * Runs against the Google Firebase Rules Emulator to execute real Firestore
 * queries and validate state-machine transitions using @firebase/rules-unit-testing.
 *
 * Covers:
 *  1. published StudyFolder + published material -> query succeeds
 *  2. draft StudyFolder + published child material -> inaccessible
 *  3. student opens published folder -> material query succeeds
 *  4. cancelled Battle exists alongside published Battle -> valid battle query still succeeds
 *  5. REGISTERED -> SUBMITTED -> DENY
 *  6. LOBBY -> SUBMITTED -> DENY
 *  7. STARTED -> SUBMITTED -> ALLOW
 *  8. START before startAt -> DENY using request.time
 *  9. START within live window -> ALLOW
 * 10. draft Test Series parent-chain reads remain denied
 */

import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('OFFICIAL FIRESTORE RULES EMULATOR VERIFICATION SUITE');
console.log('================================================================\n');

const rulesPath = path.resolve(__dirname, '../firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');

const PROJECT_ID = 'andaman-quiz-phase-a-test';

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules,
    host: '127.0.0.1',
    port: 8080,
  },
});

try {
  // Clear any existing emulator data
  await testEnv.clearFirestore();

  const now = new Date();
  const past5Min = new Date(now.getTime() - 5 * 60 * 1000);
  const future1Hour = new Date(now.getTime() + 60 * 60 * 1000);
  const future2Hour = new Date(now.getTime() + 120 * 60 * 1000);

  // --- SEED TEST DATA WITH RULES DISABLED (ADMIN SEEDING) ---
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 1. Study Folders & Materials
    await db.doc('study_folders/sf_pub').set({
      id: 'sf_pub',
      title: 'Published History Notes',
      examCode: 'AN POLICE',
      status: 'published',
    });
    await db.doc('study_folders/sf_draft').set({
      id: 'sf_draft',
      title: 'Draft Science Notes',
      examCode: 'AN POLICE',
      status: 'draft',
    });

    await db.doc('study_materials/sm_pub_in_pub_folder').set({
      id: 'sm_pub_in_pub_folder',
      folderId: 'sf_pub',
      title: 'Freedom Struggle PDF',
      status: 'published',
    });
    await db.doc('study_materials/sm_pub_in_draft_folder').set({
      id: 'sm_pub_in_draft_folder',
      folderId: 'sf_draft',
      title: 'Draft Science Child Material',
      status: 'published',
    });
    await db.doc('study_materials/sm_root_pub').set({
      id: 'sm_root_pub',
      folderId: null,
      title: 'Territory Overview PDF',
      status: 'published',
    });

    // 2. Battles
    await db.doc('battles/battle_pub').set({
      id: 'battle_pub',
      title: 'Upcoming Sunday Mega Battle',
      examCode: 'AN CGL',
      isPublished: true,
      status: 'UPCOMING',
      startAt: future1Hour,
      durationMinutes: 90,
    });
    await db.doc('battles/battle_cancelled').set({
      id: 'battle_cancelled',
      title: 'Cancelled Practice Battle',
      examCode: 'AN CGL',
      isPublished: false, // Atomically false on cancellation
      status: 'CANCELLED',
      startAt: future1Hour,
      durationMinutes: 60,
    });
    await db.doc('battles/battle_live_window').set({
      id: 'battle_live_window',
      title: 'Live Battle Now',
      examCode: 'AN CGL',
      isPublished: true,
      status: 'LIVE',
      startAt: past5Min,
      durationMinutes: 60,
      endAt: future1Hour,
    });
    await db.doc('battles/battle_future').set({
      id: 'battle_future',
      title: 'Future Battle Next Week',
      examCode: 'AN CGL',
      isPublished: true,
      status: 'UPCOMING',
      startAt: future2Hour,
      durationMinutes: 60,
    });

    // 3. Battle Registrations
    await db.doc('battles/battle_live_window/registrations/reg_registered').set({
      id: 'reg_registered',
      battleId: 'battle_live_window',
      testId: 't1',
      studentName: 'Rahul',
      installationId: 'inst_1',
      registeredAt: past5Min,
      status: 'REGISTERED',
    });
    await db.doc('battles/battle_live_window/registrations/reg_lobby').set({
      id: 'reg_lobby',
      battleId: 'battle_live_window',
      testId: 't1',
      studentName: 'Amit',
      installationId: 'inst_2',
      registeredAt: past5Min,
      status: 'LOBBY',
    });
    await db.doc('battles/battle_live_window/registrations/reg_started').set({
      id: 'reg_started',
      battleId: 'battle_live_window',
      testId: 't1',
      studentName: 'Priya',
      installationId: 'inst_3',
      registeredAt: past5Min,
      startedAt: past5Min,
      status: 'STARTED',
    });
    await db.doc('battles/battle_future/registrations/reg_future_user').set({
      id: 'reg_future_user',
      battleId: 'battle_future',
      testId: 't1',
      studentName: 'Suresh',
      installationId: 'inst_4',
      registeredAt: past5Min,
      status: 'REGISTERED',
    });

    // 4. Test Series Parent Chain
    await db.doc('test_series/ts_draft').set({
      id: 'ts_draft',
      title: 'Draft Series',
      status: 'draft',
    });
    await db.doc('test_series/ts_draft/folders/f_in_draft').set({
      id: 'f_in_draft',
      seriesId: 'ts_draft',
      title: 'Folder in Draft Series',
      status: 'published',
    });
    await db.doc('test_series/ts_draft/folders/f_in_draft/items/item_in_draft').set({
      id: 'item_in_draft',
      seriesId: 'ts_draft',
      folderId: 'f_in_draft',
      title: 'Item in Draft Series',
      status: 'published',
      testId: 'mock_01',
    });
  });

  const studentContext = testEnv.unauthenticatedContext();
  const studentDb = studentContext.firestore();

  // --- SCENARIO 1: Published StudyFolder + published material -> query succeeds ---
  console.log('1. Testing: published StudyFolder + published material query');
  const qPubMaterials = studentDb
    .collection('study_materials')
    .where('folderId', '==', 'sf_pub')
    .where('status', '==', 'published');
  await assertSucceeds(qPubMaterials.get());
  console.log('  ✓ Query succeeded: student can read materials in published folder.\n');

  // --- SCENARIO 2: Draft StudyFolder + published child material -> inaccessible ---
  console.log('2. Testing: published material inside draft StudyFolder is inaccessible');
  const docInDraftFolder = studentDb.doc('study_materials/sm_pub_in_draft_folder');
  await assertFails(docInDraftFolder.get());
  console.log('  ✓ Blocked: material belonging to draft folder is inaccessible to student.\n');

  // --- SCENARIO 3: Student opens published folder -> material query succeeds ---
  console.log('3. Testing: student opens published folder -> scoped material query');
  const folderMaterials = studentDb
    .collection('study_materials')
    .where('folderId', '==', 'sf_pub')
    .where('status', '==', 'published');
  const snap = await folderMaterials.get();
  if (snap.empty) throw new Error('Expected published materials in folder');
  console.log(`  ✓ Succeeded: returned ${snap.size} published material(s) for folder sf_pub.\n`);

  // --- SCENARIO 4: Cancelled Battle exists alongside published Battle -> valid battle query still succeeds ---
  console.log('4. Testing: published battle query when cancelled battle exists');
  const qBattles = studentDb.collection('battles').where('isPublished', '==', true);
  const snapBattles = await assertSucceeds(qBattles.get());
  console.log(`  ✓ Query succeeded: returned ${snapBattles.size} published battle(s) without permission error.\n`);

  // --- SCENARIO 5: REGISTERED -> SUBMITTED -> DENY ---
  console.log('5. Testing: transition REGISTERED -> SUBMITTED is DENIED');
  const reg1 = studentDb.doc('battles/battle_live_window/registrations/reg_registered');
  await assertFails(
    reg1.update({
      status: 'SUBMITTED',
      submittedAt: new Date(),
      clientScore: 75.0,
      resultStatus: 'PENDING_VERIFICATION',
    })
  );
  console.log('  ✓ DENIED: Student cannot jump directly from REGISTERED to SUBMITTED.\n');

  // --- SCENARIO 6: LOBBY -> SUBMITTED -> DENY ---
  console.log('6. Testing: transition LOBBY -> SUBMITTED is DENIED');
  const reg2 = studentDb.doc('battles/battle_live_window/registrations/reg_lobby');
  await assertFails(
    reg2.update({
      status: 'SUBMITTED',
      submittedAt: new Date(),
      clientScore: 75.0,
      resultStatus: 'PENDING_VERIFICATION',
    })
  );
  console.log('  ✓ DENIED: Student cannot jump directly from LOBBY to SUBMITTED.\n');

  // --- SCENARIO 7: STARTED -> SUBMITTED -> ALLOW ---
  console.log('7. Testing: transition STARTED -> SUBMITTED is ALLOWED');
  const reg3 = studentDb.doc('battles/battle_live_window/registrations/reg_started');
  await assertSucceeds(
    reg3.update({
      status: 'SUBMITTED',
      submittedAt: new Date(),
      clientScore: 84.5,
      clientAccuracy: 92.0,
      timeTakenSeconds: 1800,
      answers: { q1: 2, q2: 4 },
      resultStatus: 'PENDING_VERIFICATION',
    })
  );
  console.log('  ✓ ALLOWED: Student currently in STARTED state successfully submitted telemetry.\n');

  // --- SCENARIO 8: START before startAt -> DENY using request.time ---
  console.log('8. Testing: transition to STARTED before battle.startAt is DENIED by request.time');
  const regFuture = studentDb.doc('battles/battle_future/registrations/reg_future_user');
  await assertFails(
    regFuture.update({
      status: 'STARTED',
      startedAt: new Date(),
    })
  );
  console.log('  ✓ DENIED: Server request.time < battle.startAt enforces start window.\n');

  // --- SCENARIO 9: START within live window -> ALLOW ---
  console.log('9. Testing: transition to STARTED within live battle window is ALLOWED');
  const regLiveToStart = studentDb.doc('battles/battle_live_window/registrations/reg_lobby');
  await assertSucceeds(
    regLiveToStart.update({
      status: 'STARTED',
      startedAt: new Date(),
    })
  );
  console.log('  ✓ ALLOWED: Transition to STARTED permitted within live battle window.\n');

  // --- SCENARIO 10: Draft Test Series parent-chain reads remain denied ---
  console.log('10. Testing: draft Test Series parent-chain reads remain denied');
  await assertFails(studentDb.doc('test_series/ts_draft').get());
  await assertFails(studentDb.doc('test_series/ts_draft/folders/f_in_draft').get());
  await assertFails(studentDb.doc('test_series/ts_draft/folders/f_in_draft/items/item_in_draft').get());
  console.log('  ✓ DENIED: Series, folder, and item in draft chain all inaccessible to students.\n');

  console.log('================================================================');
  console.log('ALL 10 REAL FIRESTORE EMULATOR QUERY & LIFECYCLE TESTS PASSED!');
  console.log('================================================================');
} finally {
  await testEnv.cleanup();
}
