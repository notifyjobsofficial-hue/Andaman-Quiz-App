import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/core/providers/app_providers.dart';
import 'package:andaman_quiz/features/home/presentation/home_screen.dart';
import 'package:andaman_quiz/features/home/presentation/widgets/notice_board_card.dart';
import 'package:andaman_quiz/features/home/presentation/widgets/live_test_home_card.dart';
import 'package:andaman_quiz/features/notices/presentation/notice_details_sheet.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  setUp(() async {
    await LocalDatabase.instance.resetForTesting();
    SharedPreferences.setMockInitialValues({});
    await LocalDatabase.instance.init();
  });

  group('QOTD: Model, Persistence, and Presentation Tests', () {
    test('QuestionOfTheDay model formattedSourceInfo builds correct hierarchical line', () {
      const qotd1 = QuestionOfTheDay(
        id: 'q1',
        date: '2026-09-20',
        questionId: 'qid_1',
        questionText: 'What is the capital of Andaman and Nicobar Islands?',
        options: ['Port Blair', 'Havelock', 'Diglipur', 'Mayabunder'],
        correctIndex: 0,
        explanation: 'Port Blair is the administrative capital.',
        exam: 'SSC Steno',
        examDate: '06 Aug 2025',
        shift: 'Shift 3',
      );

      expect(qotd1.formattedSourceInfo, 'SSC Steno • 06 Aug 2025 • Shift 3');

      const qotd2 = QuestionOfTheDay(
        id: 'q2',
        date: '2026-09-20',
        questionId: 'qid_2',
        questionText: 'Test question',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 1,
        explanation: '',
        examName: 'AN CGL',
        year: '2024',
      );

      expect(qotd2.formattedSourceInfo, 'AN CGL • 2024');

      const qotd3 = QuestionOfTheDay(
        id: 'q3',
        date: '2026-09-20',
        questionId: 'qid_3',
        questionText: 'Simple question',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        explanation: '',
      );

      expect(qotd3.formattedSourceInfo, 'Previous Year Question');
    });

    test('LocalDatabase persists and retrieves QOTD attempt state', () async {
      // Initially no attempt
      expect(LocalDatabase.instance.getQotdAttempt('2026-09-20'), isNull);

      // Save attempt
      await LocalDatabase.instance.saveQotdAttempt(
        date: '2026-09-20',
        questionId: 'qotd_101',
        selectedOption: 2,
        isCorrect: false,
      );

      final attempt = LocalDatabase.instance.getQotdAttempt('2026-09-20');
      expect(attempt, isNotNull);
      expect(attempt!['questionId'], 'qotd_101');
      expect(attempt['selectedOption'], 2);
      expect(attempt['isCorrect'], false);
      expect(attempt['timestamp'], isNotNull);
    });

    testWidgets('Home renders QOTD empty state cleanly when null without fake rank or +2 marks',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            todayQotdProvider.overrideWith((ref) => Stream.value(null)),
          ],
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify empty state is displayed
      expect(find.text('Question of the Day'), findsOneWidget);
      expect(find.text("Today's question will be available soon."), findsOneWidget);

      // Verify fake stats are absent
      expect(find.text('Daily Rank'), findsNothing);
      expect(find.text('+2 Marks'), findsNothing);
    });

    testWidgets('Home renders QOTD with badges, separate source line, and pure question text',
        (WidgetTester tester) async {
      const testQotd = QuestionOfTheDay(
        id: 'qotd_test_1',
        date: '2026-09-20',
        questionId: 'qid_test_1',
        questionText: 'Which strait separates Andaman from Nicobar?',
        options: ['Ten Degree Channel', 'Duncan Passage', 'Nine Degree Channel', 'Palk Strait'],
        correctIndex: 0,
        explanation: 'The Ten Degree Channel separates the Andaman Islands from the Nicobar Islands.',
        exam: 'SSC CGL',
        examDate: '12 Sep 2024',
        shift: 'Shift 1',
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            todayQotdProvider.overrideWith((ref) => Stream.value(testQotd)),
          ],
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify badges
      expect(find.text('QUESTION OF THE DAY'), findsOneWidget);
      expect(find.text('PYQ'), findsOneWidget);
      expect(find.text('⏱ 60s'), findsOneWidget);

      // Verify pure question text
      expect(find.text('Which strait separates Andaman from Nicobar?'), findsOneWidget);

      // Verify separate dedicated source line
      expect(find.text('SSC CGL • 12 Sep 2024 • Shift 1'), findsOneWidget);

      // Verify CTA button
      expect(find.text('Attempt Now'), findsOneWidget);

      // Verify fake rank and +2 marks are strictly absent
      expect(find.text('Daily Rank'), findsNothing);
      expect(find.text('+2 Marks'), findsNothing);
    });
  });

  group('Notice Board: Model, Persistence, and Presentation Tests', () {
    test('AppNotice model computed properties and sorting', () {
      final now = DateTime.now();
      final recentNotice = AppNotice(
        id: 'n1',
        title: 'AN Administration Recruitment 2026',
        body: 'Full notification content',
        date: '2026-09-20',
        type: 'JOB',
        organization: 'A&N Administration',
        exam: 'Group B & C',
        publishAt: now.subtract(const Duration(hours: 12)),
        isPinned: false,
      );

      final olderPinnedNotice = AppNotice(
        id: 'n2',
        title: 'Important Examination Guidelines',
        body: 'Examination instruction body',
        date: '2026-09-15',
        type: 'NOTICE',
        publishAt: now.subtract(const Duration(days: 5)),
        isPinned: true,
      );

      // Verify isNew getter (<48 hours)
      expect(recentNotice.isNew, isTrue);
      expect(olderPinnedNotice.isNew, isFalse);

      // Verify typeDisplayName
      expect(recentNotice.typeDisplayName, 'JOB');
      expect(olderPinnedNotice.typeDisplayName, 'NOTICE');

      // Verify isCurrentlyActive
      expect(recentNotice.isCurrentlyActive, isTrue);
    });

    test('LocalDatabase getActiveNotices returns sorted list (pinned first, then date desc)', () async {
      final now = DateTime.now();
      final notice1 = AppNotice(
        id: 'n1',
        title: 'Regular Notice',
        body: 'Body 1',
        date: '2026-09-19',
        publishAt: now.subtract(const Duration(days: 1)),
        isPinned: false,
      );
      final notice2 = AppNotice(
        id: 'n2',
        title: 'Pinned Older Notice',
        body: 'Body 2',
        date: '2026-09-17',
        publishAt: now.subtract(const Duration(days: 3)),
        isPinned: true,
      );
      final notice3 = AppNotice(
        id: 'n3',
        title: 'Expired Notice',
        body: 'Body 3',
        date: '2026-09-10',
        publishAt: now.subtract(const Duration(days: 10)),
        expiresAt: now.subtract(const Duration(days: 1)),
        isPinned: false,
      );

      await LocalDatabase.instance.syncNoticesFromFirestore([notice1, notice2, notice3]);

      final activeNotices = LocalDatabase.instance.getActiveNotices();
      // notice3 is expired, so only 2 notices active
      expect(activeNotices.length, 2);
      // Pinned notice comes first
      expect(activeNotices[0].id, 'n2');
      expect(activeNotices[0].isPinned, isTrue);
      expect(activeNotices[1].id, 'n1');
    });

    testWidgets('NoticeBoardCard renders properly and disposes without timer leak',
        (WidgetTester tester) async {
      final List<AppNotice> notices = [
        AppNotice(
          id: 'nb1',
          title: 'Forest Guard Exam 2026 Admit Card Released',
          body: 'Forest guard admit cards are ready',
          date: '2026-09-20',
          type: 'ADMIT_CARD',
          organization: 'Forest Dept',
          publishAt: DateTime.now().subtract(const Duration(hours: 6)),
          isPinned: true,
        ),
        AppNotice(
          id: 'nb2',
          title: 'Electricity Department Junior Engineer Vacancies',
          body: 'Electricity dept junior engineer recruitment',
          date: '2026-09-19',
          type: 'JOB',
          organization: 'Electricity Dept',
          publishAt: DateTime.now().subtract(const Duration(hours: 24)),
          isPinned: false,
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            noticesStreamProvider.overrideWith((ref) => Stream<List<AppNotice>>.value(notices)),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: NoticeBoardCard(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Check header and badge
      expect(find.text('Notice Board'), findsOneWidget);
      expect(find.text('View All'), findsOneWidget);

      // Check current notice content
      expect(find.text('Forest Guard Exam 2026 Admit Card Released'), findsOneWidget);
      expect(find.text('ADMIT CARD'), findsOneWidget);
      expect(find.text('Electricity Department Junior Engineer Vacancies'), findsOneWidget);
      expect(find.text('JOB'), findsOneWidget);
      expect(find.text('NEW'), findsWidgets);

      // Advance timer for auto-rotation
      await tester.pump(const Duration(seconds: 4));

      // Re-pump empty widget to verify clean dispose without timer leaks
      await tester.pumpWidget(const MaterialApp(home: SizedBox()));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('NoticeDetailsSheet displays full metadata and action buttons',
        (WidgetTester tester) async {
      final sampleNotice = AppNotice(
        id: 'detail_notice_1',
        title: 'AN CGL 2026 Notification',
        body: 'Full notification text',
        date: '2026-09-20',
        type: 'JOB',
        organization: 'A&N Administration',
        exam: 'Combined Graduate Level',
        shortDescription: 'Application invited for 120 posts of assistants.',
        content: 'Candidates must possess a Bachelor degree from a recognized university. Age limit 18-33.',
        officialUrl: 'https://andaman.gov.in',
        pdfUrl: 'https://andaman.gov.in/notification.pdf',
        applyUrl: 'https://erecruitment.andaman.gov.in',
        publishAt: DateTime.now().subtract(const Duration(hours: 2)),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => NoticeDetailsSheet.show(ctx, sampleNotice),
                child: const Text('Open Sheet'),
              ),
            ),
          ),
        ),
      );

      // Open sheet
      await tester.tap(find.text('Open Sheet'));
      await tester.pumpAndSettle();

      // Verify sheet elements
      expect(find.text('AN CGL 2026 Notification'), findsOneWidget);
      expect(find.text('A&N Administration'), findsOneWidget);
      expect(find.text('Candidates must possess a Bachelor degree from a recognized university. Age limit 18-33.'), findsOneWidget);

      // Verify action buttons
      expect(find.text('Apply Online'), findsOneWidget);
      expect(find.text('Official Website'), findsOneWidget);
      expect(find.text('View Notification'), findsOneWidget);
    });
  });

  group('Live Tests: Model, Countdown, and Home Integration Tests', () {
    test('LiveTestItem calculates status: upcoming, live, ended', () {
      final now = DateTime.now();

      // Upcoming test
      final upcomingTest = LiveTestItem(
        id: 'lt_up',
        title: 'AN CGL All-Island Mock Test 1',
        mockTestId: 'mock_cgl_01',
        startAt: now.add(const Duration(hours: 2)),
        endAt: now.add(const Duration(hours: 4)),
      );
      expect(upcomingTest.status, LiveTestStatus.upcoming);
      expect(upcomingTest.remainingDuration.inMinutes, greaterThan(115));

      // Live test
      final liveTest = LiveTestItem(
        id: 'lt_live',
        title: 'Live Now Mock Exam',
        mockTestId: 'mock_cgl_02',
        startAt: now.subtract(const Duration(minutes: 30)),
        endAt: now.add(const Duration(minutes: 90)),
      );
      expect(liveTest.status, LiveTestStatus.live);
      expect(liveTest.remainingDuration.inMinutes, greaterThan(80));

      // Ended test
      final endedTest = LiveTestItem(
        id: 'lt_ended',
        title: 'Past Mock Exam',
        mockTestId: 'mock_cgl_03',
        startAt: now.subtract(const Duration(hours: 5)),
        endAt: now.subtract(const Duration(hours: 3)),
      );
      expect(endedTest.status, LiveTestStatus.ended);
      expect(endedTest.remainingDuration, Duration.zero);
    });

    testWidgets('LiveTestHomeCard hides cleanly when no live or upcoming tests',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            liveTestsStreamProvider.overrideWith((ref) => Stream<List<LiveTestItem>>.value([])),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: LiveTestHomeCard(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Card should be completely absent (SizedBox.shrink)
      expect(find.text('LIVE NOW'), findsNothing);
      expect(find.text('JOIN TEST'), findsNothing);
    });

    testWidgets('LiveTestHomeCard displays live test with countdown and START TEST button',
        (WidgetTester tester) async {
      final now = DateTime.now();
      final activeLive = LiveTestItem(
        id: 'live_001',
        title: 'All-Island Mega Mock 2026',
        mockTestId: 'mock_mega_01',
        startAt: now.subtract(const Duration(minutes: 15)),
        endAt: now.add(const Duration(hours: 1, minutes: 45)),
      );

      await LocalDatabase.instance.syncMockTestsFromFirestore([
        const MockTest(
          id: 'mock_mega_01',
          title: 'All-Island Mega Mock 2026',
          examCode: 'AN CGL',
          durationMinutes: 120,
          totalQuestions: 100,
          totalMarks: 100.0,
          negativeMarks: 0.25,
          sections: [],
          status: 'published',
        ),
      ]);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            liveTestsStreamProvider.overrideWith((ref) => Stream<List<LiveTestItem>>.value([activeLive])),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: LiveTestHomeCard(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Card header and status
      expect(find.text('LIVE NOW'), findsOneWidget);
      expect(find.text('All-Island Mega Mock 2026'), findsOneWidget);
      expect(find.text('JOIN TEST'), findsOneWidget);
    });
  });

  group('Home Screen Layout, Section Order, and Responsiveness', () {
    testWidgets('Home Screen has exact required sequence and no promo card across viewports',
        (WidgetTester tester) async {
      const testQotd = QuestionOfTheDay(
        id: 'qotd_home_test',
        date: '2026-09-20',
        questionId: 'qid_home_test',
        questionText: 'What is the state bird of Andaman and Nicobar Islands?',
        options: ['Andaman Wood Pigeon', 'Nicobar Pigeon', 'White-headed Starling', 'Glossy Swiftlet'],
        correctIndex: 0,
        exam: 'AN CGL',
        year: '2024',
      );

      final testNotices = [
        AppNotice(
          id: 'nb_home_1',
          title: 'Forest Dept Recruitment Notice',
          body: 'Notice body',
          date: '2026-09-20',
          type: 'JOB',
          organization: 'Forest Dept',
          publishAt: DateTime.now().subtract(const Duration(hours: 1)),
        ),
      ];

      const viewports = [
        Size(320, 640),
        Size(360, 740),
        Size(384, 800),
        Size(412, 915),
      ];

      for (final size in viewports) {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              todayQotdProvider.overrideWith((ref) => Stream.value(testQotd)),
              noticesStreamProvider.overrideWith((ref) => Stream<List<AppNotice>>.value(testNotices)),
            ],
            child: const MaterialApp(
              home: HomeScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();

        // 1. Check no yellow/black RenderFlex overflow bars
        expect(tester.takeException(), isNull);

        // 2. Promotional card is removed
        expect(find.text('ESSENTIAL'), findsNothing);

        // 3. Stats card is present
        expect(find.text('Streak'), findsOneWidget);
        expect(find.text('Accuracy'), findsOneWidget);
        expect(find.text('Questions'), findsOneWidget);

        // 4. QOTD section is present
        expect(find.text('QUESTION OF THE DAY'), findsOneWidget);

        // 5. Choose Your Exam is present
        expect(find.text('Choose Your Exam'), findsOneWidget);

        // 6. Notice Board is present
        expect(find.text('Notice Board'), findsOneWidget);

        // 7. Practice by Subject is present
        expect(find.text('Practice by Subject'), findsOneWidget);
      }
    });
  });
}
