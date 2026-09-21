import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/core/widgets/question_source_metadata.dart';
import 'package:andaman_quiz/features/practice/presentation/topics_list_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    await LocalDatabase.instance.resetForTesting();
    SharedPreferences.setMockInitialValues({});
    await LocalDatabase.instance.init(force: true);
  });

  group('PRACTICE TOPIC COUNT & ACCURACY VERIFICATION SUITE', () {
    test('1. Idioms 146-question dataset loads identical count for Topic Card and Practice Session', () async {
      final db = LocalDatabase.instance;

      final subject = const Subject(
        id: 'sub_eng',
        name: 'General English',
        hindiName: 'सामान्य अंग्रेजी',
        iconName: 'book',
        questionCount: 0,
        examCodes: ['ssc_cgl'],
      );
      await db.syncSubjectsFromFirestore([subject]);

      final topic = const Topic(
        id: 'top_idioms',
        subjectId: 'sub_eng',
        name: 'Idioms',
        hindiName: 'मुहावरे',
        questionCount: 0, // In Firestore topic doc, questionCount was 0!
      );
      await db.syncTopicsFromFirestore([topic]);

      // Seed exactly 146 published questions for Idioms
      final questions = List.generate(146, (i) => Question(
        id: 'q_idiom_$i',
        subjectId: 'sub_eng',
        topicId: 'top_idioms',
        topicName: 'Idioms',
        examTags: ['SSC CGL'],
        questionEn: 'Meaning of idiom $i',
        questionHi: '',
        optionsEn: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: 'Explanation $i',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'published',
      ));

      await db.syncTopicQuestionsFromFirestore('top_idioms', questions);

      // Verify Shared Single Source of Truth
      final eligibleForCard = db.getQuestionsByTopic(topic.id);
      final eligibleForSession = db.getQuestionsByTopic('top_idioms');

      expect(eligibleForCard.length, 146, reason: 'Topic card dataset must resolve exactly 146 questions');
      expect(eligibleForSession.length, 146, reason: 'Practice session dataset must resolve exactly 146 questions');
      expect(eligibleForCard.length == eligibleForSession.length, isTrue, reason: 'Counts must match 100%');
    });

    test('2. Accuracy and progress bar formulas adhere strictly to genuine practice architecture', () async {
      final db = LocalDatabase.instance;

      // 146 available questions
      final questions = List.generate(146, (i) => Question(
        id: 'q_idiom_$i',
        subjectId: 'sub_eng',
        topicId: 'top_idioms',
        topicName: 'Idioms',
        examTags: ['SSC CGL'],
        questionEn: 'Meaning of idiom $i',
        questionHi: '',
        optionsEn: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'published',
      ));
      await db.syncTopicQuestionsFromFirestore('top_idioms', questions);

      // Before any attempts
      expect(db.getTopicAttemptedCount('top_idioms'), 0);
      expect(db.getTopicAccuracy('top_idioms'), 0.0);
      expect(db.getTopicProgress('top_idioms'), 0.0);

      // Student attempts 20 questions: 15 correct, 5 wrong
      for (int i = 0; i < 15; i++) {
        await db.recordPracticeAnswer(
          isCorrect: true,
          topicId: 'top_idioms',
          questionId: 'q_idiom_$i',
        );
      }
      for (int i = 15; i < 20; i++) {
        await db.recordPracticeAnswer(
          isCorrect: false,
          topicId: 'top_idioms',
          questionId: 'q_idiom_$i',
        );
      }

      // Verify calculations:
      // Accuracy = (15 / 20) * 100 = 75.0%
      // NOT (15 / 146) which would be 10.2%
      expect(db.getTopicAttemptedCount('top_idioms'), 20);
      expect(db.getTopicCorrectCount('top_idioms'), 15);
      expect(db.getTopicAccuracy('top_idioms'), 75.0);

      // Progress = 20 / 146
      final progress = db.getTopicProgress('top_idioms');
      expect(progress, closeTo(20 / 146, 0.001));
      final percentage = (progress * 100).toInt();
      expect(percentage, 13);
    });

    test('3. Test other topics: Quantitative Aptitude and additional English topic', () async {
      final db = LocalDatabase.instance;

      // Seed Quantitative Aptitude -> Percentages (50 questions)
      final quantQs = List.generate(50, (i) => Question(
        id: 'q_quant_$i',
        subjectId: 'sub_quant',
        topicId: 'top_percentages',
        topicName: 'Percentages',
        examTags: ['SSC CGL'],
        questionEn: 'Percentage question $i',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: [],
        correctIndex: 1,
        explanationEn: '',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'published',
      ));
      await db.syncTopicQuestionsFromFirestore('top_percentages', quantQs);

      // Seed English -> Synonyms (30 questions)
      final synQs = List.generate(30, (i) => Question(
        id: 'q_syn_$i',
        subjectId: 'sub_eng',
        topicId: 'top_synonyms',
        topicName: 'Synonyms',
        examTags: ['SSC CGL'],
        questionEn: 'Synonym question $i',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: [],
        correctIndex: 2,
        explanationEn: '',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'published',
      ));
      await db.syncTopicQuestionsFromFirestore('top_synonyms', synQs);

      expect(db.getQuestionsByTopic('top_percentages').length, 50);
      expect(db.getQuestionsByTopic('top_synonyms').length, 30);
    });

    test('4. Dynamic sync lifecycle: add/publish, unpublish to draft, and move-topic count adjustments', () async {
      final db = LocalDatabase.instance;

      // Start with 2 published questions in Topic A
      final q1 = const Question(
        id: 'q_test_1',
        subjectId: 'sub_eng',
        topicId: 'top_idioms',
        topicName: 'Idioms',
        examTags: ['SSC'],
        questionEn: 'Idiom 1',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'published',
      );
      final q2 = const Question(
        id: 'q_test_2',
        subjectId: 'sub_eng',
        topicId: 'top_idioms',
        topicName: 'Idioms',
        examTags: ['SSC'],
        questionEn: 'Idiom 2',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'published',
      );

      await db.syncSubjectQuestionsFromFirestore('sub_eng', [q1, q2]);
      expect(db.getQuestionsByTopic('top_idioms').length, 2);

      // 4A. Admin publishes a 3rd question -> sync -> count increases to 3
      final q3 = const Question(
        id: 'q_test_3',
        subjectId: 'sub_eng',
        topicId: 'top_idioms',
        topicName: 'Idioms',
        examTags: ['SSC'],
        questionEn: 'Idiom 3',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'published',
      );
      await db.syncSubjectQuestionsFromFirestore('sub_eng', [q1, q2, q3]);
      expect(db.getQuestionsByTopic('top_idioms').length, 3);

      // 4B. Admin unpublishes q2 to draft -> sync -> count decreases to 2
      // Remote published list only contains q1 and q3
      await db.syncSubjectQuestionsFromFirestore('sub_eng', [q1, q3]);
      expect(db.getQuestionsByTopic('top_idioms').length, 2);

      // 4C. Admin moves q3 from Idioms to Synonyms -> sync -> Idioms count decreases to 1, Synonyms becomes 1
      final q3Moved = q3.copyWith(
        topicId: 'top_synonyms',
        topicName: 'Synonyms',
      );
      await db.syncSubjectQuestionsFromFirestore('sub_eng', [q1, q3Moved]);
      expect(db.getQuestionsByTopic('top_idioms').length, 1);
      expect(db.getQuestionsByTopic('top_synonyms').length, 1);
    });

    testWidgets('5. TopicsListScreen renders 146 Questions and 0% Accuracy for Idioms without crash', (tester) async {
      final db = LocalDatabase.instance;

      final subject = const Subject(
        id: 'sub_eng',
        name: 'General English',
        hindiName: 'सामान्य अंग्रेजी',
        iconName: 'book',
        questionCount: 0,
        examCodes: ['ssc_cgl'],
      );
      await db.syncSubjectsFromFirestore([subject]);

      final topic = const Topic(
        id: 'top_idioms',
        subjectId: 'sub_eng',
        name: 'Idioms',
        hindiName: 'मुहावरे',
        questionCount: 0,
      );
      await db.syncTopicsFromFirestore([topic]);

      // Seed 146 questions
      final questions = List.generate(146, (i) => Question(
        id: 'q_idiom_$i',
        subjectId: 'sub_eng',
        topicId: 'top_idioms',
        topicName: 'Idioms',
        examTags: ['SSC CGL'],
        questionEn: 'Meaning of idiom $i',
        questionHi: '',
        optionsEn: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'published',
      ));
      await db.syncTopicQuestionsFromFirestore('top_idioms', questions);

      await tester.pumpWidget(
        const MaterialApp(
          home: TopicsListScreen(subjectId: 'sub_eng'),
        ),
      );
      await tester.pump();

      // Verify card content
      expect(find.text('Idioms'), findsOneWidget);
      expect(find.text('146 Questions • 0% Accuracy'), findsOneWidget);
      expect(find.text('0%'), findsOneWidget);
      expect(find.text('Continue'), findsOneWidget);
    });
  });

  group('QUESTION EXAM / SOURCE METADATA VERIFICATION SUITE', () {
    test('1. Structured metadata format: Exam + Date + Shift', () {
      final q = const Question(
        id: 'q_source_1',
        subjectId: 'sub_eng',
        topicId: 'top_idioms',
        examTags: [],
        questionEn: 'Choose the correct meaning of idiom "Eat crow"',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: [],
        correctIndex: 3,
        explanationEn: '',
        explanationHi: '',
        sourceExam: 'SSC CGL',
        examDate: '2025-09-21',
        shift: 'Shift 1',
      );

      expect(q.cleanQuestionEn, 'Choose the correct meaning of idiom "Eat crow"');
      expect(q.resolvedSourceInfo, 'SSC CGL • 21 Sep 2025 • Shift 1');
    });

    test('2. Structured metadata format: Exam only', () {
      final q = const Question(
        id: 'q_source_2',
        subjectId: 'sub_eng',
        topicId: 'top_idioms',
        examTags: [],
        questionEn: 'Choose the correct meaning of idiom "Bite the bullet"',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        sourceExam: 'SSC CHSL',
      );

      expect(q.cleanQuestionEn, 'Choose the correct meaning of idiom "Bite the bullet"');
      expect(q.resolvedSourceInfo, 'SSC CHSL');
    });

    test('3. Structured metadata format: Exam + Date', () {
      final q = const Question(
        id: 'q_source_3',
        subjectId: 'sub_eng',
        topicId: 'top_idioms',
        examTags: [],
        questionEn: 'Choose the correct meaning of idiom "Break a leg"',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        sourceExam: 'A&N Police',
        examDate: '15/03/2024',
      );

      expect(q.resolvedSourceInfo, 'A&N Police • 15 Mar 2024');
    });

    test('4. Question with NO source metadata returns null and does not render row (even with taxonomy examTags)', () {
      final q = const Question(
        id: 'q_source_4',
        subjectId: 'sub_eng',
        topicId: 'top_idioms',
        examTags: ['AN CHSL'], // Taxonomy exam must NEVER leak into source info
        questionEn: 'What is the capital of India?',
        questionHi: '',
        optionsEn: ['Delhi', 'Mumbai', 'Chennai', 'Kolkata'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
      );

      expect(q.cleanQuestionEn, 'What is the capital of India?');
      expect(q.resolvedSourceInfo, isNull, reason: 'Must return null when genuine sourceExam is absent');
      expect(q.formattedSourceInfo, isNull);
    });

    test('5. Question A: taxonomy = AN CHSL, sourceExam = blank -> NO SOURCE TAG', () {
      final q = Question.fromMap({
        'id': 'q_1789797651242_0a0ktaupj',
        'exam': 'AN CHSL',
        'category': 'SSC',
        'subject': 'General English',
        'subjectId': 'sub_general_english',
        'topic': 'Idioms',
        'topicId': 'top_idioms',
        'question_text': 'Choose the correct meaning of idiom Eat crow SSC CGL 21/09/2025 (Shift-1)',
        'correct_answer': 'D',
        'status': 'published',
        'usageType': 'BOTH',
      });

      expect(q.examTags, contains('AN CHSL'));
      expect(q.sourceExam, isNull);
      expect(q.examDate, isNull);
      expect(q.shift, isNull);
      expect(q.resolvedSourceInfo, isNull);
      expect(q.cleanQuestionEn, 'Choose the correct meaning of idiom Eat crow');
    });

    test('6. Question B: taxonomy = AN CHSL, genuine sourceExam = SSC CGL -> Shows source metadata', () {
      final q = Question.fromMap({
        'id': 'q_source_b',
        'exam': 'AN CHSL',
        'category': 'SSC',
        'subject': 'General English',
        'subjectId': 'sub_general_english',
        'topic': 'Idioms',
        'topicId': 'top_idioms',
        'question_text': 'Choose the correct meaning of idiom',
        'sourceExam': 'SSC CGL',
        'examDate': '21/09/2025',
        'shift': 'Shift-1',
        'correct_answer': 'A',
        'status': 'published',
        'usageType': 'BOTH',
      });

      expect(q.examTags, contains('AN CHSL'));
      expect(q.sourceExam, 'SSC CGL');
      expect(q.resolvedSourceInfo, 'SSC CGL • 21 Sep 2025 • Shift 1');
    });

    test('7. Question C: taxonomy = AN CGL, sourceExam = blank -> NO SOURCE TAG', () {
      final q = Question.fromMap({
        'id': 'q_source_c',
        'exam': 'AN CGL',
        'category': 'SSC',
        'subject': 'General English',
        'subjectId': 'sub_general_english',
        'topic': 'Idioms',
        'topicId': 'top_idioms',
        'question_text': 'What is the meaning of this idiom?',
        'correct_answer': 'B',
        'status': 'published',
        'usageType': 'BOTH',
      });

      expect(q.examTags, contains('AN CGL'));
      expect(q.sourceExam, isNull);
      expect(q.resolvedSourceInfo, isNull);
    });

    testWidgets('8. QuestionSourceMetadata widget renders cleanly and wraps without overflow at 320dp', (tester) async {
      tester.view.physicalSize = const Size(320 * 3, 600 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 320,
              child: QuestionSourceMetadata(
                sourceInfo: 'SSC CGL • 21 Sep 2025 • Shift 1',
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('SSC CGL • 21 Sep 2025 • Shift 1'), findsOneWidget);
      expect(tester.takeException(), isNull, reason: 'Must render with ZERO overflow at 320dp');
    });

    testWidgets('9. QuestionSourceMetadata returns SizedBox.shrink when sourceInfo is null or empty', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: QuestionSourceMetadata(sourceInfo: null),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(SizedBox), findsOneWidget);
      expect(find.byType(Icon), findsNothing);
    });

    test('10. Cache test: questions saved to local database cache and reloaded do not show stale AN CHSL', () async {
      final db = LocalDatabase.instance;
      final q = Question.fromMap({
        'id': 'q_cache_test_1',
        'exam': 'AN CHSL',
        'category': 'SSC',
        'subject': 'General English',
        'subjectId': 'sub_general_english',
        'topic': 'Idioms',
        'topicId': 'top_idioms',
        'question_text': 'Meaning of idiom',
        'correct_answer': 'A',
        'status': 'published',
        'usageType': 'PRACTICE',
      });

      await db.syncTopicQuestionsFromFirestore('top_idioms', [q]);

      // Re-initialize local database simulating app restart
      await db.init(force: true);

      final loadedQuestions = db.getQuestionsByTopic('top_idioms');
      expect(loadedQuestions.length, 1);
      final loadedQ = loadedQuestions.first;
      expect(loadedQ.sourceExam, isNull);
      expect(loadedQ.resolvedSourceInfo, isNull);
      expect(loadedQ.formattedSourceInfo, isNull);
    });
  });
}
