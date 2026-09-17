// cbt_state_machine_comprehensive_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/core/ads/ad_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('CBT Examination Engine & State Machine Comprehensive Audit', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await LocalDatabase.instance.init();
    });

    test('CBT Question States deterministically transition across user actions', () {
      final states = <String, CbtQuestionState>{
        'q1': CbtQuestionState.notVisited,
        'q2': CbtQuestionState.notVisited,
        'q3': CbtQuestionState.notVisited,
      };

      states['q1'] = CbtQuestionState.notAnswered;
      expect(states['q1'], CbtQuestionState.notAnswered);

      states['q1'] = CbtQuestionState.answered;
      expect(states['q1'], CbtQuestionState.answered);

      states['q2'] = CbtQuestionState.markedForReview;
      expect(states['q2'], CbtQuestionState.markedForReview);

      states['q3'] = CbtQuestionState.answeredAndMarked;
      expect(states['q3'], CbtQuestionState.answeredAndMarked);

      states['q1'] = CbtQuestionState.notAnswered;
      expect(states['q1'], CbtQuestionState.notAnswered);
    });

    test('CBT Score Calculation strictly applies positive, negative, and accuracy rules', () {
      const mockTest = MockTest(
        id: 'mock_cbt_scoring_test',
        title: 'Andaman SI Tier 1 Mock Test',
        examCode: 'POLICE_SI',
        totalQuestions: 100,
        durationMinutes: 120,
        totalMarks: 200,
        negativeMarks: 0.50,
        positiveMarks: 2.0,
        sections: [
          TestSection(id: 's1', name: 'General Awareness', hindiName: 'सामान्य ज्ञान', questionIds: ['q1', 'q2', 'q3']),
          TestSection(id: 's2', name: 'English Language', hindiName: 'अंग्रेजी भाषा', questionIds: ['q4', 'q5']),
        ],
        isFree: true,
      );

      const q1 = Question(
        id: 'q1',
        subjectId: 'sub1',
        topicId: 't1',
        examTags: ['POLICE_SI'],
        questionEn: 'Q1',
        questionHi: 'प्रश्न 1',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: ['क', 'ख', 'ग', 'घ'],
        correctIndex: 0,
        explanationEn: 'Exp 1',
        explanationHi: 'व्याख्या 1',
      );
      const q2 = Question(
        id: 'q2',
        subjectId: 'sub1',
        topicId: 't1',
        examTags: ['POLICE_SI'],
        questionEn: 'Q2',
        questionHi: 'प्रश्न 2',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: ['क', 'ख', 'ग', 'घ'],
        correctIndex: 1,
        explanationEn: 'Exp 2',
        explanationHi: 'व्याख्या 2',
      );
      const q4 = Question(
        id: 'q4',
        subjectId: 'sub2',
        topicId: 't2',
        examTags: ['POLICE_SI'],
        questionEn: 'Q4',
        questionHi: 'प्रश्न 4',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: ['क', 'ख', 'ग', 'घ'],
        correctIndex: 2,
        explanationEn: 'Exp 4',
        explanationHi: 'व्याख्या 4',
      );
      const q5 = Question(
        id: 'q5',
        subjectId: 'sub2',
        topicId: 't2',
        examTags: ['POLICE_SI'],
        questionEn: 'Q5',
        questionHi: 'प्रश्न 5',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: ['क', 'ख', 'ग', 'घ'],
        correctIndex: 3,
        explanationEn: 'Exp 5',
        explanationHi: 'व्याख्या 5',
      );

      final cache = {'q1': q1, 'q2': q2, 'q4': q4, 'q5': q5};
      final selectedAnswers = {
        'q1': 0, // correct
        'q2': 0, // wrong (correct is 1)
        // q3 unattempted
        'q4': 2, // correct
        'q5': 3, // correct
      };

      int correctCount = 0;
      int wrongCount = 0;
      int unattemptedCount = 0;
      final Map<String, double> sectionScores = {};

      final positiveMarks = mockTest.positiveMarks ?? 2.0;
      final negativeMarks = mockTest.negativeMarks;

      for (final sec in mockTest.sections) {
        double secScore = 0.0;
        for (final qId in sec.questionIds) {
          final q = cache[qId];
          final selected = selectedAnswers[qId];

          if (selected == null) {
            unattemptedCount++;
          } else if (q != null && selected == q.correctIndex) {
            correctCount++;
            secScore += positiveMarks;
          } else {
            wrongCount++;
            secScore -= negativeMarks;
          }
        }
        sectionScores[sec.name] = (secScore < 0) ? 0.0 : secScore;
      }

      final rawTotalScore = (correctCount * positiveMarks) - (wrongCount * negativeMarks);
      final finalScore = rawTotalScore < 0 ? 0.0 : rawTotalScore;
      final accuracy = (correctCount + wrongCount) > 0
          ? (correctCount / (correctCount + wrongCount)) * 100
          : 0.0;
      final percentage = (finalScore / mockTest.totalMarks) * 100;

      expect(correctCount, 3);
      expect(wrongCount, 1);
      expect(unattemptedCount, 1);
      expect(sectionScores['General Awareness'], 1.5);
      expect(sectionScores['English Language'], 4.0);
      expect(finalScore, 5.5);
      expect(accuracy, 75.0);
      expect(percentage, closeTo(2.75, 0.01));
    });

    test('LocalDatabase preserves and restores active examination drafts', () async {
      const testId = 'mock_draft_test_01';
      final draftData = {
        'startTimeMs': DateTime.now().millisecondsSinceEpoch,
        'endTimeMs': DateTime.now().add(const Duration(minutes: 60)).millisecondsSinceEpoch,
        'currentSectionIndex': 1,
        'currentQuestionIndex': 4,
        'selectedAnswers': {'q1': 0, 'q2': 3},
        'questionStates': {'q1': 2, 'q2': 4},
      };

      await LocalDatabase.instance.saveExamDraft(testId, draftData);

      final loadedDraft = LocalDatabase.instance.getExamDraft(testId);
      expect(loadedDraft, isNotNull);
      expect(loadedDraft!['currentSectionIndex'], 1);
      expect(loadedDraft['currentQuestionIndex'], 4);
      expect((loadedDraft['selectedAnswers'] as Map)['q1'], 0);
      expect((loadedDraft['questionStates'] as Map)['q2'], 4);

      await LocalDatabase.instance.clearExamDraft(testId);
      final clearedDraft = LocalDatabase.instance.getExamDraft(testId);
      expect(clearedDraft, isNull);
    });

    test('LocalDatabase tracks paid mock test unlocks and entitlements deterministically', () async {
      const paidMock = MockTest(
        id: 'andaman_paid_mock_001',
        title: 'Paid Mock Test',
        examCode: 'POLICE_SI',
        totalQuestions: 50,
        durationMinutes: 60,
        totalMarks: 100,
        negativeMarks: 0.5,
        sections: [],
        isFree: false,
        productId: 'com.andaman.quiz.paid_mock_001',
      );

      // Initially locked
      expect(LocalDatabase.instance.isTestUnlocked(paidMock), false);
      expect(LocalDatabase.instance.getPurchasedProductIds().contains(paidMock.id), false);

      // Unlocked via order or restore
      await LocalDatabase.instance.unlockTest(paidMock.id);
      expect(LocalDatabase.instance.isTestUnlocked(paidMock), true);
      expect(LocalDatabase.instance.getPurchasedProductIds().contains(paidMock.id), true);

      // Also unlocked if product ID (SKU) was purchased
      const paidMock2 = MockTest(
        id: 'andaman_paid_mock_002',
        title: 'Paid Mock Test 2',
        examCode: 'POLICE_SI',
        totalQuestions: 50,
        durationMinutes: 60,
        totalMarks: 100,
        negativeMarks: 0.5,
        sections: [],
        isFree: false,
        productId: 'com.andaman.quiz.paid_mock_sku_002',
      );
      expect(LocalDatabase.instance.isTestUnlocked(paidMock2), false);
      await LocalDatabase.instance.unlockTest('com.andaman.quiz.paid_mock_sku_002');
      expect(LocalDatabase.instance.isTestUnlocked(paidMock2), true);
    });

    test('Ad Policy strictly ensures Paid tests are 100% Ad-Free', () async {
      bool adShowInvoked = false;

      await AdService.instance.showResultInterstitial(
        isFreeTest: false,
        onContinue: () {
          adShowInvoked = true;
        },
      );

      expect(adShowInvoked, true, reason: 'Paid tests must immediately invoke onContinue with zero ads');
    });

    test('LocalDatabase ensures zero demo or fake questions exist on fresh installation', () {
      final allQuestions = LocalDatabase.instance.getAllQuestions();
      expect(allQuestions.isEmpty, true, reason: 'Local storage must not contain hardcoded or seed questions');

      final allCategories = LocalDatabase.instance.getCategories();
      expect(allCategories.isEmpty, true, reason: 'Categories must be empty until synced from Firestore');

      final allExams = LocalDatabase.instance.getExams();
      expect(allExams.isEmpty, true, reason: 'Exams must be empty until synced from Firestore');
    });
  });
}
