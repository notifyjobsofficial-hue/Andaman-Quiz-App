import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/core/database/local_database.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalDatabase.instance.init(force: true);
  });

  group('QA_PRACTICE_STATUS_TEST: Flutter Question Model & Serialization', () {
    test('1. Question model parses published, draft, and archived statuses correctly', () {
      final qPublished = Question.fromMap({
        'id': 'q_pub',
        'question_text': 'Published Question',
        'status': 'published',
        'usageType': 'PRACTICE',
      });
      expect(qPublished.status, 'published');
      expect(qPublished.isPublished, isTrue);
      expect(qPublished.isDraft, isFalse);
      expect(qPublished.isArchived, isFalse);

      final qDraft = Question.fromMap({
        'id': 'q_draft',
        'question_text': 'Draft Question',
        'status': 'draft',
        'usageType': 'PRACTICE',
      });
      expect(qDraft.status, 'draft');
      expect(qDraft.isPublished, isFalse);
      expect(qDraft.isDraft, isTrue);
      expect(qDraft.isArchived, isFalse);

      final qArchived = Question.fromMap({
        'id': 'q_archived',
        'question_text': 'Archived Question',
        'status': 'archived',
        'usageType': 'BOTH',
      });
      expect(qArchived.status, 'archived');
      expect(qArchived.isPublished, isFalse);
      expect(qArchived.isDraft, isFalse);
      expect(qArchived.isArchived, isTrue);
    });

    test('2. Legacy records without explicit status default safely to published', () {
      final qLegacy = Question.fromMap({
        'id': 'q_legacy',
        'question_text': 'Legacy Live Question',
        // No status field provided
      });
      expect(qLegacy.status, 'published');
      expect(qLegacy.isPublished, isTrue);

      final qLegacyDraft = Question.fromMap({
        'id': 'q_legacy_draft',
        'question_text': 'Legacy Draft with is_draft flag',
        'is_draft': true,
      });
      expect(qLegacyDraft.status, 'draft');
      expect(qLegacyDraft.isDraft, isTrue);
    });

    test('3. Question copyWith updates status cleanly without data loss', () {
      const q = Question(
        id: 'q1',
        subjectId: 's1',
        topicId: 't1',
        examTags: ['ANCHSL'],
        questionEn: 'Sample question?',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: 'Explanation',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'draft',
      );
      expect(q.isDraft, isTrue);

      final publishedQ = q.copyWith(status: 'published');
      expect(publishedQ.isPublished, isTrue);
      expect(publishedQ.usageType, 'PRACTICE');
      expect(publishedQ.id, 'q1');

      final archivedQ = publishedQ.copyWith(status: 'archived');
      expect(archivedQ.isArchived, isTrue);
      expect(archivedQ.usageType, 'PRACTICE');
    });
  });

  group('QA_PRACTICE_STATUS_TEST: LocalDatabase Practice Filtering & Visibility', () {
    test('4. getQuestionsByTopic filters out draft and archived questions', () async {
      final questions = [
        const Question(
          id: 'q_pub_1',
          subjectId: 'gk',
          topicId: 'Islands',
          examTags: ['ANCHSL'],
          questionEn: 'Published Islands Q',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: [],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
          usageType: 'PRACTICE',
          status: 'published',
        ),
        const Question(
          id: 'q_draft_1',
          subjectId: 'gk',
          topicId: 'Islands',
          examTags: ['ANCHSL'],
          questionEn: 'Draft Islands Q',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: [],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
          usageType: 'PRACTICE',
          status: 'draft',
        ),
        const Question(
          id: 'q_archived_1',
          subjectId: 'gk',
          topicId: 'Islands',
          examTags: ['ANCHSL'],
          questionEn: 'Archived Islands Q',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: [],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
          usageType: 'PRACTICE',
          status: 'archived',
        ),
        const Question(
          id: 'q_mock_only',
          subjectId: 'gk',
          topicId: 'Islands',
          examTags: ['ANCHSL'],
          questionEn: 'Mock Only Islands Q',
          questionHi: '',
          optionsEn: ['A', 'B', 'C', 'D'],
          optionsHi: [],
          correctIndex: 0,
          explanationEn: '',
          explanationHi: '',
          usageType: 'MOCK',
          status: 'published',
        ),
      ];

      await LocalDatabase.instance.syncQuestionsFromFirestore(questions);

      final result = LocalDatabase.instance.getQuestionsByTopic('Islands');
      expect(result.length, 1);
      expect(result.first.id, 'q_pub_1');
      expect(result.first.isPublished, isTrue);
    });

    test('5. Lifecycle transition: Draft -> Published -> Draft -> Archived', () async {
      const initialDraft = Question(
        id: 'lifecycle_q',
        subjectId: 'gk',
        topicId: 'History',
        examTags: ['ANCHSL'],
        questionEn: 'Cellular Jail construction year?',
        questionHi: '',
        optionsEn: ['1906', '1857', '1947', '1942'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'draft',
      );

      // Phase A: Draft
      await LocalDatabase.instance.syncQuestionsFromFirestore([initialDraft]);
      expect(LocalDatabase.instance.getQuestionsByTopic('History'), isEmpty,
          reason: 'Draft question must not appear in Practice');

      // Phase B: Admin publishes question
      final published = initialDraft.copyWith(status: 'published');
      await LocalDatabase.instance.syncQuestionsFromFirestore([published]);
      var practiceQs = LocalDatabase.instance.getQuestionsByTopic('History');
      expect(practiceQs.length, 1);
      expect(practiceQs.first.id, 'lifecycle_q');
      expect(practiceQs.first.isPublished, isTrue);

      // Phase C: Admin unpublishes back to Draft
      final draftedAgain = published.copyWith(status: 'draft');
      await LocalDatabase.instance.syncQuestionsFromFirestore([draftedAgain]);
      expect(LocalDatabase.instance.getQuestionsByTopic('History'), isEmpty,
          reason: 'Unpublished draft question must disappear from Practice');

      // Phase D: Admin publishes again (retains PRACTICE usage)
      await LocalDatabase.instance.syncQuestionsFromFirestore([published]);
      expect(LocalDatabase.instance.getQuestionsByTopic('History').length, 1,
          reason: 'Re-published question should be visible without re-assignment');

      // Phase E: Admin archives question
      final archived = published.copyWith(status: 'archived');
      await LocalDatabase.instance.syncQuestionsFromFirestore([archived]);
      expect(LocalDatabase.instance.getQuestionsByTopic('History'), isEmpty,
          reason: 'Archived question must not appear in Practice');
    });
  });

  group('QA_PRACTICE_STATUS_TEST: Online Sync & Stale Cache Invalidation', () {
    test('6. syncTopicQuestionsFromFirestore removes cached questions when unpublished on server', () async {
      // 1. Device previously cached two published questions
      final q1 = const Question(
        id: 'cache_q1',
        subjectId: 'gk',
        topicId: 'Geography',
        examTags: ['ANCHSL'],
        questionEn: 'Barren Island volcano status?',
        questionHi: '',
        optionsEn: ['Active', 'Dormant', 'Extinct', 'None'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'published',
      );
      final q2 = const Question(
        id: 'cache_q2',
        subjectId: 'gk',
        topicId: 'Geography',
        examTags: ['ANCHSL'],
        questionEn: 'Saddle Peak height?',
        questionHi: '',
        optionsEn: ['732m', '500m', '1000m', '300m'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        usageType: 'PRACTICE',
        status: 'published',
      );

      await LocalDatabase.instance.syncQuestionsFromFirestore([q1, q2]);
      expect(LocalDatabase.instance.getQuestionsByTopic('Geography').length, 2);

      // 2. Admin unpublishes q2 on server (changes status to 'draft').
      // Next online sync fetches only active published questions: [q1]
      await LocalDatabase.instance.syncTopicQuestionsFromFirestore('Geography', [q1]);

      // 3. Verify q2 has been marked draft in local cache and is NO LONGER visible in Practice
      final updatedPractice = LocalDatabase.instance.getQuestionsByTopic('Geography');
      expect(updatedPractice.length, 1);
      expect(updatedPractice.first.id, 'cache_q1');

      // Verify q2 is still preserved in DB with draft status (not deleted, preserving history)
      final cachedQ2 = LocalDatabase.instance.getQuestionById('cache_q2');
      expect(cachedQ2, isNotNull);
      expect(cachedQ2!.isDraft, isTrue);
    });
  });

  group('QA_PRACTICE_STATUS_TEST: Mock Test Question Safety', () {
    test('7. Mock Test preserves section question IDs without exposing draft questions to runner', () {
      final mockTest = MockTest(
        id: 'mock_sample',
        title: 'Sample Mock Test',
        examCode: 'ANCHSL',
        durationMinutes: 60,
        totalQuestions: 2,
        totalMarks: 4.0,
        negativeMarks: 0.5,
        sections: [
          const TestSection(
            id: 'sec_1',
            name: 'General Awareness',
            hindiName: '',
            questionIds: ['mock_q_published', 'mock_q_draft'],
          ),
        ],
      );

      // Question 1: Published
      const qPub = Question(
        id: 'mock_q_published',
        subjectId: 'gk',
        topicId: 'General',
        examTags: ['ANCHSL'],
        questionEn: 'Published Mock Question',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        usageType: 'MOCK',
        status: 'published',
      );

      // Question 2: Draft
      const qDraft = Question(
        id: 'mock_q_draft',
        subjectId: 'gk',
        topicId: 'General',
        examTags: ['ANCHSL'],
        questionEn: 'Draft Mock Question',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: [],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
        usageType: 'MOCK',
        status: 'draft',
      );

      // Verify mockTest sections retain BOTH question IDs (relationships preserved)
      expect(mockTest.sections[0].questionIds, ['mock_q_published', 'mock_q_draft']);

      // Filter for active test session (what cbt_exam_screen.dart does)
      final sessionCache = <String, Question>{};
      for (final q in [qPub, qDraft]) {
        if (q.isPublished) {
          sessionCache[q.id] = q;
        }
      }

      final activeExamQIds = mockTest.sections[0].questionIds
          .where((id) => sessionCache.containsKey(id))
          .toList();

      expect(activeExamQIds, ['mock_q_published']);
      expect(activeExamQIds.contains('mock_q_draft'), isFalse,
          reason: 'Draft mock question must be excluded from active exam questions');
      expect(mockTest.sections[0].questionIds.length, 2,
          reason: 'MockTest section questionIds relationship must NOT be silently deleted');
    });
  });
}
