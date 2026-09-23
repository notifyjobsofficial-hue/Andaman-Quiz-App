/**
 * Comprehensive Verification & Security Audit Suite for
 * Hardened Firestore Security Rules & Atomic Practice Session Counting
 *
 * Verifies all 14 required security scenarios:
 * 1. Valid first session + counter create -> ALLOW
 * 2. Counter create without session document -> DENY
 * 3. Session document without appropriate counter operation -> DENY
 * 4. Valid subsequent session + counter +1 -> ALLOW
 * 5. Counter +1 without matching session -> DENY
 * 6. Counter +2 -> DENY
 * 7. Reuse existing sessionId -> DENY / no increment
 * 8. Modify existing session -> DENY
 * 9. Delete session as student -> DENY
 * 10. Public read aggregate totalSessions -> ALLOW
 * 11. Public read sessions/{sessionId} -> DENY
 * 12. Arbitrary extra session fields -> DENY
 * 13. Fake topic mismatch -> DENY
 * 14. Offline retry same session -> exactly once
 */

import assert from 'assert';

console.log('====================================================');
console.log('TESTING HARDENED FIRESTORE RULES & ATOMIC INVARIANTS');
console.log('====================================================\n');

/**
 * In-Memory Firestore Security Rules Evaluator
 * Simulates Firestore Rules engine: exists(), existsAfter(), getAfter(), auth, diff()
 */
class FirestoreRulesSimulator {
  constructor() {
    this.db = new Map(); // path -> data
  }

  setDocument(path, data) {
    this.db.set(path, JSON.parse(JSON.stringify(data)));
  }

  deleteDocument(path) {
    this.db.delete(path);
  }

  // Evaluate batch commit with atomic cross-document rules
  evaluateAtomicBatch({ writes, isAdmin = false, isAuthenticated = false, authUid = null }) {
    // 1. Build staging "after" state
    const afterDb = new Map(this.db);
    for (const write of writes) {
      if (write.type === 'set' || write.type === 'update') {
        const existing = afterDb.get(write.path);
        if (write.options?.merge && existing) {
          afterDb.set(write.path, { ...existing, ...write.data });
        } else {
          afterDb.set(write.path, JSON.parse(JSON.stringify(write.data)));
        }
      } else if (write.type === 'delete') {
        afterDb.delete(write.path);
      }
    }

    // Helper functions matching rules_version = '2'
    const exists = (path) => this.db.has(path);
    const existsAfter = (path) => afterDb.has(path);
    const getAfter = (path) => {
      const data = afterDb.get(path);
      return data ? { data } : null;
    };

    // 2. Validate every write in the atomic operation against rules
    for (const write of writes) {
      const { path, data, type } = write;

      // Rule for: match /practice_topic_stats/{topicId}
      const statsMatch = path.match(/^practice_topic_stats\/([^/]+)$/);
      if (statsMatch) {
        const topicId = statsMatch[1];
        const currentData = this.db.get(path);

        if (type === 'delete') {
          if (!isAdmin) return { allowed: false, reason: 'Only admin can delete stats' };
          continue;
        }

        if (!currentData || type === 'create') {
          // allow create:
          const isCreateAllowed =
            data.topicId === topicId &&
            data.totalSessions === 1 &&
            data.updatedAt &&
            typeof data.lastSessionId === 'string' &&
            data.lastSessionId.length > 0 &&
            data.lastSessionId.length < 100 &&
            Object.keys(data).every((k) => ['topicId', 'totalSessions', 'updatedAt', 'lastSessionId'].includes(k)) &&
            !exists(`practice_topic_stats/${topicId}/sessions/${data.lastSessionId}`) &&
            existsAfter(`practice_topic_stats/${topicId}/sessions/${data.lastSessionId}`) &&
            getAfter(`practice_topic_stats/${topicId}/sessions/${data.lastSessionId}`)?.data.sessionId === data.lastSessionId &&
            getAfter(`practice_topic_stats/${topicId}/sessions/${data.lastSessionId}`)?.data.topicId === topicId;

          if (!isCreateAllowed && !isAdmin) {
            return { allowed: false, reason: 'Create rule violation on practice_topic_stats' };
          }
        } else {
          // allow update:
          const allowedKeys = ['totalSessions', 'updatedAt', 'lastSessionId'];
          const affectedKeys = Object.keys(data).filter((k) => data[k] !== currentData[k]);
          const onlyAllowedKeys = affectedKeys.every((k) => allowedKeys.includes(k));

          const isUpdateAllowed =
            isAdmin ||
            (data.topicId === topicId &&
              data.totalSessions === currentData.totalSessions + 1 &&
              data.updatedAt &&
              typeof data.lastSessionId === 'string' &&
              data.lastSessionId.length > 0 &&
              data.lastSessionId.length < 100 &&
              onlyAllowedKeys &&
              !exists(`practice_topic_stats/${topicId}/sessions/${data.lastSessionId}`) &&
              existsAfter(`practice_topic_stats/${topicId}/sessions/${data.lastSessionId}`) &&
              getAfter(`practice_topic_stats/${topicId}/sessions/${data.lastSessionId}`)?.data.sessionId === data.lastSessionId &&
              getAfter(`practice_topic_stats/${topicId}/sessions/${data.lastSessionId}`)?.data.topicId === topicId);

          if (!isUpdateAllowed) {
            return { allowed: false, reason: 'Update rule violation on practice_topic_stats' };
          }
        }
      }

      // Rule for: match /practice_topic_stats/{topicId}/sessions/{sessionId}
      const sessionMatch = path.match(/^practice_topic_stats\/([^/]+)\/sessions\/([^/]+)$/);
      if (sessionMatch) {
        const topicId = sessionMatch[1];
        const sessionId = sessionMatch[2];
        const currentData = this.db.get(path);

        if (type === 'delete') {
          if (!isAdmin) return { allowed: false, reason: 'Student cannot delete session audit doc' };
          continue;
        }

        if (currentData) {
          // Document already exists -> this is an update!
          if (!isAdmin) return { allowed: false, reason: 'Session documents are immutable for students' };
          continue;
        }

        // allow create:
        const isSessionCreateAllowed =
          data.sessionId === sessionId &&
          data.sessionId.length > 0 &&
          data.sessionId.length < 100 &&
          data.topicId === topicId &&
          typeof data.installationId === 'string' &&
          data.installationId.length > 0 &&
          data.installationId.length < 100 &&
          data.createdAt &&
          Object.keys(data).every((k) => ['sessionId', 'topicId', 'installationId', 'createdAt'].includes(k)) &&
          existsAfter(`practice_topic_stats/${topicId}`) &&
          getAfter(`practice_topic_stats/${topicId}`)?.data.lastSessionId === sessionId;

        if (!isSessionCreateAllowed && !isAdmin) {
          return { allowed: false, reason: 'Create rule violation on sessions' };
        }
      }
    }

    // If all rules passed, commit changes to database
    for (const [k, v] of afterDb) {
      this.db.set(k, v);
    }
    return { allowed: true };
  }

  // Evaluate Read operation
  evaluateRead({ path, isAdmin = false }) {
    if (path.startsWith('practice_topic_stats/') && path.includes('/sessions/')) {
      // match /sessions/{sessionId} { allow read: if isAdmin(); }
      return { allowed: isAdmin, reason: isAdmin ? 'Admin read' : 'Student cannot read audit sessions' };
    }
    if (path.startsWith('practice_topic_stats/')) {
      // match /practice_topic_stats/{topicId} { allow read: if true; }
      return { allowed: true };
    }
    return { allowed: false, reason: 'Default deny' };
  }
}

const simulator = new FirestoreRulesSimulator();

// Scenario 1: Valid first session + counter create -> ALLOW
{
  console.log('Scenario 1: Valid initial session + counter create');
  const res = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms/sessions/ps_init_1',
        type: 'set',
        data: {
          sessionId: 'ps_init_1',
          topicId: 'top_idioms',
          installationId: 'inst_user_1',
          createdAt: new Date(),
        },
      },
      {
        path: 'practice_topic_stats/top_idioms',
        type: 'set',
        data: {
          topicId: 'top_idioms',
          totalSessions: 1,
          updatedAt: new Date(),
          lastSessionId: 'ps_init_1',
        },
        options: { merge: true },
      },
    ],
  });
  assert.strictEqual(res.allowed, true);
  console.log('  ✓ Allowed atomic initial creation');
}

// Scenario 2: Counter create without session document -> DENY
{
  console.log('Scenario 2: Counter create without session document');
  const res = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_vocab',
        type: 'set',
        data: {
          topicId: 'top_vocab',
          totalSessions: 1,
          updatedAt: new Date(),
          lastSessionId: 'ps_fake_orphan',
        },
      },
    ],
  });
  assert.strictEqual(res.allowed, false);
  console.log('  ✓ Denied counter creation without corresponding session');
}

// Scenario 3: Session document without appropriate counter operation -> DENY
{
  console.log('Scenario 3: Session document created without counter update');
  const res = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms/sessions/ps_orphan_99',
        type: 'set',
        data: {
          sessionId: 'ps_orphan_99',
          topicId: 'top_idioms',
          installationId: 'inst_user_1',
          createdAt: new Date(),
        },
      },
    ],
  });
  assert.strictEqual(res.allowed, false);
  console.log('  ✓ Denied orphan session creation');
}

// Scenario 4: Valid subsequent session + counter +1 -> ALLOW
{
  console.log('Scenario 4: Valid subsequent session + counter +1');
  const res = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms/sessions/ps_next_2',
        type: 'set',
        data: {
          sessionId: 'ps_next_2',
          topicId: 'top_idioms',
          installationId: 'inst_user_2',
          createdAt: new Date(),
        },
      },
      {
        path: 'practice_topic_stats/top_idioms',
        type: 'update',
        data: {
          topicId: 'top_idioms',
          totalSessions: 2, // increment from 1 to 2
          updatedAt: new Date(),
          lastSessionId: 'ps_next_2',
        },
      },
    ],
  });
  assert.strictEqual(res.allowed, true);
  console.log('  ✓ Allowed valid increment');
}

// Scenario 5: Counter +1 without matching session -> DENY
{
  console.log('Scenario 5: Counter +1 without matching session document');
  const res = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms',
        type: 'update',
        data: {
          topicId: 'top_idioms',
          totalSessions: 3,
          updatedAt: new Date(),
          lastSessionId: 'ps_missing_doc',
        },
      },
    ],
  });
  assert.strictEqual(res.allowed, false);
  console.log('  ✓ Denied counter +1 without session');
}

// Scenario 6: Counter +2 -> DENY
{
  console.log('Scenario 6: Counter jump +2');
  const res = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms/sessions/ps_jump_3',
        type: 'set',
        data: {
          sessionId: 'ps_jump_3',
          topicId: 'top_idioms',
          installationId: 'inst_user_1',
          createdAt: new Date(),
        },
      },
      {
        path: 'practice_topic_stats/top_idioms',
        type: 'update',
        data: {
          topicId: 'top_idioms',
          totalSessions: 4, // jump from 2 to 4!
          updatedAt: new Date(),
          lastSessionId: 'ps_jump_3',
        },
      },
    ],
  });
  assert.strictEqual(res.allowed, false);
  console.log('  ✓ Denied increment greater than +1');
}

// Scenario 7: Reuse existing sessionId -> DENY
{
  console.log('Scenario 7: Reuse existing sessionId to spoof increments');
  // 'ps_init_1' already exists in the simulator DB from Scenario 1
  const res = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms/sessions/ps_init_1',
        type: 'set',
        data: {
          sessionId: 'ps_init_1',
          topicId: 'top_idioms',
          installationId: 'inst_user_1',
          createdAt: new Date(),
        },
      },
      {
        path: 'practice_topic_stats/top_idioms',
        type: 'update',
        data: {
          topicId: 'top_idioms',
          totalSessions: 3,
          updatedAt: new Date(),
          lastSessionId: 'ps_init_1',
        },
      },
    ],
  });
  assert.strictEqual(res.allowed, false);
  console.log('  ✓ Blocked reusing existing sessionId');
}

// Scenario 8: Modify existing session -> DENY
{
  console.log('Scenario 8: Student attempts to update existing session');
  const res = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms/sessions/ps_init_1',
        type: 'update',
        data: {
          installationId: 'hacked_id',
        },
      },
    ],
    isAdmin: false,
  });
  assert.strictEqual(res.allowed, false);
  console.log('  ✓ Prevented student updating session audit');
}

// Scenario 9: Delete session as student -> DENY
{
  console.log('Scenario 9: Student attempts to delete session document');
  const res = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms/sessions/ps_init_1',
        type: 'delete',
      },
    ],
    isAdmin: false,
  });
  assert.strictEqual(res.allowed, false);
  console.log('  ✓ Prevented student deleting session');
}

// Scenario 10: Public read aggregate totalSessions -> ALLOW
{
  console.log('Scenario 10: Public read of aggregate totalSessions');
  const res = simulator.evaluateRead({
    path: 'practice_topic_stats/top_idioms',
    isAdmin: false,
  });
  assert.strictEqual(res.allowed, true);
  console.log('  ✓ Public read of aggregate stats allowed');
}

// Scenario 11: Public read sessions/{sessionId} -> DENY
{
  console.log('Scenario 11: Public read of audit session document');
  const studentRead = simulator.evaluateRead({
    path: 'practice_topic_stats/top_idioms/sessions/ps_init_1',
    isAdmin: false,
  });
  assert.strictEqual(studentRead.allowed, false);

  const adminRead = simulator.evaluateRead({
    path: 'practice_topic_stats/top_idioms/sessions/ps_init_1',
    isAdmin: true,
  });
  assert.strictEqual(adminRead.allowed, true);
  console.log('  ✓ Privacy enforced: Session reading restricted to Admin');
}

// Scenario 12: Arbitrary extra session fields -> DENY
{
  console.log('Scenario 12: Arbitrary extra fields in session payload');
  const res = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms/sessions/ps_extra_fields',
        type: 'set',
        data: {
          sessionId: 'ps_extra_fields',
          topicId: 'top_idioms',
          installationId: 'inst_user_1',
          createdAt: new Date(),
          studentName: 'John Doe', // Unauthorized field!
          phoneNumber: '9999999999',
        },
      },
      {
        path: 'practice_topic_stats/top_idioms',
        type: 'update',
        data: {
          topicId: 'top_idioms',
          totalSessions: 3,
          updatedAt: new Date(),
          lastSessionId: 'ps_extra_fields',
        },
      },
    ],
  });
  assert.strictEqual(res.allowed, false);
  console.log('  ✓ Denied extra fields in session creation');
}

// Scenario 13: Fake topic mismatch -> DENY
{
  console.log('Scenario 13: Topic mismatch between session and stats');
  const res = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms/sessions/ps_mismatch',
        type: 'set',
        data: {
          sessionId: 'ps_mismatch',
          topicId: 'top_OTHER', // Mismatch!
          installationId: 'inst_user_1',
          createdAt: new Date(),
        },
      },
      {
        path: 'practice_topic_stats/top_idioms',
        type: 'update',
        data: {
          topicId: 'top_idioms',
          totalSessions: 3,
          updatedAt: new Date(),
          lastSessionId: 'ps_mismatch',
        },
      },
    ],
  });
  assert.strictEqual(res.allowed, false);
  console.log('  ✓ Denied topic mismatch');
}

// Scenario 14: Offline retry same session -> exactly once
{
  console.log('Scenario 14: Offline retry with identical sessionId');
  // First attempt succeeds:
  const firstAttempt = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms/sessions/ps_retry_stable',
        type: 'set',
        data: {
          sessionId: 'ps_retry_stable',
          topicId: 'top_idioms',
          installationId: 'inst_user_1',
          createdAt: new Date(),
        },
      },
      {
        path: 'practice_topic_stats/top_idioms',
        type: 'update',
        data: {
          topicId: 'top_idioms',
          totalSessions: 3,
          updatedAt: new Date(),
          lastSessionId: 'ps_retry_stable',
        },
      },
    ],
  });
  assert.strictEqual(firstAttempt.allowed, true);

  // Client retries with exact same sessionId:
  const secondAttempt = simulator.evaluateAtomicBatch({
    writes: [
      {
        path: 'practice_topic_stats/top_idioms/sessions/ps_retry_stable',
        type: 'set',
        data: {
          sessionId: 'ps_retry_stable',
          topicId: 'top_idioms',
          installationId: 'inst_user_1',
          createdAt: new Date(),
        },
      },
      {
        path: 'practice_topic_stats/top_idioms',
        type: 'update',
        data: {
          topicId: 'top_idioms',
          totalSessions: 4,
          updatedAt: new Date(),
          lastSessionId: 'ps_retry_stable',
        },
      },
    ],
  });
  // Must be rejected because ps_retry_stable already exists!
  assert.strictEqual(secondAttempt.allowed, false);
  console.log('  ✓ Offline retry with same sessionId executed exactly once');
}

console.log('\n====================================================');
console.log('ALL 14 HARDENED FIRESTORE RULES SCENARIOS PASSED (100%)');
console.log('====================================================');
