import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/app/app.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/features/home/presentation/home_screen.dart';
import 'package:andaman_quiz/features/tests/presentation/tests_screen.dart';
import 'package:andaman_quiz/features/practice/presentation/practice_screen.dart';
import 'package:andaman_quiz/features/saved/presentation/saved_screen.dart';
import 'package:andaman_quiz/features/settings/presentation/settings_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  group('BUG 1: TestsScreen Ticker & Controller Lifecycle Verification', () {
    setUp(() async {
      await LocalDatabase.instance.resetForTesting();
      SharedPreferences.setMockInitialValues({});
      await LocalDatabase.instance.init();
    });

    testWidgets('TestsScreen initializes with TickerProviderStateMixin and updates tabs without crashing',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: TestsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify TestsScreen is mounted
      expect(find.byType(TestsScreen), findsOneWidget);
      expect(find.text('Mock Tests & CBT'), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Dynamically add exams to LocalDatabase to trigger tab rebuilds
      await LocalDatabase.instance.syncExamsFromFirestore([
        const Exam(
          id: 'exam_cgl',
          code: 'CGL',
          name: 'Combined Graduate Level',
          description: 'SSC CGL exam',
          totalQuestions: 100,
          iconName: 'school',
          order: 1,
        ),
        const Exam(
          id: 'exam_chsl',
          code: 'CHSL',
          name: 'Combined Higher Secondary',
          description: 'SSC CHSL exam',
          totalQuestions: 100,
          iconName: 'school',
          order: 2,
        ),
        const Exam(
          id: 'exam_police',
          code: 'POLICE',
          name: 'A&N Police SI',
          description: 'Police recruitment',
          totalQuestions: 100,
          iconName: 'local_police',
          order: 3,
        ),
      ]);

      // Re-pump widget to trigger rebuild with multiple tickers
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: TestsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify that tabs were rebuilt and no SingleTickerProviderStateMixin exception was thrown
      expect(tester.takeException(), isNull);
      expect(find.text('CGL'), findsOneWidget);
      expect(find.text('CHSL'), findsOneWidget);
      expect(find.text('POLICE'), findsOneWidget);

      // Tap on different tabs and ensure no disposed-controller exception
      await tester.tap(find.text('CGL'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('POLICE'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('All').first);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('TestsScreen handles app lifecycle state changes without ticker leaks',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: TestsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Simulate App paused (backgrounded)
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();

      // Simulate App resumed (foregrounded)
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });

  group('BUG 2: Home Screen Overflow Verification Across Viewport Widths', () {
    setUp(() async {
      await LocalDatabase.instance.resetForTesting();
      SharedPreferences.setMockInitialValues({});
      await LocalDatabase.instance.init();
    });

    final testWidths = [
      {'name': '320dp (Ultra-compact / small Android)', 'width': 320.0, 'height': 640.0},
      {'name': '360dp (Standard compact Android)', 'width': 360.0, 'height': 740.0},
      {'name': '384dp (Mid-size Android)', 'width': 384.0, 'height': 800.0},
      {'name': '412dp (Large Android / Pixel 7)', 'width': 412.0, 'height': 915.0},
    ];

    for (final size in testWidths) {
      testWidgets('HomeScreen renders with ZERO overflow at ${size['name']}',
          (WidgetTester tester) async {
        tester.view.physicalSize = Size(size['width']! as double, size['height']! as double);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        await tester.pumpWidget(
          const ProviderScope(
            child: MaterialApp(
              home: HomeScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();

        // Check for any yellow/black RenderFlex overflow bars
        expect(tester.takeException(), isNull);

        // Verify ESSENTIAL promo card is removed per specification
        expect(find.text('ESSENTIAL'), findsNothing);
        expect(find.text('Choose Your Exam'), findsOneWidget);

        // Verify stat items are displayed
        expect(find.text('Streak'), findsOneWidget);
        expect(find.text('Accuracy'), findsOneWidget);
        expect(find.text('Questions'), findsOneWidget);
      });
    }
  });

  group('BUG 3: Home Metrics Calculation & Zero-Demo-Data Verification', () {
    test('Clean state without attempts yields strictly 0, 0%, 0', () async {
      await LocalDatabase.instance.resetForTesting();
      SharedPreferences.setMockInitialValues({});
      await LocalDatabase.instance.init();

      expect(LocalDatabase.instance.getStreakDays(), 0);
      expect(LocalDatabase.instance.getAccuracyPercentage(), 0);
      expect(LocalDatabase.instance.getTotalQuestionsCount(), 0);
    });

    test('Single 10-question attempt with 4 correct yields 10 Questions, 40% Accuracy, 1 Day Streak (proves 338 and 8 were legacy seeds)', () async {
      await LocalDatabase.instance.resetForTesting();
      SharedPreferences.setMockInitialValues({});
      await LocalDatabase.instance.init();

      final attempt = StudentAttempt(
        id: 'attempt_001',
        testId: 'mock_test_01',
        testTitle: 'Andaman GK Mock 01',
        examCode: 'POLICE',
        timestamp: DateTime.now(),
        score: 8.0,
        maxScore: 20.0,
        accuracy: 40.0,
        correctCount: 4,
        wrongCount: 6,
        unattemptedCount: 0,
        sectionScores: {'GK': 8.0},
        selectedAnswers: {},
        timeTakenSeconds: 300,
      );

      await LocalDatabase.instance.recordAttempt(attempt);

      // Verify the calculations are genuine and match the math:
      // Questions = 4 + 6 = 10 (NOT 338!)
      expect(LocalDatabase.instance.getTotalQuestionsCount(), 10);

      // Accuracy = (4 / 10) * 100 = 40%
      expect(LocalDatabase.instance.getAccuracyPercentage(), 40);

      // Streak = 1 Day (NOT 8 Days!)
      expect(LocalDatabase.instance.getStreakDays(), 1);
    });

    test('Database Migration v3 purges legacy user_total_questions and user_streak_days keys', () async {
      await LocalDatabase.instance.resetForTesting();
      // Simulate legacy device storage pre-polluted with old hardcoded seeds (338 and 8)
      SharedPreferences.setMockInitialValues({
        'local_db_version': 2,
        'user_total_questions': 338,
        'user_streak_days': 8,
        'user_last_active_date': '2026-09-16',
      });

      // Initialize triggers migration v2 -> v3
      await LocalDatabase.instance.init();

      // With no attempts, values MUST be clean 0, 0%, 0, NOT 338 or 8
      expect(LocalDatabase.instance.getTotalQuestionsCount(), 0);
      expect(LocalDatabase.instance.getStreakDays(), 0);
      expect(LocalDatabase.instance.getAccuracyPercentage(), 0);
    });
  });

  group('BUG 4: Bottom Navigation Runtime Multi-Tab Navigation & Rapid Switching', () {
    setUp(() async {
      await LocalDatabase.instance.resetForTesting();
      SharedPreferences.setMockInitialValues({
        'user_onboarding_done': true,
      });
      await LocalDatabase.instance.init();

      // Provide initial mock test and subjects so tabs have content
      await LocalDatabase.instance.syncMockTestsFromFirestore([
        const MockTest(
          id: 'mock_cbt_01',
          title: 'Full Length CBT Test 1',
          examCode: 'CGL',
          durationMinutes: 60,
          totalMarks: 200,
          totalQuestions: 100,
          positiveMarks: 2.0,
          negativeMarks: 0.5,
          isFree: true,
          status: 'published',
          language: 'both',
          displayOrder: 1,
          sections: [
            TestSection(
              id: 'sec_1',
              name: 'General Awareness',
              hindiName: 'सामान्य जागरूकता',
              questionIds: ['q1', 'q2'],
            ),
          ],
        ),
      ]);
    });

    testWidgets('Rapidly navigates through all 5 bottom-navigation destinations without errors',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: AndamanQuizApp(),
        ),
      );

      // Splash settles and navigates to /home
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 2000));
      await tester.pumpAndSettle();

      // Verify Home tab is initially visible
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Navigate to Practice tab (index 1)
      await tester.tap(find.text('Practice'));
      await tester.pumpAndSettle();
      expect(find.byType(PracticeScreen), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Navigate to Tests tab (index 2) - verifies BUG 1 fix at runtime
      await tester.tap(find.text('Tests'));
      await tester.pumpAndSettle();
      expect(find.byType(TestsScreen), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Navigate back to Home tab (index 0)
      await tester.tap(find.text('Home'));
      await tester.pumpAndSettle();
      expect(find.byType(HomeScreen), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Navigate back to Tests tab (index 2) - verifies no ticker leak or recreation crash
      await tester.tap(find.text('Tests'));
      await tester.pumpAndSettle();
      expect(find.byType(TestsScreen), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Navigate to Saved tab (index 3)
      await tester.tap(find.text('Saved'));
      await tester.pumpAndSettle();
      expect(find.byType(SavedScreen), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Navigate to More / Settings tab (index 4)
      await tester.tap(find.text('More'));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Rapidly switch between Tests and Home 5 times
      for (int i = 0; i < 5; i++) {
        await tester.tap(find.text('Tests'));
        await tester.pump(const Duration(milliseconds: 50));
        await tester.tap(find.text('Home'));
        await tester.pump(const Duration(milliseconds: 50));
      }
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
