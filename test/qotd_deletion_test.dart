import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/core/providers/app_providers.dart';
import 'package:andaman_quiz/features/home/presentation/home_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  setUp(() async {
    await LocalDatabase.instance.resetForTesting();
    SharedPreferences.setMockInitialValues({});
    await LocalDatabase.instance.init();
  });

  group('QOTD Deletion & Sync Verification Suite', () {
    test('QA_DELETE_TEST: syncQotdFromFirestore stores QOTD and clearCachedQotd purges it', () async {
      const testQotd = QuestionOfTheDay(
        id: '2026-09-20',
        date: '2026-09-20',
        questionId: 'QA_DELETE_TEST',
        questionText: 'Is Cellular Jail a National Memorial?',
        options: ['Yes', 'No', 'Maybe', 'Unknown'],
        correctIndex: 0,
        active: true,
      );

      // 1. Sync to local database
      await LocalDatabase.instance.syncQotdFromFirestore(testQotd);

      // Verify cached
      final cached = LocalDatabase.instance.getCachedQotd('2026-09-20');
      expect(cached, isNotNull);
      expect(cached!.questionId, 'QA_DELETE_TEST');
      expect(cached.questionText, 'Is Cellular Jail a National Memorial?');

      // 2. Perform online deletion
      await LocalDatabase.instance.clearCachedQotd('2026-09-20');

      // Verify purge
      final purged = LocalDatabase.instance.getCachedQotd('2026-09-20');
      expect(purged, isNull);
    });

    test('Zero Hardcoded / Fallback QOTD: Empty state is rendered when QOTD is null', () {
      final cached = LocalDatabase.instance.getCachedQotd('2026-09-20');
      expect(cached, isNull, reason: 'Must not return any fake or hardcoded question');
    });

    testWidgets('Home screen displays empty state when todayQotdProvider emits null', (tester) async {
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
      expect(find.text("Today's question will be available soon."), findsOneWidget);
      // Verify no hardcoded question text appears
      expect(find.text("Hobson's choice"), findsNothing);
      expect(find.text("QA_DELETE_TEST"), findsNothing);
    });

    testWidgets('Home screen transitions from active QOTD to empty state dynamically on deletion', (tester) async {
      const activeQotd = QuestionOfTheDay(
        id: '2026-09-20',
        date: '2026-09-20',
        questionId: 'QA_DELETE_TEST',
        questionText: 'Temporary Question for Deletion Test',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        active: true,
      );

      final controller = StreamController<QuestionOfTheDay?>.broadcast();
      addTearDown(controller.close);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            todayQotdProvider.overrideWith((ref) => controller.stream),
          ],
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );

      // 1. Emit active QOTD
      controller.add(activeQotd);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Temporary Question for Deletion Test'), findsOneWidget);

      // 2. Admin deletes QOTD -> stream emits null
      controller.add(null);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // 3. Deletion event processed -> empty state must be shown
      expect(find.text("Today's question will be available soon."), findsOneWidget);
      expect(find.text('Temporary Question for Deletion Test'), findsNothing);
    });
  });
}
