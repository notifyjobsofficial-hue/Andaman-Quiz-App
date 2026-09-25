import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/core/providers/app_providers.dart';
import 'package:andaman_quiz/core/services/live_test_gate_service.dart';
import 'package:andaman_quiz/features/home/presentation/widgets/live_test_home_card.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  setUp(() async {
    await LocalDatabase.instance.resetForTesting();
    SharedPreferences.setMockInitialValues({});
    await LocalDatabase.instance.init();
  });

  group('Live Test Draft Isolation & Registration Lifecycle Tests', () {
    test('1. Draft Mock Isolation: draft mock is rejected and never returned in student queries', () async {
      const draftMock = MockTest(
        id: 'mock_1789905785741',
        title: 'A & N MTS 01',
        examCode: 'AN MTS',
        durationMinutes: 120,
        totalQuestions: 100,
        totalMarks: 100.0,
        negativeMarks: 0.25,
        sections: [],
        status: 'draft',
      );

      // Attempt to sync draft mock
      await LocalDatabase.instance.syncMockTestsFromFirestore([draftMock]);

      // Assert draft mock is completely evicted and rejected from student access
      expect(LocalDatabase.instance.getMockTestById('mock_1789905785741'), isNull);
      expect(LocalDatabase.instance.getMockTests(), isEmpty);
    });

    test('2. Live Test linked to Draft Mock is completely hidden and blocked by GateService', () async {
      final now = DateTime.now();

      // Mock is DRAFT
      const draftMock = MockTest(
        id: 'mock_1789905785741',
        title: 'A & N MTS 01',
        examCode: 'AN MTS',
        durationMinutes: 120,
        totalQuestions: 100,
        totalMarks: 100.0,
        negativeMarks: 0.25,
        sections: [],
        status: 'draft',
      );

      // Live test is marked published
      final liveTest = LiveTestItem(
        id: 'live_1789905676042',
        testId: 'mock_1789905785741',
        title: 'A & N MTS 01 Live Exam',
        startAt: now.subtract(const Duration(minutes: 10)),
        endAt: now.add(const Duration(minutes: 110)),
        isPublished: true,
      );

      await LocalDatabase.instance.syncMockTestsFromFirestore([draftMock]);
      await LocalDatabase.instance.syncLiveTestsFromFirestore([liveTest]);

      // LocalDatabase queries must filter it out
      expect(LocalDatabase.instance.getLiveTests(), isEmpty);
      expect(LocalDatabase.instance.getActiveOrUpcomingLiveTest(), isNull);

      // LiveTestGateService must reject it
      final decision = LiveTestGateService.evaluateAccess(
        testIdOrLiveTestId: liveTest.id,
        mockTest: draftMock,
      );
      expect(decision.isAllowed, isFalse);
      expect(decision.status, equals(LiveTestGateStatus.mockNotPublished));
    });

    testWidgets('3. Home Card: Draft Mock Live Test renders NOTHING (SizedBox.shrink)', (tester) async {
      final now = DateTime.now();

      final liveTest = LiveTestItem(
        id: 'live_1789905676042',
        testId: 'mock_1789905785741',
        title: 'A & N MTS 01 Live Exam',
        startAt: now.subtract(const Duration(minutes: 10)),
        endAt: now.add(const Duration(minutes: 110)),
        isPublished: true,
      );

      // Even if the live test stream emits it, Home Card verifies linked mock publication
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            liveTestsStreamProvider.overrideWith((ref) => Stream<List<LiveTestItem>>.value([liveTest])),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: LiveTestHomeCard(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Card must be completely hidden
      expect(find.text('Live Tests'), findsNothing);
      expect(find.text('A & N MTS 01 Live Exam'), findsNothing);
      expect(find.text('LIVE NOW'), findsNothing);
      expect(find.text('JOIN TEST'), findsNothing);
    });

    test('4. Registration Lifecycle: REGISTERED -> STARTED -> SUBMITTED transitions', () async {
      final now = DateTime.now();
      const mockId = 'mock_published_001';
      const liveId = 'live_published_001';

      final publishedMock = const MockTest(
        id: mockId,
        title: 'Published Test',
        examCode: 'AN CGL',
        durationMinutes: 60,
        totalQuestions: 50,
        totalMarks: 100.0,
        negativeMarks: 0.25,
        sections: [],
        status: 'published',
      );

      final liveTest = LiveTestItem(
        id: liveId,
        testId: mockId,
        title: 'Published Live Exam',
        startAt: now.subtract(const Duration(minutes: 5)),
        endAt: now.add(const Duration(minutes: 55)),
        isPublished: true,
      );

      await LocalDatabase.instance.syncMockTestsFromFirestore([publishedMock]);
      await LocalDatabase.instance.syncLiveTestsFromFirestore([liveTest]);

      // Step A: Not registered -> Gate blocks access
      final unregDecision = LiveTestGateService.evaluateAccess(
        testIdOrLiveTestId: liveId,
        mockTest: publishedMock,
      );
      expect(unregDecision.isAllowed, isFalse);
      expect(unregDecision.status, equals(LiveTestGateStatus.notRegistered));

      // Step B: Student registers
      final reg = LiveTestRegistration(
        id: 'reg_user_001',
        liveTestId: liveId,
        testId: mockId,
        studentName: 'Rohan Sharma',
        mobile: '9876543210',
        installationId: 'device_uuid_001',
        registeredAt: now,
        status: 'REGISTERED',
      );
      await LocalDatabase.instance.saveLiveTestRegistration(reg);

      final fetchedReg = LocalDatabase.instance.getLiveTestRegistration(liveId);
      expect(fetchedReg, isNotNull);
      expect(fetchedReg!.studentName, 'Rohan Sharma');
      expect(fetchedReg.status, 'REGISTERED');

      // Step C: Gate allows access now that user is registered and test is live
      final allowedDecision = LiveTestGateService.evaluateAccess(
        testIdOrLiveTestId: liveId,
        mockTest: publishedMock,
      );
      expect(allowedDecision.isAllowed, isTrue);
      expect(allowedDecision.status, equals(LiveTestGateStatus.allowed));

      // Step D: Transition to STARTED upon CBT entry
      await LocalDatabase.instance.updateLiveTestRegistrationStatus(
        liveId,
        'STARTED',
        startedAt: DateTime.now(),
      );
      final startedReg = LocalDatabase.instance.getLiveTestRegistration(liveId);
      expect(startedReg!.status, 'STARTED');
      expect(startedReg.startedAt, isNotNull);

      // Step E: Transition to SUBMITTED upon exam submission
      await LocalDatabase.instance.updateLiveTestRegistrationStatus(
        liveId,
        'SUBMITTED',
        submittedAt: DateTime.now(),
        score: 78.5,
      );
      final submittedReg = LocalDatabase.instance.getLiveTestRegistration(liveId);
      expect(submittedReg!.status, 'SUBMITTED');
      expect(submittedReg.submittedAt, isNotNull);
      expect(submittedReg.score, 78.5);
    });
  });
}
