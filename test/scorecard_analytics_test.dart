import 'package:flutter_test/flutter_test.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/features/results/domain/scorecard_analytics.dart';

void main() {
  group('ScorecardAnalytics Comprehensive Audit & Dynamic Analytics Tests', () {
    // Helper to create mock questions
    Question createQuestion({
      required String id,
      required String subjectId,
      required String topicId,
      int correctIndex = 0,
      double positiveMarks = 2.0,
      double negativeMarks = 0.5,
    }) {
      return Question(
        id: id,
        subjectId: subjectId,
        topicId: topicId,
        examTags: ['TEST'],
        questionEn: 'Question $id Text',
        questionHi: '',
        optionsEn: ['Option A', 'Option B', 'Option C', 'Option D'],
        optionsHi: [],
        correctIndex: correctIndex,
        explanationEn: 'Explanation for $id',
        explanationHi: '',
        positiveMarks: positiveMarks,
        negativeMarks: negativeMarks,
      );
    }

    // Helper to create student attempt
    StudentAttempt createAttempt({
      required String testId,
      required Map<String, int> selectedAnswers,
      int correctCount = 0,
      int wrongCount = 0,
      int unattemptedCount = 0,
      double score = 0.0,
      double maxScore = 100.0,
      double accuracy = 0.0,
    }) {
      return StudentAttempt(
        id: 'attempt_${DateTime.now().millisecondsSinceEpoch}',
        testId: testId,
        testTitle: 'Audited CBT Mock Test',
        examCode: 'ANCGL',
        timestamp: DateTime.now(),
        score: score,
        maxScore: maxScore,
        accuracy: accuracy,
        correctCount: correctCount,
        wrongCount: wrongCount,
        unattemptedCount: unattemptedCount,
        sectionScores: {},
        selectedAnswers: selectedAnswers,
        timeTakenSeconds: 300,
      );
    }

    // 1. TEST: 0 attempted
    test('1. Zero attempted questions yields 0% accuracy and "Not Attempted" section states', () {
      final questions = [
        createQuestion(id: 'q1', subjectId: 'gk', topicId: 'Islands'),
        createQuestion(id: 'q2', subjectId: 'gk', topicId: 'Islands'),
        createQuestion(id: 'q3', subjectId: 'eng', topicId: 'Grammar'),
        createQuestion(id: 'q4', subjectId: 'eng', topicId: 'Grammar'),
      ];

      final mockTest = MockTest(
        id: 'mock_1',
        title: 'Mock 1',
        examCode: 'ANCGL',
        durationMinutes: 60,
        totalQuestions: 4,
        totalMarks: 8.0,
        positiveMarks: 2.0,
        negativeMarks: 0.5,
        sections: const [
          TestSection(id: 'sec_1', name: 'General Awareness', hindiName: '', questionIds: ['q1', 'q2']),
          TestSection(id: 'sec_2', name: 'English Language', hindiName: '', questionIds: ['q3', 'q4']),
        ],
      );

      final attempt = createAttempt(
        testId: 'mock_1',
        selectedAnswers: {}, // No questions attempted
      );

      final analytics = ScorecardAnalytics.compute(
        attempt: attempt,
        mockTest: mockTest,
        questions: questions,
      );

      expect(analytics.totalQuestions, 4);
      expect(analytics.attemptedCount, 0);
      expect(analytics.correctCount, 0);
      expect(analytics.wrongCount, 0);
      expect(analytics.unattemptedCount, 4);
      expect(analytics.accuracy, 0.0);
      expect(analytics.score, 0.0);
      expect(analytics.correctCount + analytics.wrongCount + analytics.unattemptedCount, analytics.totalQuestions);

      // Verify sections are "Not Attempted"
      expect(analytics.sections.length, 2);
      for (final sec in analytics.sections) {
        expect(sec.isAttempted, isFalse);
        expect(sec.accuracy, isNull);
        expect(sec.attemptedCount, 0);
      }

      // Strong topics & needs revision must be empty when 0 attempted
      expect(analytics.strongTopics, isEmpty);
      expect(analytics.needsRevisionTopics, isEmpty);
    });

    // 2. TEST: 2/2 correct
    test('2. 2/2 correct yields 100% accuracy, positive score, and identified strong topic', () {
      final questions = [
        createQuestion(id: 'q1', subjectId: 'reasoning', topicId: 'Number Series', correctIndex: 1),
        createQuestion(id: 'q2', subjectId: 'reasoning', topicId: 'Number Series', correctIndex: 2),
      ];

      final mockTest = MockTest(
        id: 'mock_2',
        title: 'Mock 2',
        examCode: 'ANCHSL',
        durationMinutes: 30,
        totalQuestions: 2,
        totalMarks: 4.0,
        positiveMarks: 2.0,
        negativeMarks: 0.5,
        sections: const [
          TestSection(id: 's1', name: 'General Intelligence', hindiName: '', questionIds: ['q1', 'q2']),
        ],
      );

      final attempt = createAttempt(
        testId: 'mock_2',
        selectedAnswers: {'q1': 1, 'q2': 2}, // Both correct
      );

      final analytics = ScorecardAnalytics.compute(
        attempt: attempt,
        mockTest: mockTest,
        questions: questions,
      );

      expect(analytics.totalQuestions, 2);
      expect(analytics.attemptedCount, 2);
      expect(analytics.correctCount, 2);
      expect(analytics.wrongCount, 0);
      expect(analytics.unattemptedCount, 0);
      expect(analytics.accuracy, 100.0);
      expect(analytics.score, 4.0); // 2 * 2.0
      expect(analytics.correctCount + analytics.wrongCount + analytics.unattemptedCount, analytics.totalQuestions);

      // Section check
      expect(analytics.sections.first.isAttempted, isTrue);
      expect(analytics.sections.first.accuracy, 100.0);

      // Strong topic check
      expect(analytics.strongTopics.length, 1);
      expect(analytics.strongTopics.first.topicName, 'Number Series');
      expect(analytics.strongTopics.first.accuracy, 100.0);

      // No revision topics since 100% correct
      expect(analytics.needsRevisionTopics, isEmpty);
    });

    // 3. TEST: 1 correct + 1 wrong
    test('3. 1 correct + 1 wrong yields 50% accuracy and populates Needs Revision', () {
      final questions = [
        createQuestion(id: 'q1', subjectId: 'math', topicId: 'Percentages', correctIndex: 0),
        createQuestion(id: 'q2', subjectId: 'math', topicId: 'Percentages', correctIndex: 1),
      ];

      final mockTest = MockTest(
        id: 'mock_3',
        title: 'Mock 3',
        examCode: 'ANCGL',
        durationMinutes: 30,
        totalQuestions: 2,
        totalMarks: 4.0,
        positiveMarks: 2.0,
        negativeMarks: 0.5,
        sections: const [
          TestSection(id: 's1', name: 'Quantitative Aptitude', hindiName: '', questionIds: ['q1', 'q2']),
        ],
      );

      final attempt = createAttempt(
        testId: 'mock_3',
        selectedAnswers: {
          'q1': 0, // Correct
          'q2': 3, // Wrong (chose D instead of B)
        },
      );

      final analytics = ScorecardAnalytics.compute(
        attempt: attempt,
        mockTest: mockTest,
        questions: questions,
      );

      expect(analytics.totalQuestions, 2);
      expect(analytics.attemptedCount, 2);
      expect(analytics.correctCount, 1);
      expect(analytics.wrongCount, 1);
      expect(analytics.unattemptedCount, 0);
      expect(analytics.accuracy, 50.0);
      expect(analytics.score, 1.5); // 1 * 2.0 - 1 * 0.5 = 1.5
      expect(analytics.correctCount + analytics.wrongCount + analytics.unattemptedCount, analytics.totalQuestions);

      expect(analytics.sections.first.accuracy, 50.0);

      // Strong topics must be empty (accuracy 50% < 70%)
      expect(analytics.strongTopics, isEmpty);

      // Needs revision must include 'Percentages' (accuracy 50% < 60% and 1 wrong)
      expect(analytics.needsRevisionTopics.length, 1);
      expect(analytics.needsRevisionTopics.first.topicName, 'Percentages');
      expect(analytics.needsRevisionTopics.first.accuracy, 50.0);
      expect(analytics.needsRevisionTopics.first.wrongCount, 1);
    });

    // 4. TEST: multiple subjects
    test('4. Multiple subjects are isolated and calculated accurately per section', () {
      final questions = [
        createQuestion(id: 'q1', subjectId: 'gk', topicId: 'Andaman Geography', correctIndex: 0),
        createQuestion(id: 'q2', subjectId: 'gk', topicId: 'Andaman History', correctIndex: 1),
        createQuestion(id: 'q3', subjectId: 'eng', topicId: 'Synonyms', correctIndex: 2),
        createQuestion(id: 'q4', subjectId: 'math', topicId: 'Algebra', correctIndex: 3),
      ];

      final mockTest = MockTest(
        id: 'mock_4',
        title: 'Multi-Subject Mock',
        examCode: 'ANCGL',
        durationMinutes: 60,
        totalQuestions: 4,
        totalMarks: 8.0,
        positiveMarks: 2.0,
        negativeMarks: 0.5,
        sections: const [
          TestSection(id: 's_gk', name: 'General Awareness', hindiName: '', questionIds: ['q1', 'q2']),
          TestSection(id: 's_eng', name: 'English Language', hindiName: '', questionIds: ['q3']),
          TestSection(id: 's_math', name: 'Quantitative Aptitude', hindiName: '', questionIds: ['q4']),
        ],
      );

      final attempt = createAttempt(
        testId: 'mock_4',
        selectedAnswers: {
          'q1': 0, // GK q1 correct
          'q2': 2, // GK q2 wrong
          'q3': 2, // ENG q3 correct
          // Math q4 unattempted
        },
      );

      final analytics = ScorecardAnalytics.compute(
        attempt: attempt,
        mockTest: mockTest,
        questions: questions,
      );

      expect(analytics.totalQuestions, 4);
      expect(analytics.correctCount, 2);
      expect(analytics.wrongCount, 1);
      expect(analytics.unattemptedCount, 1);
      expect(analytics.accuracy, closeTo((2 / 3) * 100, 0.01));

      // Check sections
      final gkSec = analytics.sections.firstWhere((s) => s.sectionName == 'General Awareness');
      expect(gkSec.isAttempted, isTrue);
      expect(gkSec.accuracy, 50.0); // 1 correct of 2 attempted

      final engSec = analytics.sections.firstWhere((s) => s.sectionName == 'English Language');
      expect(engSec.isAttempted, isTrue);
      expect(engSec.accuracy, 100.0); // 1 of 1 attempted

      final mathSec = analytics.sections.firstWhere((s) => s.sectionName == 'Quantitative Aptitude');
      expect(mathSec.isAttempted, isFalse);
      expect(mathSec.accuracy, isNull); // 0 attempted = null
    });

    // 5. TEST: multiple topics
    test('5. Multiple topics categorize correctly into Strong and Needs Revision', () {
      final questions = [
        createQuestion(id: 't1', subjectId: 'gk', topicId: 'Cellular Jail History', correctIndex: 0),
        createQuestion(id: 't2', subjectId: 'gk', topicId: 'Cellular Jail History', correctIndex: 1),
        createQuestion(id: 't3', subjectId: 'math', topicId: 'Time & Distance', correctIndex: 0),
        createQuestion(id: 't4', subjectId: 'math', topicId: 'Time & Distance', correctIndex: 1),
      ];

      final attempt = createAttempt(
        testId: 'mock_topics',
        selectedAnswers: {
          't1': 0, // Correct
          't2': 1, // Correct -> Cellular Jail History: 2/2 = 100%
          't3': 3, // Wrong
          't4': 2, // Wrong -> Time & Distance: 0/2 = 0%
        },
      );

      final analytics = ScorecardAnalytics.compute(
        attempt: attempt,
        questions: questions,
      );

      expect(analytics.strongTopics.length, 1);
      expect(analytics.strongTopics.first.topicName, 'Cellular Jail History');
      expect(analytics.strongTopics.first.accuracy, 100.0);

      expect(analytics.needsRevisionTopics.length, 1);
      expect(analytics.needsRevisionTopics.first.topicName, 'Time & Distance');
      expect(analytics.needsRevisionTopics.first.accuracy, 0.0);
    });

    // 6. TEST: unattempted sections
    test('6. Unattempted sections explicitly report accuracy as null ("Not Attempted")', () {
      final questions = [
        createQuestion(id: 'a1', subjectId: 'reasoning', topicId: 'Logic', correctIndex: 0),
        createQuestion(id: 'b1', subjectId: 'gk', topicId: 'Rivers', correctIndex: 0),
      ];

      final mockTest = MockTest(
        id: 'mock_unattempted',
        title: 'Sectional Mock',
        examCode: 'ANMTS',
        durationMinutes: 45,
        totalQuestions: 2,
        totalMarks: 4.0,
        positiveMarks: 2.0,
        negativeMarks: 0.5,
        sections: const [
          TestSection(id: 's_attempted', name: 'Attempted Section', hindiName: '', questionIds: ['a1']),
          TestSection(id: 's_unattempted', name: 'Skipped Section', hindiName: '', questionIds: ['b1']),
        ],
      );

      final attempt = createAttempt(
        testId: 'mock_unattempted',
        selectedAnswers: {'a1': 0}, // Only a1 attempted
      );

      final analytics = ScorecardAnalytics.compute(
        attempt: attempt,
        mockTest: mockTest,
        questions: questions,
      );

      final attemptedSec = analytics.sections.firstWhere((s) => s.sectionName == 'Attempted Section');
      expect(attemptedSec.isAttempted, isTrue);
      expect(attemptedSec.accuracy, 100.0);

      final skippedSec = analytics.sections.firstWhere((s) => s.sectionName == 'Skipped Section');
      expect(skippedSec.isAttempted, isFalse);
      expect(skippedSec.accuracy, isNull);
    });

    // 7. TEST: negative marking
    test('7. Negative marking correctly deducts marks based on mock negativeMarks configuration', () {
      final questions = [
        createQuestion(id: 'n1', subjectId: 'gk', topicId: 'GK', correctIndex: 0),
        createQuestion(id: 'n2', subjectId: 'gk', topicId: 'GK', correctIndex: 0),
        createQuestion(id: 'n3', subjectId: 'gk', topicId: 'GK', correctIndex: 0),
        createQuestion(id: 'n4', subjectId: 'gk', topicId: 'GK', correctIndex: 0),
      ];

      final mockTest = MockTest(
        id: 'mock_neg',
        title: 'Negative Marking Test',
        examCode: 'ANPOLICE',
        durationMinutes: 60,
        totalQuestions: 4,
        totalMarks: 8.0,
        positiveMarks: 2.0,
        negativeMarks: 0.5,
        sections: const [
          TestSection(id: 'sec', name: 'General', hindiName: '', questionIds: ['n1', 'n2', 'n3', 'n4']),
        ],
      );

      // 1 correct, 3 wrong -> 1 * 2.0 - 3 * 0.5 = 2.0 - 1.5 = 0.5
      final attempt1 = createAttempt(
        testId: 'mock_neg',
        selectedAnswers: {'n1': 0, 'n2': 1, 'n3': 2, 'n4': 3},
      );

      final a1 = ScorecardAnalytics.compute(attempt: attempt1, mockTest: mockTest, questions: questions);
      expect(a1.score, 0.5);

      // 0 correct, 2 wrong -> 0 * 2.0 - 2 * 0.5 = -1.0
      final attempt2 = createAttempt(
        testId: 'mock_neg',
        selectedAnswers: {'n1': 1, 'n2': 2}, // 2 wrong, 2 unattempted
      );

      final a2 = ScorecardAnalytics.compute(attempt: attempt2, mockTest: mockTest, questions: questions);
      expect(a2.score, -1.0);
    });

    // 8. TEST: test with custom section names
    test('8. Custom section names from Firestore are preserved dynamically without hardcoded SSC names', () {
      final questions = [
        createQuestion(id: 'c1', subjectId: 'andaman_gk', topicId: 'Jarawa Tribe'),
        createQuestion(id: 'c2', subjectId: 'maritime', topicId: 'Port Blair Harbour'),
      ];

      final mockTest = MockTest(
        id: 'mock_custom',
        title: 'Andaman Special Officer Mock',
        examCode: 'ANDAMAN_SPECIAL',
        durationMinutes: 45,
        totalQuestions: 2,
        totalMarks: 4.0,
        positiveMarks: 2.0,
        negativeMarks: 0.5,
        sections: const [
          TestSection(id: 'cs1', name: 'Andaman Tribal Heritage', hindiName: '', questionIds: ['c1']),
          TestSection(id: 'cs2', name: 'Island Maritime Operations', hindiName: '', questionIds: ['c2']),
        ],
      );

      final attempt = createAttempt(
        testId: 'mock_custom',
        selectedAnswers: {'c1': 0},
      );

      final analytics = ScorecardAnalytics.compute(
        attempt: attempt,
        mockTest: mockTest,
        questions: questions,
      );

      expect(analytics.sections.length, 2);
      expect(analytics.sections[0].sectionName, 'Andaman Tribal Heritage');
      expect(analytics.sections[1].sectionName, 'Island Maritime Operations');
    });

    // 9. TEST: no topic data
    test('9. Questions with missing/blank topic data are safely handled without dummy values', () {
      final questions = [
        createQuestion(id: 'notopic1', subjectId: 'general', topicId: '', correctIndex: 0),
        createQuestion(id: 'notopic2', subjectId: 'general', topicId: '   ', correctIndex: 1),
      ];

      final attempt = createAttempt(
        testId: 'mock_notopic',
        selectedAnswers: {'notopic1': 0, 'notopic2': 2},
      );

      final analytics = ScorecardAnalytics.compute(
        attempt: attempt,
        questions: questions,
      );

      // No fake topics invented
      expect(analytics.strongTopics, isEmpty);
      expect(analytics.needsRevisionTopics, isEmpty);
      expect(analytics.totalQuestions, 2);
      expect(analytics.attemptedCount, 2);
      expect(analytics.correctCount, 1);
      expect(analytics.wrongCount, 1);
      expect(analytics.accuracy, 50.0);
    });
  });
}
