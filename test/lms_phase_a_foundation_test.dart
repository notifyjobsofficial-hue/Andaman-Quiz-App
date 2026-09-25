import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/core/database/local_database.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('LMS Phase A: Models Serialization & Defaults', () {
    test('FeatureFlags has safe defaults (existing core enabled, new disabled)', () {
      const flags = FeatureFlags();
      expect(flags.practiceEnabled, isTrue);
      expect(flags.mockEnabled, isTrue);
      expect(flags.liveTestEnabled, isTrue);
      expect(flags.reportingEnabled, isTrue);
      expect(flags.battleEnabled, isFalse);
      expect(flags.studyEnabled, isFalse);
      expect(flags.careerEnabled, isFalse);
      expect(flags.currentAffairsEnabled, isFalse);

      final map = flags.toMap();
      final fromMap = FeatureFlags.fromMap(map);
      expect(fromMap.practiceEnabled, isTrue);
      expect(fromMap.battleEnabled, isFalse);
    });

    test('RemoteAppConfig includes FeatureFlags and LMS extensions', () {
      const config = RemoteAppConfig(
        appName: 'Andaman Quiz LMS',
        defaultExamCode: 'AN POLICE',
        dailyQuestionGoalDefault: 30,
      );
      expect(config.appName, 'Andaman Quiz LMS');
      expect(config.defaultExamCode, 'AN POLICE');
      expect(config.dailyQuestionGoalDefault, 30);
      expect(config.featureFlags.practiceEnabled, isTrue);

      final map = config.toMap();
      final decoded = RemoteAppConfig.fromMap(map);
      expect(decoded.appName, 'Andaman Quiz LMS');
      expect(decoded.defaultExamCode, 'AN POLICE');
      expect(decoded.featureFlags.mockEnabled, isTrue);
    });

    test('TestSeries, Folders & Items serialize cleanly and enforce draft isolation', () {
      final now = DateTime.now();
      final series = TestSeries(
        id: 'series_01',
        title: 'Andaman CHSL Master Series',
        examCode: 'AN CHSL',
        description: 'Comprehensive test series',
        isFree: false,
        price: 199.0,
        offerPrice: 99.0,
        productId: 'andaman_chsl_series_99',
        status: 'published',
        createdAt: now,
        updatedAt: now,
      );
      expect(series.isPublished, isTrue);

      final draftSeries = TestSeries(
        id: 'series_draft',
        title: 'Draft Series',
        examCode: 'AN CHSL',
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      );
      expect(draftSeries.isPublished, isFalse);

      final map = series.toMap();
      final decoded = TestSeries.fromMap(map);
      expect(decoded.id, 'series_01');
      expect(decoded.title, 'Andaman CHSL Master Series');
      expect(decoded.price, 199.0);
      expect(decoded.offerPrice, 99.0);

      final folder = TestSeriesFolder(
        id: 'folder_01',
        seriesId: 'series_01',
        title: 'Full Length Mocks',
        itemCount: 5,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      );
      expect(folder.isPublished, isTrue);
      expect(TestSeriesFolder.fromMap(folder.toMap()).title, 'Full Length Mocks');

      final item = TestSeriesItem(
        id: 'item_01',
        seriesId: 'series_01',
        folderId: 'folder_01',
        testId: 'mock_1789905785741',
        sortOrder: 1,
        accessMode: 'SERIES_ONLY',
        status: 'published',
        createdAt: now,
        updatedAt: now,
      );
      expect(item.isPublished, isTrue);
      expect(TestSeriesItem.fromMap(item.toMap()).testId, 'mock_1789905785741');
    });

    test('StudyFolder and StudyMaterial serialization and draft checks', () {
      final now = DateTime.now();
      final folder = StudyFolder(
        id: 'folder_s1',
        examCode: 'AN MTS',
        title: 'Andaman GK & History Notes',
        itemCount: 12,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      );
      expect(folder.isPublished, isTrue);
      expect(StudyFolder.fromMap(folder.toMap()).title, 'Andaman GK & History Notes');

      final material = StudyMaterial(
        id: 'mat_01',
        folderId: 'folder_s1',
        examCode: 'AN MTS',
        title: 'Cellular Jail History PDF',
        description: 'Complete freedom struggle notes',
        materialType: 'PDF',
        fileUrl: 'https://cdn.example.com/cellular_jail.pdf',
        downloadAllowed: true,
        status: 'published',
        publishDate: now,
        createdAt: now,
        updatedAt: now,
      );
      expect(material.isPublished, isTrue);
      final matDecoded = StudyMaterial.fromMap(material.toMap());
      expect(matDecoded.id, 'mat_01');
      expect(matDecoded.materialType, 'PDF');
      expect(matDecoded.downloadAllowed, isTrue);
    });

    test('BattleItem and BattleRegistration (no client-written rank)', () {
      final now = DateTime.now();
      final battle = BattleItem(
        id: 'battle_01',
        title: 'Sunday Andaman Mega Battle',
        examCode: 'AN CGL',
        canonicalTestId: 'mock_cgl_01',
        startAt: now.add(const Duration(days: 1)),
        registrationDeadline: now.add(const Duration(hours: 20)),
        durationMinutes: 90,
        isFree: true,
        status: 'UPCOMING',
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      );
      expect(battle.isPublished, isTrue);
      final battleDecoded = BattleItem.fromMap(battle.toMap());
      expect(battleDecoded.id, 'battle_01');
      expect(battleDecoded.canonicalTestId, 'mock_cgl_01');

      final reg = BattleRegistration(
        id: 'reg_01',
        battleId: 'battle_01',
        testId: 'mock_cgl_01',
        studentName: 'Rahul Sharma',
        installationId: 'inst_test_uuid_123',
        registeredAt: now,
        status: 'REGISTERED',
      );
      final regDecoded = BattleRegistration.fromMap(reg.toMap());
      expect(regDecoded.studentName, 'Rahul Sharma');
      expect(regDecoded.status, 'REGISTERED');
      // Verify no rank field exists in client registration model
      expect(reg.toMap().containsKey('rank'), isFalse);
    });

    test('QuestionReport model serialization', () {
      final now = DateTime.now();
      final report = QuestionReport(
        id: 'rep_01',
        questionId: 'q_andaman_01',
        testId: 'mock_01',
        issueType: 'WRONG_ANSWER',
        details: 'Option B is given as correct, but official key is Option C.',
        installationId: 'inst_test_uuid_123',
        status: 'OPEN',
        createdAt: now,
      );
      final decoded = QuestionReport.fromMap(report.toMap());
      expect(decoded.questionId, 'q_andaman_01');
      expect(decoded.issueType, 'WRONG_ANSWER');
      expect(decoded.status, 'OPEN');
    });

    test('CareerGoal roadmap model serialization', () {
      final now = DateTime.now();
      final goal = CareerGoal(
        id: 'goal_mts',
        examCode: 'AN MTS',
        title: 'Multi-Tasking Staff (MTS)',
        department: 'Secretariat, Port Blair',
        overview: 'Direct recruitment for MTS posts.',
        eligibilityAge: '18-33 years',
        eligibilityQualification: '10th Pass from recognized board',
        selectionStages: const [
          CareerSelectionStage(stageNumber: 1, title: 'Written Exam', description: 'Objective CBT 100 marks'),
          CareerSelectionStage(stageNumber: 2, title: 'Document Verification', description: 'At Port Blair office'),
        ],
        examPattern: const CareerExamPattern(
          totalMarks: 100,
          durationMinutes: 120,
          negativeMarking: '0.25',
          sections: [
            CareerExamPatternSection(name: 'General Awareness', questions: 25, marks: 25),
            CareerExamPatternSection(name: 'Reasoning', questions: 25, marks: 25),
            CareerExamPatternSection(name: 'Mathematics', questions: 25, marks: 25),
            CareerExamPatternSection(name: 'English', questions: 25, marks: 25),
          ],
        ),
        syllabusSummary: 'General Knowledge with focus on Andaman & Nicobar geography and history.',
        status: 'published',
        updatedAt: now,
      );
      final decoded = CareerGoal.fromMap(goal.toMap());
      expect(decoded.id, 'goal_mts');
      expect(decoded.selectionStages.length, 2);
      expect(decoded.examPattern.sections.length, 4);
    });

    test('CurrentAffairsItem serialization', () {
      final now = DateTime.now();
      final item = CurrentAffairsItem(
        id: 'ca_2026_09_25_01',
        title: 'New Eco-Tourism Guidelines for Great Nicobar',
        date: '2026-09-25',
        category: 'Andaman',
        summary: 'Administration announces updated sustainable tourism policy.',
        content: 'Detailed report on eco-tourism norms in the island territory...',
        canonicalQuestionIds: const ['q_ca_01', 'q_ca_02'],
        status: 'published',
        publishDate: now,
        createdAt: now,
        updatedAt: now,
      );
      final decoded = CurrentAffairsItem.fromMap(item.toMap());
      expect(decoded.id, 'ca_2026_09_25_01');
      expect(decoded.category, 'Andaman');
      expect(decoded.canonicalQuestionIds, contains('q_ca_01'));
    });

    test('HomeSectionConfig default ordering and enable flags', () {
      final sections = LocalDatabase.getDefaultHomeSections();
      expect(sections.isNotEmpty, isTrue);
      expect(sections.first.sectionType, 'qotd');
      expect(sections.any((s) => s.sectionType == 'practice' && s.enabled), isTrue);
      expect(sections.any((s) => s.sectionType == 'test_series' && s.enabled), isTrue);
      // Battles default to disabled until Phase 2
      final battleSection = sections.firstWhere((s) => s.sectionType == 'battles');
      expect(battleSection.enabled, isFalse);
    });
  });

  group('LMS Phase A: LocalDatabase v5 Migration & 100% User Data Preservation', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({
        'local_db_version': 4,
        'client_installation_uuid': 'inst_legacy_student_99999',
        'db_student_attempts': jsonEncode([
          {
            'id': 'att_01',
            'testId': 'mock_test_1',
            'testTitle': 'AN MTS 01',
            'score': 74.5,
            'maxScore': 100.0,
            'completedAt': DateTime.now().toIso8601String(),
            'answers': {'q1': 1, 'q2': 2},
          }
        ]),
        'saved_bookmarks': ['q_andaman_01', 'q_andaman_02'],
        'saved_wrong_questions': ['q_andaman_03'],
        'saved_purchased_products': ['test_series_chsl_2026', 'mock_paid_01'],
        'db_practice_sessions': jsonEncode({
          'topic_history_01': {
            'topicId': 'topic_history_01',
            'topicName': 'History of Andaman',
            'subjectId': 'sub_gk',
            'subjectName': 'General Knowledge',
            'examCode': 'AN CHSL',
            'lastQuestionIndex': 14,
            'attemptedQuestionIds': ['q1', 'q2', 'q3'],
            'correctCount': 2,
            'totalQuestions': 50,
            'updatedAt': DateTime.now().toIso8601String(),
          }
        }),
        'db_topic_session_counts': jsonEncode({
          'topic_history_01': 42,
        }),
        'db_live_test_registrations': jsonEncode({
          'live_01': {
            'id': 'reg_live_01',
            'liveTestId': 'live_01',
            'testId': 'mock_01',
            'studentName': 'Anita Roy',
            'installationId': 'inst_legacy_student_99999',
            'registeredAt': DateTime.now().toIso8601String(),
            'status': 'REGISTERED',
          }
        }),
      });
      await LocalDatabase.instance.resetForTesting();
    });

    test('Migrates from v4 to v5 without wiping any student data', () async {
      await LocalDatabase.instance.init(force: true);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getInt('local_db_version'), 5);

      // Verify 100% of user data is preserved
      expect(LocalDatabase.instance.getAttempts().length, 1);
      expect(LocalDatabase.instance.getAttempts().first.testTitle, 'AN MTS 01');

      expect(LocalDatabase.instance.isBookmarked('q_andaman_01'), isTrue);
      expect(LocalDatabase.instance.isBookmarked('q_andaman_02'), isTrue);
      expect(LocalDatabase.instance.isWrongQuestion('q_andaman_03'), isTrue);

      expect(LocalDatabase.instance.getPurchasedProductIds(), contains('test_series_chsl_2026'));
      expect(LocalDatabase.instance.getPurchasedProductIds(), contains('mock_paid_01'));

      final practiceSession = LocalDatabase.instance.getPracticeSession('topic_history_01');
      expect(practiceSession, isNotNull);
      expect(practiceSession!.topicName, 'History of Andaman');
      expect(practiceSession.lastQuestionIndex, 14);

      expect(LocalDatabase.instance.getTopicSessionCount('topic_history_01'), 42);

      expect(LocalDatabase.instance.installationId, 'inst_legacy_student_99999');

      final liveReg = LocalDatabase.instance.getLiveTestRegistration('live_01');
      expect(liveReg, isNotNull);
      expect(liveReg!.studentName, 'Anita Roy');

      // Verify dynamic home sections defaulted safely
      final homeSections = LocalDatabase.instance.getHomeSections();
      expect(homeSections.isNotEmpty, isTrue);
      expect(homeSections.any((s) => s.sectionType == 'test_series'), isTrue);
    });

    test('LocalDatabase TestSeries and StudyLibrary cache operations and draft isolation', () async {
      await LocalDatabase.instance.init(force: true);
      final now = DateTime.now();

      final seriesList = [
        TestSeries(
          id: 'ts_pub',
          title: 'Published Series',
          examCode: 'AN CGL',
          status: 'published',
          createdAt: now,
          updatedAt: now,
        ),
        TestSeries(
          id: 'ts_draft',
          title: 'Draft Series',
          examCode: 'AN CGL',
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        ),
      ];

      await LocalDatabase.instance.saveTestSeriesList(seriesList);

      // Student view: only published
      final studentSeries = LocalDatabase.instance.getTestSeries(examCode: 'AN CGL', publishedOnly: true);
      expect(studentSeries.length, 1);
      expect(studentSeries.first.id, 'ts_pub');

      // Unfiltered view
      final allSeries = LocalDatabase.instance.getTestSeries(examCode: 'AN CGL', publishedOnly: false);
      expect(allSeries.length, 2);

      // Entitlement check
      expect(LocalDatabase.instance.hasEntitlement('test_series_chsl_2026'), isTrue);
      expect(LocalDatabase.instance.hasEntitlement('non_existent_item'), isFalse);

      await LocalDatabase.instance.recordEntitlement(EntitlementItem(
        id: 'new_unlocked_series',
        entitlementType: 'SERIES',
        isVerifiedOnServer: true,
        unlockedAt: now,
      ));
      expect(LocalDatabase.instance.hasEntitlement('new_unlocked_series'), isTrue);
    });
  });
}
