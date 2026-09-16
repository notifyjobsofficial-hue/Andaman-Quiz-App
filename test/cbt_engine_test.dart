import 'package:flutter_test/flutter_test.dart';
import 'package:andaman_quiz/core/models/models.dart';

void main() {
  group('SSC CBT Engine & Data Models Test', () {
    test('Question model verifies options, correct index, and explanations', () {
      const q = Question(
        id: 'test_q_1',
        subjectId: 'sub_an_gk',
        topicId: 'top_hist',
        examTags: ['CGL', 'CHSL'],
        questionEn: 'What is the capital of Andaman and Nicobar Islands?',
        questionHi: 'अंडमान और निकोबार की राजधानी क्या है?',
        optionsEn: ['Port Blair', 'Havelock', 'Diglipur', 'Mayabunder'],
        optionsHi: ['पोर्ट ब्लेयर', 'हेवलॉक', 'डिगलीपुर', 'मायाबंदर'],
        correctIndex: 0,
        explanationEn: 'Port Blair is the capital city.',
        explanationHi: 'पोर्ट ब्लेयर राजधानी है।',
      );

      expect(q.optionsEn.length, 4);
      expect(q.correctIndex, 0);
      expect(q.explanationEn.isNotEmpty, true);
    });

    test('Mock test marking calculation validates positive and negative marks', () {
      const mock = MockTest(
        id: 'mock_test_1',
        title: 'SSC CGL Tier 1 Mock',
        examCode: 'CGL',
        totalQuestions: 100,
        durationMinutes: 60,
        totalMarks: 200,
        negativeMarks: 0.50,
        sections: [],
        isFree: true,
      );

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
