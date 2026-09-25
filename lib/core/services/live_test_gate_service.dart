import 'package:flutter/foundation.dart';
import '../database/local_database.dart';
import '../models/models.dart';
import 'firestore_service.dart';

enum LiveTestGateStatus {
  allowed,
  mockNotFound,
  mockNotPublished,
  liveTestNotFound,
  liveTestNotPublished,
  notRegistered,
  upcomingBeforeStart,
  testEnded,
  paymentRequired,
}

class LiveTestGateDecision {
  final bool isAllowed;
  final LiveTestGateStatus status;
  final String message;
  final LiveTestItem? liveTest;
  final MockTest? mockTest;
  final LiveTestRegistration? registration;

  const LiveTestGateDecision({
    required this.isAllowed,
    required this.status,
    required this.message,
    this.liveTest,
    this.mockTest,
    this.registration,
  });

  factory LiveTestGateDecision.allowed({
    required LiveTestItem? liveTest,
    required MockTest mockTest,
    LiveTestRegistration? registration,
  }) => LiveTestGateDecision(
    isAllowed: true,
    status: LiveTestGateStatus.allowed,
    message: 'Access granted.',
    liveTest: liveTest,
    mockTest: mockTest,
    registration: registration,
  );

  factory LiveTestGateDecision.blocked({
    required LiveTestGateStatus status,
    required String message,
    LiveTestItem? liveTest,
    MockTest? mockTest,
    LiveTestRegistration? registration,
  }) => LiveTestGateDecision(
    isAllowed: false,
    status: status,
    message: message,
    liveTest: liveTest,
    mockTest: mockTest,
    registration: registration,
  );
}

class LiveTestGateService {
  /// Evaluates whether the current student is permitted to access/enter a mock or live test.
  /// Enforces:
  /// 1. Canonical Publication: Linked mock MUST be PUBLISHED (DRAFT is NEVER student-visible).
  /// 2. Live Test Publication: Live test item must be published.
  /// 3. Registration: Student must be registered (Name entered, persisted).
  /// 4. Time Window: Current trusted time must be strictly within [startAt, endAt).
  ///    now < startAt  -> UPCOMING (BLOCKED)
  ///    startAt <= now < endAt -> LIVE (ALLOWED if registered)
  ///    now >= endAt   -> ENDED (BLOCKED)
  /// 5. Entitlement: FREE tests allowed; PAID tests require valid unlocked entitlement.
  ///
  /// COMPETITIVE INTEGRITY: allowEarlyJoin is ignored as an early entry bypass.
  static LiveTestGateDecision evaluateAccess({
    required String testIdOrLiveTestId,
    LiveTestItem? liveTest,
    MockTest? mockTest,
    LiveTestRegistration? registration,
    DateTime? trustedNow,
  }) {
    final tid = testIdOrLiveTestId.trim();

    // 1. Resolve LiveTestItem if applicable
    final lt = liveTest
        ?? LocalDatabase.instance.getLiveTestByTestId(tid)
        ?? LocalDatabase.instance.getLiveTestById(tid);

    // 2. Resolve MockTest
    final targetMockId = lt?.testId ?? tid;
    final mock = mockTest ?? LocalDatabase.instance.getMockTestById(targetMockId);

    // 3. Rule 1: Canonical Mock Content & Status
    if (mock == null) {
      return LiveTestGateDecision.blocked(
        status: LiveTestGateStatus.mockNotFound,
        message: 'The examination content for this test is not available.',
        liveTest: lt,
      );
    }

    if (mock.status.toLowerCase() != 'published') {
      debugPrint('LiveTestGateService: Blocked access because mock ${mock.id} is in status "${mock.status}".');
      return LiveTestGateDecision.blocked(
        status: LiveTestGateStatus.mockNotPublished,
        message: 'This examination is currently in Draft and is not available to students.',
        liveTest: lt,
        mockTest: mock,
      );
    }

    // 4. If this is NOT a Live Test, evaluate as a standard mock test
    if (lt == null) {
      if (!mock.isFree) {
        final isUnlocked = LocalDatabase.instance.isTestUnlocked(mock);
        if (!isUnlocked) {
          return LiveTestGateDecision.blocked(
            status: LiveTestGateStatus.paymentRequired,
            message: 'This is a premium mock test. Please unlock or purchase to access.',
            mockTest: mock,
          );
        }
      }
      return LiveTestGateDecision.allowed(
        liveTest: null,
        mockTest: mock,
      );
    }

    // --- LIVE TEST SPECIFIC GATING ---

    // 5. Rule 2: Live Test Publication
    if (!lt.isPublished) {
      return LiveTestGateDecision.blocked(
        status: LiveTestGateStatus.liveTestNotPublished,
        message: 'This scheduled Live Test is not currently published.',
        liveTest: lt,
        mockTest: mock,
      );
    }

    // 6. Rule 3: Registration Requirement
    final reg = registration ?? LocalDatabase.instance.getLiveTestRegistration(lt.id);
    if (reg == null) {
      return LiveTestGateDecision.blocked(
        status: LiveTestGateStatus.notRegistered,
        message: 'You must register for this Live Test before entering.',
        liveTest: lt,
        mockTest: mock,
      );
    }

    // 7. Rule 4: Time Window Check (Publication eligibility FIRST, timer state SECOND)
    final now = trustedNow ?? FirestoreService.instance.getTrustedNow();

    // UPCOMING: now < startAt
    if (now.isBefore(lt.startAt)) {
      final remaining = lt.startAt.difference(now);
      final hours = remaining.inHours.toString().padLeft(2, '0');
      final mins = (remaining.inMinutes % 60).toString().padLeft(2, '0');
      final secs = (remaining.inSeconds % 60).toString().padLeft(2, '0');
      return LiveTestGateDecision.blocked(
        status: LiveTestGateStatus.upcomingBeforeStart,
        message: 'The test starts in $hours:$mins:$secs. Entry is blocked until the scheduled start time.',
        liveTest: lt,
        mockTest: mock,
        registration: reg,
      );
    }

    // ENDED: now >= endAt
    if (now.isAfter(lt.endAt) || now.isAtSameMomentAs(lt.endAt)) {
      return LiveTestGateDecision.blocked(
        status: LiveTestGateStatus.testEnded,
        message: 'This scheduled Live Test has ended. New entries are no longer accepted.',
        liveTest: lt,
        mockTest: mock,
        registration: reg,
      );
    }

    // 8. Rule 5: Entitlement Check for Paid Tests
    if (!mock.isFree) {
      final isUnlocked = LocalDatabase.instance.isTestUnlocked(mock);
      if (!isUnlocked) {
        return LiveTestGateDecision.blocked(
          status: LiveTestGateStatus.paymentRequired,
          message: 'This is a premium Live Test. Please complete purchase to enter.',
          liveTest: lt,
          mockTest: mock,
          registration: reg,
        );
      }
    }

    // All conditions satisfied: Access granted
    return LiveTestGateDecision.allowed(
      liveTest: lt,
      mockTest: mock,
      registration: reg,
    );
  }
}
