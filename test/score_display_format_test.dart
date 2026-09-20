import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/features/results/presentation/results_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  setUp(() async {
    await LocalDatabase.instance.resetForTesting();
    SharedPreferences.setMockInitialValues({});
    await LocalDatabase.instance.init();
  });

  group('Score Display Format Specification Tests (-0.30 / 146.00)', () {
    test('1. Exact 2-decimal formatting values match user specification', () {
      expect((-0.3).toStringAsFixed(2), '-0.30');
      expect((12.0).toStringAsFixed(2), '12.00');
      expect((12.5).toStringAsFixed(2), '12.50');
      expect((12.25).toStringAsFixed(2), '12.25');
      expect((146.0).toStringAsFixed(2), '146.00');

      // Combined display string check
      final displayedScore = '${(-0.3).toStringAsFixed(2)} / ${(146.0).toStringAsFixed(2)}';
      expect(displayedScore, '-0.30 / 146.00');
    });

    testWidgets('2. ResultsScreen renders -0.30 / 146.00 exactly with integer counts and percentage',
        (WidgetTester tester) async {
      final attempt = StudentAttempt(
        id: 'test_neg_attempt',
        testId: 'mock_test_1',
        testTitle: 'Andaman GK & Combined Exam',
        examCode: 'ANCGL',
        timestamp: DateTime.now(),
        score: -0.3,
        maxScore: 146.0,
        accuracy: 0.0,
        correctCount: 0,
        wrongCount: 1,
        unattemptedCount: 72,
        sectionScores: {},
        selectedAnswers: {'q1': 2},
        timeTakenSeconds: 300,
      );

      final mockTest = MockTest(
        id: 'mock_test_1',
        title: 'Andaman GK & Combined Exam',
        examCode: 'ANCGL',
        durationMinutes: 120,
        totalQuestions: 73,
        totalMarks: 146.0,
        positiveMarks: 2.0,
        negativeMarks: 0.3,
        sections: [
          TestSection(
            id: 'sec_1',
            name: 'General Awareness',
            hindiName: '',
            questionIds: List.generate(73, (i) => 'q$i'),
          ),
        ],
      );

      final questions = List.generate(
        73,
        (i) => Question(
          id: 'q$i',
          subjectId: 'gk',
          topicId: 'Islands',
          examTags: ['ANCGL'],
          questionEn: 'Question $i',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: [],
          correctIndex: 3,
          explanationEn: '',
          explanationHi: '',
          positiveMarks: 2.0,
          negativeMarks: 0.3,
        ),
      );

      await LocalDatabase.instance.syncMockTestsFromFirestore([mockTest]);
      await LocalDatabase.instance.syncQuestionsFromFirestore(questions);
      await LocalDatabase.instance.recordAttempt(attempt);

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: ResultsScreen(attemptId: 'test_neg_attempt'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify exact 2-decimal display for score and max score
      expect(find.text('-0.30'), findsOneWidget);
      expect(find.text('/ 146.00'), findsOneWidget);

      // Verify that correct/wrong/unattempted counts remain integers
      expect(find.text('0'), findsWidgets); // Correct count and accuracy
      expect(find.text('1'), findsWidgets); // Wrong count
      expect(find.text('72'), findsOneWidget); // Unattempted count

      // Verify percentage formatting remains percentage-based
      expect(find.text('0.0% Overall Score'), findsOneWidget);
    });

    testWidgets('3. ResultsScreen renders positive decimal score (12.50 / 146.00)',
        (WidgetTester tester) async {
      // 7 correct * 2.0 - 3 wrong * 0.5 = 14.0 - 1.5 = 12.50 score out of 73 * 2.0 = 146.00 maxScore
      final attempt = StudentAttempt(
        id: 'test_pos_attempt',
        testId: 'mock_test_2',
        testTitle: 'Andaman GK & Combined Exam',
        examCode: 'ANCGL',
        timestamp: DateTime.now(),
        score: 12.5,
        maxScore: 146.0,
        accuracy: 70.0,
        correctCount: 7,
        wrongCount: 3,
        unattemptedCount: 63,
        sectionScores: {},
        selectedAnswers: {},
        timeTakenSeconds: 300,
      );

      final mockTest2 = MockTest(
        id: 'mock_test_2',
        title: 'Andaman GK & Combined Exam',
        examCode: 'ANCGL',
        durationMinutes: 120,
        totalQuestions: 73,
        totalMarks: 146.0,
        positiveMarks: 2.0,
        negativeMarks: 0.5,
        sections: const [],
      );

      await LocalDatabase.instance.syncMockTestsFromFirestore([mockTest2]);
      await LocalDatabase.instance.recordAttempt(attempt);

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: ResultsScreen(attemptId: 'test_pos_attempt'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify 12.5 formatted as 12.50 and 146 formatted as 146.00
      expect(find.text('12.50'), findsOneWidget);
      expect(find.text('/ 146.00'), findsOneWidget);
    });
  });
}
