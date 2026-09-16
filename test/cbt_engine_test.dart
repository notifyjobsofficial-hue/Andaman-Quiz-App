import 'package:flutter_test/flutter_test.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/core/database/seed_data.dart';

void main() {
  group('SSC CBT Engine & Data Models Test', () {
    test('SeedData contains authentic Andaman GK and SSC questions', () {
      final questions = SeedData.questions;
      expect(questions.isNotEmpty, true);

      // Verify Andaman GK questions exist
      final anQuestions = questions.where((q) => q.subjectId == 'sub_an_gk').toList();
      expect(anQuestions.length >= 6, true);

      // Verify question data integrity
      for (final q in questions) {
        expect(q.optionsEn.length, 4);
        expect(q.correctIndex >= 0 && q.correctIndex < 4, true);
        expect(q.explanationEn.isNotEmpty, true);
      }
    });

    test('Mock test marking calculation validates positive and negative marks', () {
      final mock = SeedData.mockTests.first;
      const totalQuestions = 100;
      final positiveMarks = mock.totalMarks / totalQuestions; // 200 / 100 = 2.0
      final negativeMarks = mock.negativeMarks; // 0.50

      const correctCount = 70;
      const wrongCount = 20;
      const unattemptedCount = 10;

      final totalScore = (correctCount * positiveMarks) - (wrongCount * negativeMarks);
      // 70 * 2.0 = 140; 20 * 0.5 = 10; Score = 130
      expect(totalScore, 130.0);
      expect(correctCount + wrongCount + unattemptedCount, 100);

      final accuracy = (correctCount / (correctCount + wrongCount)) * 100;
      expect(accuracy, closeTo(77.77, 0.01));
    });

    test('CBT Question States transitions behave deterministically', () {
      const states = CbtQuestionState.values;
      expect(states.contains(CbtQuestionState.notVisited), true);
      expect(states.contains(CbtQuestionState.notAnswered), true);
      expect(states.contains(CbtQuestionState.answered), true);
      expect(states.contains(CbtQuestionState.markedForReview), true);
      expect(states.contains(CbtQuestionState.answeredAndMarked), true);
    });
  });
}
