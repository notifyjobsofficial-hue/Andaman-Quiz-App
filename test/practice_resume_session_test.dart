import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Practice Resume / Restart & Session Counter Suite', () {
    late LocalDatabase db;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      db = LocalDatabase.instance;
      await db.resetForTesting();
      await db.init(force: true);
    });

    test('1. First start on topic with 0 attempts starts at Q1 and queues a session increment', () async {
      final questions = List.generate(
        10,
        (i) => Question(
          id: 'q_$i',
          subjectId: 'sub_1',
          topicId: 'top_idioms',
          examTags: ['CGL'],
          questionEn: 'Question $i',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: ['', '', '', ''],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
        ),
      );

      // Verify no previous progress
      expect(db.getTopicAttemptedCount('top_idioms'), 0);
      expect(db.getResumeQuestionIndex('top_idioms', questions), 0);

      // Enqueue fresh session
      const sessionId = 'ps_inst1_top_idioms_1001';
      expect(db.isPracticeSessionRecorded(sessionId), isFalse);
      await db.enqueuePracticeSession(topicId: 'top_idioms', sessionId: sessionId);

      // Verify session is recorded in pending queue and optimistic count is +1
      expect(db.isPracticeSessionRecorded(sessionId), isTrue);
      expect(db.getTopicSessionCount('top_idioms'), 1);
      final pending = db.getPendingPracticeSessions();
      expect(pending.length, 1);
      expect(pending.first['sessionId'], sessionId);
      expect(pending.first['topicId'], 'top_idioms');
    });

    test('2. Resume position resolves by question IDs and advances to next unattempted question', () async {
      final questions = List.generate(
        146,
        (i) => Question(
          id: 'q_$i',
          subjectId: 'sub_1',
          topicId: 'top_idioms',
          examTags: ['CGL'],
          questionEn: 'Question $i',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: ['', '', '', ''],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
        ),
      );

      // Simulate student answering 42 questions (q_0 through q_41)
      for (int i = 0; i < 42; i++) {
        await db.recordPracticeAnswer(
          isCorrect: true,
          topicId: 'top_idioms',
          questionId: 'q_$i',
          selectedOptionIndex: 0,
          totalQuestions: 146,
          currentQuestionIndex: i,
        );
      }

      expect(db.getTopicAttemptedCount('top_idioms'), 42);

      // First unattempted is at index 42 (Question 43)
      final resumeIndex = db.getResumeQuestionIndex('top_idioms', questions);
      expect(resumeIndex, 42);

      final firstUnattempted = db.getFirstUnattemptedQuestionIndex('top_idioms', questions);
      expect(firstUnattempted, 42);

      // Is completed must be false
      expect(db.isTopicPracticeCompleted('top_idioms', questions), isFalse);
    });

    test('3. Question ID resilience: reordering or inserting questions in Question Bank resolves correctly', () async {
      // Suppose questions were reordered in the bank:
      // q_99 inserted first, then q_0..q_41, then q_42
      final originalQuestions = List.generate(
        10,
        (i) => Question(
          id: 'q_$i',
          subjectId: 'sub_1',
          topicId: 'top_test',
          examTags: ['CGL'],
          questionEn: 'Q$i',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: ['', '', '', ''],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
        ),
      );

      // Answer q_0, q_1, q_2
      await db.recordPracticeAnswer(isCorrect: true, topicId: 'top_test', questionId: 'q_0', selectedOptionIndex: 0);
      await db.recordPracticeAnswer(isCorrect: true, topicId: 'top_test', questionId: 'q_1', selectedOptionIndex: 0);
      await db.recordPracticeAnswer(isCorrect: true, topicId: 'top_test', questionId: 'q_2', selectedOptionIndex: 0);

      // Now admin rearranges questions list: [q_0, q_new, q_1, q_2, q_3]
      final modifiedBank = [
        originalQuestions[0], // q_0 (attempted)
        Question(
          id: 'q_new',
          subjectId: 'sub_1',
          topicId: 'top_test',
          examTags: ['CGL'],
          questionEn: 'New Question',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: ['', '', '', ''],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
        ),
        originalQuestions[1], // q_1 (attempted)
        originalQuestions[2], // q_2 (attempted)
        originalQuestions[3], // q_3 (unattempted)
      ];

      // Finding first unattempted question by ID correctly yields index 1 ('q_new')
      final firstUnattempted = db.getFirstUnattemptedQuestionIndex('top_test', modifiedBank);
      expect(firstUnattempted, 1);
      expect(modifiedBank[firstUnattempted].id, 'q_new');
    });

    test('4. Completed topic correctly signals completed state', () async {
      final questions = List.generate(
        5,
        (i) => Question(
          id: 'q_comp_$i',
          subjectId: 'sub_1',
          topicId: 'top_done',
          examTags: ['CGL'],
          questionEn: 'Q$i',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: ['', '', '', ''],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
        ),
      );

      for (int i = 0; i < 5; i++) {
        await db.recordPracticeAnswer(
          isCorrect: true,
          topicId: 'top_done',
          questionId: 'q_comp_$i',
          selectedOptionIndex: 0,
        );
      }

      expect(db.getTopicAttemptedCount('top_done'), 5);
      expect(db.getFirstUnattemptedQuestionIndex('top_done', questions), -1);
      expect(db.isTopicPracticeCompleted('top_done', questions), isTrue);
    });

    test('5. Restart from Q1 resets topic progress, keeps bookmarks/wrong questions intact', () async {
      // Add a bookmark and a wrong question
      await db.toggleBookmark('q_bookmark_1');
      await db.recordWrongQuestion('q_wrong_1');

      // Add topic progress
      await db.recordPracticeAnswer(isCorrect: true, topicId: 'top_reset', questionId: 'q_0', selectedOptionIndex: 0);
      await db.recordPracticeAnswer(isCorrect: true, topicId: 'top_reset', questionId: 'q_1', selectedOptionIndex: 1);
      expect(db.getTopicAttemptedCount('top_reset'), 2);

      // Perform topic reset
      await db.resetTopicPracticeProgress('top_reset');

      // Topic progress must be reset
      expect(db.getTopicAttemptedCount('top_reset'), 0);
      expect(db.getTopicAnswers('top_reset'), isEmpty);
      expect(db.getTopicLastIndex('top_reset'), 0);

      // Bookmarks and wrong questions must NOT be touched
      expect(db.isBookmarked('q_bookmark_1'), isTrue);
      expect(db.isWrongQuestion('q_wrong_1'), isTrue);
    });

    test('6. Idempotency: Duplicate calls with same sessionId do not increment or double-enqueue', () async {
      const sessionId = 'ps_stable_123';
      await db.enqueuePracticeSession(topicId: 'top_idem', sessionId: sessionId);
      expect(db.getTopicSessionCount('top_idem'), 1);
      expect(db.getPendingPracticeSessions().length, 1);

      // Second attempt with exact same sessionId (e.g. rebuild / double-tap / retry)
      await db.enqueuePracticeSession(topicId: 'top_idem', sessionId: sessionId);
      expect(db.getTopicSessionCount('top_idem'), 1);
      expect(db.getPendingPracticeSessions().length, 1);
    });

    test('7. Mark synced moves session from pending queue to synced list', () async {
      const sessionId = 'ps_sync_test';
      await db.enqueuePracticeSession(topicId: 'top_sync', sessionId: sessionId);
      expect(db.getPendingPracticeSessions().length, 1);

      await db.markPracticeSessionSynced(sessionId);
      expect(db.getPendingPracticeSessions().length, 0);
      expect(db.isPracticeSessionRecorded(sessionId), isTrue);

      // Subsequent attempt with synced ID is blocked
      await db.enqueuePracticeSession(topicId: 'top_sync', sessionId: sessionId);
      expect(db.getPendingPracticeSessions().length, 0);
    });

    test('8. Compact count formatting matches requirements', () {
      expect(TopicPracticeSession.formatPracticeCount(0), '0 practiced');
      expect(TopicPracticeSession.formatPracticeCount(327), '327 practiced');
      expect(TopicPracticeSession.formatPracticeCount(999), '999 practiced');
      expect(TopicPracticeSession.formatPracticeCount(1200), '1.2K practiced');
      expect(TopicPracticeSession.formatPracticeCount(12500), '12.5K practiced');
      expect(TopicPracticeSession.formatPracticeCount(1000000), '1M practiced');
      expect(TopicPracticeSession.formatPracticeCount(2500000), '2.5M practiced');
    });
  });
}
