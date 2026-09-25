import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/core/providers/app_providers.dart';
import 'package:andaman_quiz/features/home/presentation/widgets/live_test_home_card.dart';
import 'package:andaman_quiz/features/tests/presentation/test_instructions_screen.dart';
import 'package:andaman_quiz/features/exam/presentation/cbt_exam_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  setUp(() async {
    await LocalDatabase.instance.resetForTesting();
    SharedPreferences.setMockInitialValues({});
    await LocalDatabase.instance.init();
  });

  group('Mandatory Regression Test: Live Test Resolution & CBT Flow', () {
    testWidgets('1. Mandatory: mock_123 linked to live_456 resolves mock_123 in Instructions and CBT',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final now = DateTime.now();

      // 1. Create underlying mock test with ID: mock_123
      const mockId = 'mock_123';
      const liveId = 'live_456';

      final mockTest = MockTest(
        id: mockId,
        title: 'A & N MTS 01',
        examCode: 'AN MTS',
        durationMinutes: 120,
        totalQuestions: 100,
        totalMarks: 100.0,
        negativeMarks: 0.25,
        sections: [
          TestSection(
            id: 'sec_1',
            name: 'General Intelligence',
            hindiName: '',
            questionIds: ['q_mts_1'],
          ),
        ],
      );

      final question = Question(
        id: 'q_mts_1',
        subjectId: 'gi',
        topicId: 'reasoning',
        examTags: ['AN MTS'],
        questionEn: 'Which is the capital of Andaman and Nicobar Islands?',
        questionHi: '',
        optionsEn: ['Port Blair', 'Diglipur', 'Mayabunder', 'Havelock'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: 'Port Blair is the capital city.',
        explanationHi: '',
        positiveMarks: 1.0,
        negativeMarks: 0.25,
      );

      // Sync mock test and questions into local database
      await LocalDatabase.instance.syncMockTestsFromFirestore([mockTest]);
      await LocalDatabase.instance.syncQuestionsFromFirestore([question]);

      // 2. Create Live Test with ID: live_456 and canonical testId: mock_123
      final liveTest = LiveTestItem(
        id: liveId,
        testId: mockId, // Canonical linked test ID: mock_123
        title: 'A & N MTS 01 Live Exam',
        startAt: now.subtract(const Duration(minutes: 10)),
        endAt: now.add(const Duration(minutes: 110)),
        isPublished: true,
      );

      // Verify canonical testId and backward-compatible mockTestId
      expect(liveTest.testId, mockId);
      expect(liveTest.mockTestId, mockId);
      expect(liveTest.id, liveId);
      expect(liveTest.status, LiveTestStatus.live);

      // 3. Set up GoRouter to test real navigation flow
      String? instructionsReceivedTestId;
      String? cbtReceivedTestId;

      final router = GoRouter(
        initialLocation: '/home',
        routes: [
          GoRoute(
            path: '/home',
            builder: (context, state) => const Scaffold(
              body: SingleChildScrollView(child: LiveTestHomeCard()),
            ),
          ),
          GoRoute(
            path: '/tests/instructions/:id',
            builder: (context, state) {
              instructionsReceivedTestId = state.pathParameters['id'];
              return TestInstructionsScreen(testId: instructionsReceivedTestId!);
            },
          ),
          GoRoute(
            path: '/tests/cbt/:id',
            builder: (context, state) {
              cbtReceivedTestId = state.pathParameters['id'];
              return CbtExamScreen(testId: cbtReceivedTestId!);
            },
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            liveTestsStreamProvider.overrideWith((ref) => Stream<List<LiveTestItem>>.value([liveTest])),
          ],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();

      // Assert Confirmed Bug #2: Section Heading 'Live Tests' appears above the card
      expect(find.text('Live Tests'), findsOneWidget);
      expect(find.text('LIVE NOW'), findsOneWidget);
      expect(find.text('A & N MTS 01 Live Exam'), findsOneWidget);
      // Assert genuine questions and minutes (100 Questions • 120 Minutes)
      expect(find.text('100 Questions • 120 Minutes'), findsOneWidget);
      expect(find.text('JOIN TEST'), findsOneWidget);

      // Pre-register student for the live test
      await LocalDatabase.instance.saveLiveTestRegistration(
        LiveTestRegistration(
          id: 'reg_123',
          liveTestId: liveId,
          testId: mockId,
          studentName: 'Test Student',
          installationId: 'inst_123',
          registeredAt: now,
          status: 'REGISTERED',
        ),
      );

      // Tap JOIN TEST (opens Details sheet)
      await tester.tap(find.text('JOIN TEST'));
      await tester.pumpAndSettle();

      // Tap ENTER TEST on details sheet to proceed to instructions
      if (find.text('ENTER TEST').evaluate().isNotEmpty) {
        await tester.tap(find.text('ENTER TEST'));
        await tester.pumpAndSettle();
      }

      // MANDATORY ASSERTION: Instructions received mock_123, NOT live_456
      expect(instructionsReceivedTestId, equals('mock_123'));
      expect(instructionsReceivedTestId, isNot(equals('live_456')));

      // Assert Instructions screen loaded successfully without "Test not found."
      expect(find.text('Test not found.'), findsNothing);
      expect(find.text('Test Unavailable'), findsNothing);
      expect(find.text('Test Instructions'), findsOneWidget);
      expect(find.text('A & N MTS 01'), findsOneWidget);
      expect(find.text('I am ready to begin'), findsOneWidget);

      // Tap CTA to start test
      await tester.tap(find.text('I am ready to begin'));
      await tester.pumpAndSettle();

      // MANDATORY ASSERTION: CBT received mock_123, NOT live_456
      expect(cbtReceivedTestId, equals('mock_123'));
      expect(cbtReceivedTestId, isNot(equals('live_456')));

      // Assert CBT renders question cleanly
      expect(find.text('Which is the capital of Andaman and Nicobar Islands?'), findsOneWidget);
      expect(find.text('Port Blair'), findsOneWidget);
    });

    testWidgets('2. Bug #2: Live Tests heading and card are hidden when no live or upcoming test exists',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            liveTestsStreamProvider.overrideWith((ref) => Stream<List<LiveTestItem>>.value([])),
          ],
          child: const MaterialApp(
            home: Scaffold(body: LiveTestHomeCard()),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Heading and card must both be absent
      expect(find.text('Live Tests'), findsNothing);
      expect(find.text('LIVE NOW'), findsNothing);
      expect(find.text('JOIN TEST'), findsNothing);
    });

    test('3. Ended Live Test: status is ended and remainingDuration is zero', () {
      final now = DateTime.now();
      final ended = LiveTestItem(
        id: 'ended_1',
        testId: 'mock_ended',
        title: 'Past Exam',
        startAt: now.subtract(const Duration(hours: 3)),
        endAt: now.subtract(const Duration(hours: 1)),
      );

      expect(ended.status, LiveTestStatus.ended);
      expect(ended.remainingDuration, Duration.zero);
    });

    test('4. Upcoming Live Test: status is upcoming and derives duration from startAt', () {
      final now = DateTime.now();
      final upcoming = LiveTestItem(
        id: 'up_1',
        testId: 'mock_up',
        title: 'Upcoming Exam',
        startAt: now.add(const Duration(hours: 2)),
        endAt: now.add(const Duration(hours: 4)),
      );

      expect(upcoming.status, LiveTestStatus.upcoming);
      expect(upcoming.remainingDuration.inMinutes, greaterThan(115));
    });

    test('5. Flexible Subject to Exam matching: CGL matches AN CGL, ANCGL, and global subjects', () {
      const subjectCgl = Subject(
        id: 'sub_math',
        name: 'Quantitative Aptitude',
        hindiName: '',
        iconName: 'book',
        questionCount: 50,
        examCodes: ['CGL', 'CHSL'],
      );

      const subjectGlobal = Subject(
        id: 'sub_gk',
        name: 'General Awareness',
        hindiName: '',
        iconName: 'book',
        questionCount: 100,
        examCodes: [], // Global to all exams
      );

      const subjectPoliceOnly = Subject(
        id: 'sub_law',
        name: 'Police Regulations',
        hindiName: '',
        iconName: 'book',
        questionCount: 30,
        examCodes: ['POLICE'],
      );

      // Test with student selected exam: 'AN CGL'
      expect(subjectCgl.matchesExam('AN CGL'), isTrue);
      expect(subjectCgl.matchesExam('ANCGL'), isTrue);
      expect(subjectCgl.matchesExam('cgl'), isTrue);
      expect(subjectCgl.matchesExam('ALL'), isTrue);

      // Global subject matches all
      expect(subjectGlobal.matchesExam('AN CGL'), isTrue);
      expect(subjectGlobal.matchesExam('AN MTS'), isTrue);

      // Unrelated exam does not match
      expect(subjectPoliceOnly.matchesExam('AN CGL'), isFalse);
    });

    testWidgets('6. Continue Practice Retake with deleted test renders graceful unavailable UI (no raw Test not found)',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: TestInstructionsScreen(testId: 'deleted_nonexistent_mock'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Assert graceful unavailable UI is rendered
      expect(find.text('Test not found.'), findsNothing);
      expect(find.text('Test Unavailable'), findsOneWidget);
      expect(find.text('Browse Available Tests'), findsOneWidget);
    });
  });
}
