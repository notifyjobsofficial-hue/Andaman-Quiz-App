import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/features/home/presentation/home_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    await LocalDatabase.instance.resetForTesting();
    SharedPreferences.setMockInitialValues({});
    await LocalDatabase.instance.init(force: true);
  });

  group('CONTINUE PRACTICE ARCHITECTURE & VERIFICATION SUITE', () {
    test('1. Old completed mock tests are strictly excluded from Continue Practice and preserved in Mock History', () async {
      final db = LocalDatabase.instance;

      // Seed a completed mock test attempt (such as the audited "A&N CHSL Full Mock Test 01")
      final mockAttempt = StudentAttempt(
        id: 'attempt_chsl_01',
        testId: 'mock_chsl_01',
        testTitle: 'A&N CHSL Full Mock Test 01',
        examCode: 'CHSL',
        score: 5.0,
        maxScore: 200.0,
        correctCount: 4,
        wrongCount: 10,
        unattemptedCount: 86,
        accuracy: 28.57,
        timeTakenSeconds: 3600,
        timestamp: DateTime.now(),
        sectionScores: {},
        selectedAnswers: {},
      );
      await db.recordAttempt(mockAttempt);

      // 1A. Preserved in test attempts / mock history
      expect(db.getAttempts().length, 1);
      expect(db.getAttempts().first.testTitle, 'A&N CHSL Full Mock Test 01');
      expect(db.getAttempts().first.score, 5.0);

      // 1B. Continue Practice must be NULL (no topic practice has started)
      expect(db.getResumablePracticeSession('CGL'), isNull);
      expect(db.getResumablePracticeSession('CHSL'), isNull);
      expect(db.getResumablePracticeSession('ALL'), isNull);
    });

    test('2. Incomplete topic practice session is accurately tracked and formatted', () async {
      final db = LocalDatabase.instance;

      // Seed subject & topic
      final subject = const Subject(
        id: 'sub_eng',
        name: 'General English',
        hindiName: 'सामान्य अंग्रेजी',
        iconName: 'book',
        questionCount: 146,
        examCodes: ['CGL'],
      );
      await db.syncSubjectsFromFirestore([subject]);

      final topic = const Topic(
        id: 'top_idioms',
        subjectId: 'sub_eng',
        name: 'Idioms',
        hindiName: 'मुहावरे',
        questionCount: 146,
      );
      await db.syncTopicsFromFirestore([topic]);

      // Seed 146 questions for Idioms
      final questions = List.generate(
        146,
        (i) => Question(
          id: 'q_idiom_$i',
          subjectId: 'sub_eng',
          topicId: 'top_idioms',
          examTags: ['CGL'],
          questionEn: 'Idiom question $i',
          questionHi: '',
          optionsEn: ['Option A', 'Option B', 'Option C', 'Option D'],
          optionsHi: [],
          correctIndex: 1,
          explanationEn: 'Explanation',
          explanationHi: '',
          usageType: 'PRACTICE',
          status: 'published',
        ),
      );
      await db.syncSubjectQuestionsFromFirestore('sub_eng', questions);

      // Student answers 5 questions: 4 correct, 1 wrong
      for (int i = 0; i < 4; i++) {
        await db.recordPracticeAnswer(
          isCorrect: true,
          topicId: 'top_idioms',
          questionId: 'q_idiom_$i',
          selectedOptionIndex: 1,
          examCode: 'CGL',
          totalQuestions: 146,
          currentQuestionIndex: i,
        );
      }
      await db.recordPracticeAnswer(
        isCorrect: false,
        topicId: 'top_idioms',
        questionId: 'q_idiom_4',
        selectedOptionIndex: 0,
        examCode: 'CGL',
        totalQuestions: 146,
        currentQuestionIndex: 4,
      );

      // Verify resumable practice session for CGL
      final session = db.getResumablePracticeSession('CGL');
      expect(session, isNotNull);
      expect(session!.topicName, 'Idioms');
      expect(session.subjectName, 'General English');
      expect(session.examDisplay, 'AN CGL');
      expect(session.attemptedCount, 5);
      expect(session.totalQuestions, 146);
      expect(session.correctCount, 4);
      expect(session.accuracy, 80.0); // 4/5 * 100
      expect(session.isCompleted, isFalse);
    });

    test('3. Exam switching: Selected-exam context strictly isolates practice sessions', () async {
      final db = LocalDatabase.instance;

      // Seed CGL Subject & Topic
      final cglSubject = const Subject(
        id: 'sub_eng_cgl',
        name: 'General English',
        hindiName: 'सामान्य अंग्रेजी',
        iconName: 'book',
        questionCount: 146,
        examCodes: ['CGL'],
      );
      final cglTopic = const Topic(
        id: 'top_idioms_cgl',
        subjectId: 'sub_eng_cgl',
        name: 'Idioms',
        hindiName: 'मुहावरे',
        questionCount: 146,
      );

      // Seed CHSL Subject & Topic
      final chslSubject = const Subject(
        id: 'sub_math_chsl',
        name: 'Quantitative Aptitude',
        hindiName: 'गणित',
        iconName: 'calculate',
        questionCount: 50,
        examCodes: ['CHSL'],
      );
      final chslTopic = const Topic(
        id: 'top_percentages_chsl',
        subjectId: 'sub_math_chsl',
        name: 'Percentages',
        hindiName: 'प्रतिशत',
        questionCount: 50,
      );

      await db.syncSubjectsFromFirestore([cglSubject, chslSubject]);
      await db.syncTopicsFromFirestore([cglTopic, chslTopic]);

      // Seed questions
      final cglQs = List.generate(
        146,
        (i) => Question(
          id: 'q_cgl_$i',
          subjectId: 'sub_eng_cgl',
          topicId: 'top_idioms_cgl',
          examTags: ['CGL'],
          questionEn: 'CGL question $i',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: [],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
        ),
      );
      final chslQs = List.generate(
        50,
        (i) => Question(
          id: 'q_chsl_$i',
          subjectId: 'sub_math_chsl',
          topicId: 'top_percentages_chsl',
          examTags: ['CHSL'],
          questionEn: 'CHSL question $i',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: [],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
        ),
      );
      await db.syncSubjectQuestionsFromFirestore('sub_eng_cgl', cglQs);
      await db.syncSubjectQuestionsFromFirestore('sub_math_chsl', chslQs);

      // Answer 10 CGL questions
      for (int i = 0; i < 10; i++) {
        await db.recordPracticeAnswer(
          isCorrect: true,
          topicId: 'top_idioms_cgl',
          questionId: 'q_cgl_$i',
          examCode: 'CGL',
          totalQuestions: 146,
        );
      }

      // Answer 5 CHSL questions
      for (int i = 0; i < 5; i++) {
        await db.recordPracticeAnswer(
          isCorrect: true,
          topicId: 'top_percentages_chsl',
          questionId: 'q_chsl_$i',
          examCode: 'CHSL',
          totalQuestions: 50,
        );
      }

      // 3A. When CGL is selected -> returns CGL session (Idioms)
      final cglSession = db.getResumablePracticeSession('CGL');
      expect(cglSession, isNotNull);
      expect(cglSession!.topicName, 'Idioms');
      expect(cglSession.attemptedCount, 10);

      // 3B. When CHSL is selected -> returns CHSL session (Percentages)
      final chslSession = db.getResumablePracticeSession('CHSL');
      expect(chslSession, isNotNull);
      expect(chslSession!.topicName, 'Percentages');
      expect(chslSession.attemptedCount, 5);

      // 3C. When MTS is selected -> NO MTS session exists -> returns NULL (hidden)
      final mtsSession = db.getResumablePracticeSession('MTS');
      expect(mtsSession, isNull);

      // 3D. When ALL is selected -> returns the most recently updated session
      final allSession = db.getResumablePracticeSession('ALL');
      expect(allSession, isNotNull);
      expect(allSession!.topicName, 'Percentages'); // CHSL was practiced last
    });

    test('4. 100% completed practice sessions are excluded from Continue Practice', () async {
      final db = LocalDatabase.instance;

      final subject = const Subject(
        id: 'sub_gk',
        name: 'General Awareness',
        hindiName: 'सामान्य ज्ञान',
        iconName: 'public',
        questionCount: 5,
        examCodes: ['CGL'],
      );
      final topic = const Topic(
        id: 'top_history',
        subjectId: 'sub_gk',
        name: 'History',
        hindiName: 'इतिहास',
        questionCount: 5,
      );
      await db.syncSubjectsFromFirestore([subject]);
      await db.syncTopicsFromFirestore([topic]);

      final questions = List.generate(
        5,
        (i) => Question(
          id: 'q_hist_$i',
          subjectId: 'sub_gk',
          topicId: 'top_history',
          examTags: ['CGL'],
          questionEn: 'History question $i',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: [],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
        ),
      );
      await db.syncSubjectQuestionsFromFirestore('sub_gk', questions);

      // Answer 4 of 5 (incomplete -> should show)
      for (int i = 0; i < 4; i++) {
        await db.recordPracticeAnswer(
          isCorrect: true,
          topicId: 'top_history',
          questionId: 'q_hist_$i',
          examCode: 'CGL',
          totalQuestions: 5,
        );
      }
      expect(db.getResumablePracticeSession('CGL'), isNotNull);

      // Complete 5th question (5/5 = 100% -> must NOT show)
      await db.recordPracticeAnswer(
        isCorrect: true,
        topicId: 'top_history',
        questionId: 'q_hist_4',
        examCode: 'CGL',
        totalQuestions: 5,
      );
      expect(db.getResumablePracticeSession('CGL'), isNull);
    });

    test('5. Resume question index calculation resumes at the first unattempted question', () async {
      final db = LocalDatabase.instance;

      final questions = List.generate(
        10,
        (i) => Question(
          id: 'q_test_$i',
          subjectId: 'sub_test',
          topicId: 'top_test',
          examTags: ['CGL'],
          questionEn: 'Question $i',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: [],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
        ),
      );

      // Before any attempts -> resume index is 0
      expect(db.getResumeQuestionIndex('top_test', questions), 0);

      // Student answers questions 0, 1, 2, 3, 4 (5 questions)
      for (int i = 0; i < 5; i++) {
        await db.recordPracticeAnswer(
          isCorrect: true,
          topicId: 'top_test',
          questionId: 'q_test_$i',
          selectedOptionIndex: 0,
        );
      }

      // First unattempted question is at index 5 (Question 6) -> DO NOT restart from Question 1!
      expect(db.getResumeQuestionIndex('top_test', questions), 5);

      // Verify answers are preserved
      final savedAnswers = db.getTopicAnswers('top_test');
      expect(savedAnswers['q_test_0'], 0);
      expect(savedAnswers['q_test_4'], 0);
      expect(savedAnswers['q_test_5'], isNull);
    });

    testWidgets('6. HomeScreen renders Continue Practice card when incomplete session exists and hides when none exists', (tester) async {
      final db = LocalDatabase.instance;

      final subject = const Subject(
        id: 'sub_eng',
        name: 'General English',
        hindiName: 'सामान्य अंग्रेजी',
        iconName: 'book',
        questionCount: 146,
        examCodes: ['CGL'],
      );
      final topic = const Topic(
        id: 'top_idioms',
        subjectId: 'sub_eng',
        name: 'Idioms',
        hindiName: 'मुहावरे',
        questionCount: 146,
      );
      final exam = const Exam(
        id: 'exam_cgl',
        name: 'AN CGL',
        code: 'CGL',
        description: 'Combined Graduate Level',
        totalQuestions: 100,
        iconName: 'school',
      );
      await db.syncSubjectsFromFirestore([subject]);
      await db.syncTopicsFromFirestore([topic]);
      await db.syncExamsFromFirestore([exam]);
      await db.setSelectedExam('CGL');

      // PHASE A: No practice done yet -> Continue Practice must NOT be displayed
      await tester.pumpWidget(
        ProviderScope(
          key: UniqueKey(),
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Continue Practice'), findsNothing);
      expect(find.text('Idioms'), findsNothing);

      // PHASE B: Student answers 5 questions in Idioms
      for (int i = 0; i < 5; i++) {
        await db.recordPracticeAnswer(
          isCorrect: i != 4,
          topicId: 'top_idioms',
          questionId: 'q_idiom_$i',
          examCode: 'CGL',
          totalQuestions: 146,
        );
      }

      // Rebuild HomeScreen with fresh ProviderScope
      await tester.pumpWidget(
        ProviderScope(
          key: UniqueKey(),
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Continue Practice is now visible with real topic data!
      expect(find.text('Continue Practice'), findsOneWidget);
      expect(find.text('Idioms'), findsOneWidget);
      expect(find.text('General English • AN CGL'), findsOneWidget);
      expect(find.text('5 of 146 completed'), findsOneWidget);
      expect(find.text('80% Accuracy'), findsOneWidget);
      expect(find.text('Continue →'), findsOneWidget);

      // Score / 200, Review, and Retake must NOT be rendered!
      expect(find.text('Review'), findsNothing);
      expect(find.text('Retake'), findsNothing);
      expect(find.textContaining('/ 200'), findsNothing);
    });

    test('7. Real Resume Test: Answering questions, resuming at next question, and dynamic progress update', () async {
      final db = LocalDatabase.instance;

      final subject = const Subject(
        id: 'sub_eng',
        name: 'General English',
        hindiName: 'सामान्य अंग्रेजी',
        iconName: 'book',
        questionCount: 146,
        examCodes: ['CGL'],
      );
      final topic = const Topic(
        id: 'top_idioms',
        subjectId: 'sub_eng',
        name: 'Idioms',
        hindiName: 'मुहावरे',
        questionCount: 146,
      );
      await db.syncSubjectsFromFirestore([subject]);
      await db.syncTopicsFromFirestore([topic]);

      final questions = List.generate(
        146,
        (i) => Question(
          id: 'q_idiom_$i',
          subjectId: 'sub_eng',
          topicId: 'top_idioms',
          examTags: ['CGL'],
          questionEn: 'Idiom question $i',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: [],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
        ),
      );
      await db.syncSubjectQuestionsFromFirestore('sub_eng', questions);

      // 1. Answer 5 questions
      for (int i = 0; i < 5; i++) {
        await db.recordPracticeAnswer(
          isCorrect: true,
          topicId: 'top_idioms',
          questionId: 'q_idiom_$i',
          selectedOptionIndex: 0,
          examCode: 'CGL',
          totalQuestions: 146,
          currentQuestionIndex: i,
        );
      }

      // Check Home session
      var session = db.getResumablePracticeSession('CGL');
      expect(session, isNotNull);
      expect(session!.attemptedCount, 5);
      expect(session.accuracy, 100.0);

      // Check resume position (resumes at index 5, Question 6)
      final resumeIndex = db.getResumeQuestionIndex('top_idioms', questions);
      expect(resumeIndex, 5);

      // 2. Answer 3 more questions (questions 5, 6, 7)
      for (int i = 5; i < 8; i++) {
        await db.recordPracticeAnswer(
          isCorrect: i != 7, // 2 correct, 1 wrong
          topicId: 'top_idioms',
          questionId: 'q_idiom_$i',
          selectedOptionIndex: i == 7 ? 1 : 0,
          examCode: 'CGL',
          totalQuestions: 146,
          currentQuestionIndex: i,
        );
      }

      // Check Home session updated dynamically
      session = db.getResumablePracticeSession('CGL');
      expect(session, isNotNull);
      expect(session!.attemptedCount, 8);
      expect(session.correctCount, 7);
      expect(session.accuracy, closeTo((7 / 8) * 100, 0.01)); // 87.5%

      // Check new resume position is index 8 (Question 9)
      final nextResumeIndex = db.getResumeQuestionIndex('top_idioms', questions);
      expect(nextResumeIndex, 8);
    });
  });
}
