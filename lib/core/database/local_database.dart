import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

class LocalDatabase {
  static final LocalDatabase instance = LocalDatabase._internal();
  LocalDatabase._internal();

  SharedPreferences? _prefs;

  final StreamController<List<Question>> _questionsStreamController =
      StreamController<List<Question>>.broadcast();
  Stream<List<Question>> get questionsStream => _questionsStreamController.stream;

  // In-memory indexed caches for instant 60 FPS reads
  final List<ExamCategory> _categories = [];
  final List<Exam> _exams = [];
  final List<Subject> _subjects = [];
  final List<Topic> _topics = [];
  final List<Question> _questions = [];
  final List<MockTest> _mockTests = [];
  final List<StudentAttempt> _attempts = [];
  final Set<String> _bookmarkedIds = {};
  final Set<String> _wrongQuestionIds = {};
  final Set<String> _purchasedProductIds = {};
  final List<HomeBanner> _banners = [];
  final List<AppNotice> _notices = [];
  final List<LiveTestItem> _liveTests = [];
  final Map<String, LiveTestRegistration> _liveTestRegistrations = {};
  final Map<String, QuestionOfTheDay> _cachedQotdByDate = {};
  final Map<String, TopicPracticeSession> _practiceSessions = {};
  final Map<String, int> _topicSessionCounts = {};
  final Set<String> _syncedSessionIds = {};
  final List<Map<String, dynamic>> _pendingPracticeSessions = [];
  String? _installationId;
  RemoteAppConfig _remoteConfig = const RemoteAppConfig();

  // LMS Phase A in-memory caches
  final List<TestSeries> _testSeries = [];
  final List<TestSeriesFolder> _testSeriesFolders = [];
  final List<TestSeriesItem> _testSeriesItems = [];
  final List<StudyFolder> _studyFolders = [];
  final List<StudyMaterial> _studyMaterials = [];
  final List<BattleItem> _battles = [];
  final Map<String, BattleRegistration> _battleRegistrations = {};
  final List<CareerGoal> _careerGoals = [];
  final List<CurrentAffairsItem> _currentAffairs = [];
  final List<HomeSectionConfig> _homeSections = [];
  final List<EntitlementItem> _entitlements = [];

  bool _isInitialized = false;

  // Increment when the cache schema changes to force a migration on existing devices
  static const int _kCurrentDbVersion = 5;

  Future<void> init({bool force = false}) async {
    if (_isInitialized && !force) return;
    _prefs = await SharedPreferences.getInstance();

    await _runMigrationIfNeeded();
    await _loadCachedData();
    _isInitialized = true;
  }

  @visibleForTesting
  Future<void> resetForTesting() async {
    _isInitialized = false;
    _prefs = null;
    _bookmarkedIds.clear();
    _wrongQuestionIds.clear();
    _purchasedProductIds.clear();
    _banners.clear();
    _notices.clear();
    _liveTests.clear();
    _liveTestRegistrations.clear();
    _cachedQotdByDate.clear();
    _practiceSessions.clear();
    _topicSessionCounts.clear();
    _syncedSessionIds.clear();
    _pendingPracticeSessions.clear();
    _installationId = null;
    _questions.clear();
    _categories.clear();
    _exams.clear();
    _subjects.clear();
    _topics.clear();
    _mockTests.clear();
    _attempts.clear();
    _testSeries.clear();
    _testSeriesFolders.clear();
    _testSeriesItems.clear();
    _studyFolders.clear();
    _studyMaterials.clear();
    _battles.clear();
    _battleRegistrations.clear();
    _careerGoals.clear();
    _currentAffairs.clear();
    _homeSections.clear();
    _entitlements.clear();
    _questionsStreamController.add([]);
  }

  /// One-time migration: purges legacy seeded/dev content for pre-v4 while preserving
  /// 100% genuine student data (attempts, bookmarks, wrong questions, purchases, practice sessions, registrations).
  Future<void> _runMigrationIfNeeded() async {
    final prefs = _prefs!;
    final savedVersion = prefs.getInt('local_db_version') ?? 0;
    if (savedVersion >= _kCurrentDbVersion) return;

    debugPrint('LocalDatabase: migrating from v$savedVersion → v$_kCurrentDbVersion');

    if (savedVersion < 4) {
      // Purge all legacy seeded/cached content keys (Firestore is now the source of truth)
      await prefs.remove('db_questions');
      await prefs.remove('db_categories');
      await prefs.remove('db_exams');
      await prefs.remove('db_subjects');
      await prefs.remove('db_topics');
      await prefs.remove('db_mock_tests');
      await prefs.remove('db_banners');
      await prefs.remove('db_notices');
      await prefs.remove('db_app_config');

      // Purge legacy hardcoded accumulator keys entirely (seeded with 328/7 in old builds)
      // Real metrics are derived dynamically from genuine attempt and practice history.
      await prefs.remove('user_total_questions');
      await prefs.remove('user_streak_days');
      await prefs.remove('user_last_active_date');
    }

    if (savedVersion < 5) {
      // v5 migration: LMS Phase A architecture integration.
      // ZERO DATABASE WIPE: All student attempts, bookmarks, wrong questions, purchases,
      // practice sessions, installation UUID, and settings are 100% preserved.
      debugPrint('LocalDatabase: applying v5 LMS schema migration with 100% student data preservation.');
    }

    await prefs.setInt('local_db_version', _kCurrentDbVersion);
    debugPrint('LocalDatabase: migration to v$_kCurrentDbVersion complete.');
  }

  Future<void> _loadCachedData() async {
    final prefs = _prefs!;

    // 1. Bookmarks
    final bookmarksJson = prefs.getStringList('saved_bookmarks') ?? [];
    _bookmarkedIds.addAll(bookmarksJson);

    // 2. Wrong Questions
    final wrongJson = prefs.getStringList('saved_wrong_questions') ?? [];
    _wrongQuestionIds.addAll(wrongJson);

    // 2.5 Purchased Products / Unlocked Mock Tests
    final purchased = prefs.getStringList('saved_purchased_products') ?? [];
    _purchasedProductIds.addAll(purchased);

    // 2.6 Banners & Notices
    final bannersRaw = prefs.getString('db_banners');
    if (bannersRaw != null && bannersRaw.isNotEmpty) {
      try {
        final list = jsonDecode(bannersRaw) as List;
        _banners.clear();
        for (final item in list) {
          _banners.add(HomeBanner.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {}
    }

    final noticesRaw = prefs.getString('db_notices');
    if (noticesRaw != null && noticesRaw.isNotEmpty) {
      try {
        final list = jsonDecode(noticesRaw) as List;
        _notices.clear();
        for (final item in list) {
          _notices.add(AppNotice.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {}
    }

    final liveTestsRaw = prefs.getString('db_live_tests');
    if (liveTestsRaw != null && liveTestsRaw.isNotEmpty) {
      try {
        final list = jsonDecode(liveTestsRaw) as List;
        _liveTests.clear();
        for (final item in list) {
          _liveTests.add(LiveTestItem.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {}
    }

    final configRaw = prefs.getString('db_app_config');
    if (configRaw != null && configRaw.isNotEmpty) {
      try {
        _remoteConfig = RemoteAppConfig.fromMap(Map<String, dynamic>.from(jsonDecode(configRaw)));
      } catch (_) {}
    }

    // 3. Questions
    final questionsRaw = prefs.getString('db_questions');
    if (questionsRaw != null && questionsRaw.isNotEmpty) {
      try {
        final list = jsonDecode(questionsRaw) as List;
        _questions.clear();
        for (final item in list) {
          final q = Question.fromMap(Map<String, dynamic>.from(item));
          _questions.add(q.copyWith(isBookmarked: _bookmarkedIds.contains(q.id)));
        }
      } catch (e) {
        debugPrint('Error decoding questions from local cache: $e');
        _questions.clear();
      }
    } else {
      _questions.clear();
    }

    // 3.5 Categories
    final catRaw = prefs.getString('db_categories');
    if (catRaw != null && catRaw.isNotEmpty) {
      try {
        final list = jsonDecode(catRaw) as List;
        _categories.clear();
        for (final item in list) {
          _categories.add(ExamCategory.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _categories.clear();
      }
    } else {
      _categories.clear();
    }

    // 4. Exams
    final examsRaw = prefs.getString('db_exams');
    if (examsRaw != null && examsRaw.isNotEmpty) {
      try {
        final list = jsonDecode(examsRaw) as List;
        _exams.clear();
        for (final item in list) {
          _exams.add(Exam.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _exams.clear();
      }
    } else {
      _exams.clear();
    }

    // 5. Subjects
    final subjectsRaw = prefs.getString('db_subjects');
    if (subjectsRaw != null && subjectsRaw.isNotEmpty) {
      try {
        final list = jsonDecode(subjectsRaw) as List;
        _subjects.clear();
        for (final item in list) {
          _subjects.add(Subject.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _subjects.clear();
      }
    } else {
      _subjects.clear();
    }

    // 6. Topics
    final topicsRaw = prefs.getString('db_topics');
    if (topicsRaw != null && topicsRaw.isNotEmpty) {
      try {
        final list = jsonDecode(topicsRaw) as List;
        _topics.clear();
        for (final item in list) {
          _topics.add(Topic.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _topics.clear();
      }
    } else {
      _topics.clear();
    }

    // 7. Mock Tests
    final mocksRaw = prefs.getString('db_mock_tests');
    if (mocksRaw != null && mocksRaw.isNotEmpty) {
      try {
        final list = jsonDecode(mocksRaw) as List;
        _mockTests.clear();
        for (final item in list) {
          final m = MockTest.fromMap(Map<String, dynamic>.from(item));
          // Canonical status rule: DRAFT mocks must NEVER be visible to students
          if (m.status.toLowerCase() == 'published') {
            _mockTests.add(m);
          }
        }
      } catch (e) {
        _mockTests.clear();
      }
    } else {
      _mockTests.clear();
    }

    // Reconcile loaded Live Tests: A Live Test is valid ONLY if its linked Mock exists and is published
    _liveTests.removeWhere((t) => !t.isPublished || !_mockTests.any((m) => m.id == t.testId));

    // 7.5 Live Test Registrations
    final registrationsRaw = prefs.getString('db_live_test_registrations');
    if (registrationsRaw != null && registrationsRaw.isNotEmpty) {
      try {
        final map = jsonDecode(registrationsRaw) as Map<String, dynamic>;
        _liveTestRegistrations.clear();
        for (final entry in map.entries) {
          _liveTestRegistrations[entry.key] = LiveTestRegistration.fromMap(Map<String, dynamic>.from(entry.value));
        }
      } catch (_) {
        _liveTestRegistrations.clear();
      }
    } else {
      _liveTestRegistrations.clear();
    }

    // 8. Attempts
    final attemptsRaw = prefs.getString('db_student_attempts');
    if (attemptsRaw != null && attemptsRaw.isNotEmpty) {
      try {
        final list = jsonDecode(attemptsRaw) as List;
        _attempts.clear();
        for (final item in list) {
          _attempts.add(StudentAttempt.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (e) {
        debugPrint('Error decoding attempts: $e');
        _attempts.clear();
      }
    } else {
      _attempts.clear();
    }

    // 9. Practice Sessions
    final sessionsRaw = prefs.getString('db_practice_sessions');
    if (sessionsRaw != null && sessionsRaw.isNotEmpty) {
      try {
        final map = jsonDecode(sessionsRaw) as Map<String, dynamic>;
        _practiceSessions.clear();
        for (final entry in map.entries) {
          _practiceSessions[entry.key] = TopicPracticeSession.fromMap(Map<String, dynamic>.from(entry.value));
        }
      } catch (e) {
        debugPrint('Error decoding practice sessions: $e');
        _practiceSessions.clear();
      }
    } else {
      _practiceSessions.clear();
    }

    // 10. Anonymous Installation UUID (No hardware / IMEI / ad tracking)
    _installationId = prefs.getString('client_installation_uuid');
    if (_installationId == null || _installationId!.isEmpty) {
      _installationId = 'inst_${DateTime.now().millisecondsSinceEpoch}_${(1000 + (DateTime.now().microsecondsSinceEpoch % 9000))}';
      await prefs.setString('client_installation_uuid', _installationId!);
    }

    // 11. Cached Global Practice Topic Session Counts
    final countsRaw = prefs.getString('db_topic_session_counts');
    if (countsRaw != null && countsRaw.isNotEmpty) {
      try {
        final map = jsonDecode(countsRaw) as Map<String, dynamic>;
        _topicSessionCounts.clear();
        for (final entry in map.entries) {
          _topicSessionCounts[entry.key] = (entry.value as num).toInt();
        }
      } catch (_) {
        _topicSessionCounts.clear();
      }
    } else {
      _topicSessionCounts.clear();
    }

    // 12. Synced & Pending Practice Sessions
    final syncedList = prefs.getStringList('synced_practice_session_ids') ?? [];
    _syncedSessionIds.clear();
    _syncedSessionIds.addAll(syncedList);

    final pendingRaw = prefs.getString('pending_practice_sessions');
    if (pendingRaw != null && pendingRaw.isNotEmpty) {
      try {
        final list = jsonDecode(pendingRaw) as List;
        _pendingPracticeSessions.clear();
        for (final item in list) {
          _pendingPracticeSessions.add(Map<String, dynamic>.from(item));
        }
      } catch (_) {
        _pendingPracticeSessions.clear();
      }
    } else {
      _pendingPracticeSessions.clear();
    }

    // 13. LMS Phase A: Test Series
    final testSeriesRaw = prefs.getString('db_test_series');
    if (testSeriesRaw != null && testSeriesRaw.isNotEmpty) {
      try {
        final list = jsonDecode(testSeriesRaw) as List;
        _testSeries.clear();
        for (final item in list) {
          _testSeries.add(TestSeries.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _testSeries.clear();
      }
    } else {
      _testSeries.clear();
    }

    final testFoldersRaw = prefs.getString('db_test_series_folders');
    if (testFoldersRaw != null && testFoldersRaw.isNotEmpty) {
      try {
        final list = jsonDecode(testFoldersRaw) as List;
        _testSeriesFolders.clear();
        for (final item in list) {
          _testSeriesFolders.add(TestSeriesFolder.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _testSeriesFolders.clear();
      }
    } else {
      _testSeriesFolders.clear();
    }

    final testItemsRaw = prefs.getString('db_test_series_items');
    if (testItemsRaw != null && testItemsRaw.isNotEmpty) {
      try {
        final list = jsonDecode(testItemsRaw) as List;
        _testSeriesItems.clear();
        for (final item in list) {
          _testSeriesItems.add(TestSeriesItem.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _testSeriesItems.clear();
      }
    } else {
      _testSeriesItems.clear();
    }

    // 14. Study Library
    final studyFoldersRaw = prefs.getString('db_study_folders');
    if (studyFoldersRaw != null && studyFoldersRaw.isNotEmpty) {
      try {
        final list = jsonDecode(studyFoldersRaw) as List;
        _studyFolders.clear();
        for (final item in list) {
          _studyFolders.add(StudyFolder.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _studyFolders.clear();
      }
    } else {
      _studyFolders.clear();
    }

    final studyMaterialsRaw = prefs.getString('db_study_materials');
    if (studyMaterialsRaw != null && studyMaterialsRaw.isNotEmpty) {
      try {
        final list = jsonDecode(studyMaterialsRaw) as List;
        _studyMaterials.clear();
        for (final item in list) {
          _studyMaterials.add(StudyMaterial.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _studyMaterials.clear();
      }
    } else {
      _studyMaterials.clear();
    }

    // 15. Battles & Registrations
    final battlesRaw = prefs.getString('db_battles');
    if (battlesRaw != null && battlesRaw.isNotEmpty) {
      try {
        final list = jsonDecode(battlesRaw) as List;
        _battles.clear();
        for (final item in list) {
          _battles.add(BattleItem.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _battles.clear();
      }
    } else {
      _battles.clear();
    }

    final battleRegsRaw = prefs.getString('db_battle_registrations');
    if (battleRegsRaw != null && battleRegsRaw.isNotEmpty) {
      try {
        final map = jsonDecode(battleRegsRaw) as Map<String, dynamic>;
        _battleRegistrations.clear();
        for (final entry in map.entries) {
          _battleRegistrations[entry.key] = BattleRegistration.fromMap(Map<String, dynamic>.from(entry.value));
        }
      } catch (_) {
        _battleRegistrations.clear();
      }
    } else {
      _battleRegistrations.clear();
    }

    // 16. Career Goals
    final careerRaw = prefs.getString('db_career_goals');
    if (careerRaw != null && careerRaw.isNotEmpty) {
      try {
        final list = jsonDecode(careerRaw) as List;
        _careerGoals.clear();
        for (final item in list) {
          _careerGoals.add(CareerGoal.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _careerGoals.clear();
      }
    } else {
      _careerGoals.clear();
    }

    // 17. Current Affairs
    final currentAffairsRaw = prefs.getString('db_current_affairs');
    if (currentAffairsRaw != null && currentAffairsRaw.isNotEmpty) {
      try {
        final list = jsonDecode(currentAffairsRaw) as List;
        _currentAffairs.clear();
        for (final item in list) {
          _currentAffairs.add(CurrentAffairsItem.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _currentAffairs.clear();
      }
    } else {
      _currentAffairs.clear();
    }

    // 18. Dynamic Home Sections
    final homeSectionsRaw = prefs.getString('db_home_sections');
    if (homeSectionsRaw != null && homeSectionsRaw.isNotEmpty) {
      try {
        final list = jsonDecode(homeSectionsRaw) as List;
        _homeSections.clear();
        for (final item in list) {
          _homeSections.add(HomeSectionConfig.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _homeSections.clear();
      }
    } else {
      _homeSections.clear();
      _homeSections.addAll(getDefaultHomeSections());
    }

    // 19. Verified Entitlements
    final entitlementsRaw = prefs.getString('saved_entitlements');
    if (entitlementsRaw != null && entitlementsRaw.isNotEmpty) {
      try {
        final list = jsonDecode(entitlementsRaw) as List;
        _entitlements.clear();
        for (final item in list) {
          _entitlements.add(EntitlementItem.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (_) {
        _entitlements.clear();
      }
    } else {
      _entitlements.clear();
    }
  }

  Future<void> _persistQuestions() async {
    final raw = jsonEncode(_questions.map((q) => q.toMap()).toList());
    await _prefs?.setString('db_questions', raw);
    _questionsStreamController.add(List.unmodifiable(_questions));
  }

  Future<void> _persistMockTests() async {
    final raw = jsonEncode(_mockTests.map((m) => m.toMap()).toList());
    await _prefs?.setString('db_mock_tests', raw);
  }

  Future<void> _persistAttempts() async {
    final raw = jsonEncode(_attempts.map((a) => a.toMap()).toList());
    await _prefs?.setString('db_student_attempts', raw);
  }

  Future<void> _persistPracticeSessions() async {
    final map = <String, dynamic>{};
    for (final entry in _practiceSessions.entries) {
      map[entry.key] = entry.value.toMap();
    }
    await _prefs?.setString('db_practice_sessions', jsonEncode(map));
  }

  // --- Exams ---
  List<Exam> getExams() => List.unmodifiable(_exams);
  Exam? getExamByCode(String code) {
    try {
      return _exams.firstWhere((e) => e.code.toUpperCase() == code.toUpperCase());
    } catch (_) {
      return _exams.isNotEmpty ? _exams.first : null;
    }
  }

  // --- Subjects ---
  List<Subject> getSubjects({String? examCode}) {
    if (examCode == null || examCode == 'ALL') {
      return List.unmodifiable(_subjects);
    }
    return _subjects.where((s) => s.matchesExam(examCode)).toList();
  }

  Subject? getSubjectById(String id) {
    try {
      return _subjects.firstWhere((s) => s.id == id);
    } catch (_) {
      return null;
    }
  }

  // --- Topics ---
  List<Topic> getTopics() => List.unmodifiable(_topics);

  List<Topic> getTopicsBySubject(String subjectId) {
    return _topics.where((t) => t.subjectId == subjectId).toList();
  }

  Topic? getTopicById(String id) {
    try {
      final normalized = id.trim().toLowerCase();
      return _topics.firstWhere((t) => t.id == id || t.name.toLowerCase() == normalized);
    } catch (_) {
      return null;
    }
  }

  // --- Questions ---
  List<Question> getAllQuestions() => List.unmodifiable(_questions);
  List<Question> getQuestions() => getAllQuestions();

  Question? getQuestionById(String id) {
    try {
      return _questions.firstWhere((q) => q.id == id);
    } catch (_) {
      return null;
    }
  }

  List<Question> getQuestionsByTopic(String topicId, {String? examCode}) {
    final topic = getTopicById(topicId);
    return _questions.where((q) => q.isPracticeEligible(
      topicId: topicId,
      topicContext: topic,
      examCode: examCode,
    )).toList();
  }

  List<Question> getQuestionsBySubject(String subjectId, {String? examCode}) {
    final subject = getSubjectById(subjectId);
    return _questions.where((q) => q.isPracticeEligible(
      subjectId: subjectId,
      subjectContext: subject,
      examCode: examCode,
    )).toList();
  }

  /// Number of unique eligible Practice question IDs belonging to that Subject under the selected Exam.
  int getSubjectPracticeQuestionCount(String subjectId, {String? examCode}) {
    final questions = getQuestionsBySubject(subjectId, examCode: examCode);
    final uniqueIds = questions.map((q) => q.id).toSet();
    return uniqueIds.length;
  }

  /// Number of unique eligible Practice question IDs belonging to that Topic under the selected Exam.
  int getTopicPracticeQuestionCount(String topicId, {String? examCode}) {
    final questions = getQuestionsByTopic(topicId, examCode: examCode);
    final uniqueIds = questions.map((q) => q.id).toSet();
    return uniqueIds.length;
  }

  /// Returns the available Practice subjects with strictly eligible questions for the specified exam.
  /// This is the SINGLE SOURCE OF TRUTH for both HomeScreen and PracticeScreen.
  List<PracticeSubjectItem> getAvailablePracticeSubjectsForExam(
    String examCode, {
    List<Subject>? subjectsContext,
  }) {
    final allSubjects = subjectsContext ?? getSubjects();
    final matchingSubjects = examCode.toUpperCase() == 'ALL'
        ? allSubjects
        : allSubjects.where((s) => s.matchesExam(examCode)).toList();

    final result = <PracticeSubjectItem>[];
    for (final subject in matchingSubjects) {
      final count = getSubjectPracticeQuestionCount(subject.id, examCode: examCode);
      if (count > 0) {
        result.add(PracticeSubjectItem(
          subject: subject,
          eligibleQuestionCount: count,
        ));
      }
    }
    return List.unmodifiable(result);
  }

  List<Question> getQuestionsByIds(List<String> ids) {
    final set = ids.toSet();
    return _questions.where((q) => set.contains(q.id)).toList();
  }

  // Question Bookmark & Wrong
  Future<bool> toggleBookmark(String questionId) async {
    final index = _questions.indexWhere((q) => q.id == questionId);
    bool newState = false;
    if (_bookmarkedIds.contains(questionId)) {
      _bookmarkedIds.remove(questionId);
      newState = false;
    } else {
      _bookmarkedIds.add(questionId);
      newState = true;
    }

    if (index != -1) {
      _questions[index] = _questions[index].copyWith(isBookmarked: newState);
    }

    await _prefs?.setStringList('saved_bookmarks', _bookmarkedIds.toList());
    return newState;
  }

  bool isBookmarked(String questionId) => _bookmarkedIds.contains(questionId);
  bool isWrongQuestion(String questionId) => _wrongQuestionIds.contains(questionId);

  List<Question> getBookmarkedQuestions() {
    return _questions.where((q) => _bookmarkedIds.contains(q.id)).toList();
  }

  Future<void> recordWrongQuestion(String questionId) async {
    if (!_wrongQuestionIds.contains(questionId)) {
      _wrongQuestionIds.add(questionId);
      await _prefs?.setStringList('saved_wrong_questions', _wrongQuestionIds.toList());
    }
  }

  List<Question> getWrongQuestions() {
    return _questions.where((q) => _wrongQuestionIds.contains(q.id)).toList();
  }

  // --- Mock Tests ---
  List<MockTest> getMockTests({String? examCode, String? filter}) {
    var list = _mockTests.where((m) => m.status.toLowerCase() == 'published').toList();
    if (examCode != null && examCode != 'ALL') {
      list = list.where((m) => m.examCode.toUpperCase() == examCode.toUpperCase()).toList();
    }
    if (filter == 'Free') {
      list = list.where((m) => m.isFree).toList();
    } else if (filter == 'Live') {
      list = list.where((m) => m.isLive).toList();
    } else if (filter == 'Previous Year') {
      list = list.where((m) => m.isPreviousYear).toList();
    }
    return List.unmodifiable(list);
  }

  MockTest? getMockTestById(String id) {
    try {
      final m = _mockTests.firstWhere((item) => item.id == id);
      if (m.status.toLowerCase() != 'published') return null;
      return m;
    } catch (_) {
      return null;
    }
  }

  // --- Student Test Attempts & Stats ---
  List<StudentAttempt> getAttempts() => List.unmodifiable(_attempts.reversed);

  StudentAttempt? getAttemptById(String id) {
    try {
      return _attempts.firstWhere((a) => a.id == id);
    } catch (_) {
      return null;
    }
  }

  Future<void> recordAttempt(StudentAttempt attempt) async {
    _attempts.add(attempt);
    await _persistAttempts();
  }

  /// Records an individual question answered in practice mode (outside mock tests)
  Future<void> recordPracticeAnswer({
    required bool isCorrect,
    String? topicId,
    String? questionId,
    int? selectedOptionIndex,
    String? examCode,
    int? totalQuestions,
    int? currentQuestionIndex,
  }) async {
    final now = DateTime.now();
    final todayStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final practiceDates = _prefs?.getStringList('user_practice_dates') ?? [];
    if (!practiceDates.contains(todayStr)) {
      practiceDates.add(todayStr);
      await _prefs?.setStringList('user_practice_dates', practiceDates);
    }
    final count = (_prefs?.getInt('user_practice_questions_count') ?? 0) + 1;
    await _prefs?.setInt('user_practice_questions_count', count);
    if (isCorrect) {
      final correctCount = (_prefs?.getInt('user_practice_correct_count') ?? 0) + 1;
      await _prefs?.setInt('user_practice_correct_count', correctCount);
    }

    // Per-topic practice progress & accuracy tracking
    if (topicId != null && topicId.trim().isNotEmpty) {
      final tid = topicId.trim();
      List<String> attemptedList = [];
      if (questionId != null && questionId.trim().isNotEmpty) {
        final qid = questionId.trim();
        final attemptedKey = 'user_topic_${tid}_attempted_qids';
        attemptedList = _prefs?.getStringList(attemptedKey) ?? [];
        if (!attemptedList.contains(qid)) {
          attemptedList.add(qid);
          await _prefs?.setStringList(attemptedKey, attemptedList);
        }
        if (selectedOptionIndex != null) {
          await saveTopicAnswer(topicId: tid, questionId: qid, selectedIndex: selectedOptionIndex);
        }
      } else {
        final attemptsKey = 'user_topic_${tid}_attempts_count';
        final prevAttempts = _prefs?.getInt(attemptsKey) ?? 0;
        await _prefs?.setInt(attemptsKey, prevAttempts + 1);
      }

      int newCorrectCount = _prefs?.getInt('user_topic_${tid}_correct_count') ?? 0;
      if (isCorrect) {
        final correctKey = 'user_topic_${tid}_correct_count';
        newCorrectCount++;
        await _prefs?.setInt(correctKey, newCorrectCount);
      }

      // Update or create TopicPracticeSession
      final topic = getTopicById(tid);
      final subject = topic != null ? getSubjectById(topic.subjectId) : null;
      final effectiveTotal = (totalQuestions != null && totalQuestions > 0)
          ? totalQuestions
          : (getQuestionsByTopic(tid).isNotEmpty
              ? getQuestionsByTopic(tid).length
              : (topic?.questionCount ?? 0));

      final existingSession = _practiceSessions[tid];
      final sessionExamCode = (examCode != null && examCode.isNotEmpty && examCode.toUpperCase() != 'ALL')
          ? examCode
          : (existingSession?.examCode.isNotEmpty == true
              ? existingSession!.examCode
              : (subject?.examCodes.firstOrNull ?? 'CGL'));

      final effectiveAttemptedList = attemptedList.isNotEmpty
          ? attemptedList
          : getTopicAttemptedQids(tid);

      _practiceSessions[tid] = TopicPracticeSession(
        topicId: tid,
        topicName: topic?.name ?? existingSession?.topicName ?? tid,
        subjectId: topic?.subjectId ?? existingSession?.subjectId ?? '',
        subjectName: subject?.name ?? existingSession?.subjectName ?? '',
        examCode: sessionExamCode,
        lastQuestionId: questionId ?? existingSession?.lastQuestionId,
        lastQuestionIndex: currentQuestionIndex ?? (effectiveAttemptedList.isNotEmpty ? effectiveAttemptedList.length - 1 : 0),
        attemptedQuestionIds: effectiveAttemptedList,
        correctCount: newCorrectCount,
        totalQuestions: effectiveTotal,
        updatedAt: DateTime.now(),
      );
      await _persistPracticeSessions();
    }
  }

  /// List of distinct question IDs attempted for a topic
  List<String> getTopicAttemptedQids(String topicId) {
    final tid = topicId.trim();
    final attemptedKey = 'user_topic_${tid}_attempted_qids';
    return _prefs?.getStringList(attemptedKey) ?? [];
  }

  /// Map of question ID -> selected option index for a topic
  Map<String, int> getTopicAnswers(String topicId) {
    final tid = topicId.trim();
    final raw = _prefs?.getString('user_topic_${tid}_answers');
    if (raw == null || raw.isEmpty) return {};
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return map.map((k, v) => MapEntry(k, (v as num).toInt()));
    } catch (_) {
      return {};
    }
  }

  /// Saves student's selected option index for a question in a topic
  Future<void> saveTopicAnswer({
    required String topicId,
    required String questionId,
    required int selectedIndex,
  }) async {
    final tid = topicId.trim();
    final qid = questionId.trim();
    final answers = getTopicAnswers(tid);
    answers[qid] = selectedIndex;
    await _prefs?.setString('user_topic_${tid}_answers', jsonEncode(answers));
  }

  /// Gets the last viewed/attempted question index for a topic
  int getTopicLastIndex(String topicId) {
    final tid = topicId.trim();
    return _prefs?.getInt('user_topic_${tid}_last_index') ?? 0;
  }

  /// Sets the last viewed/attempted question index for a topic
  Future<void> setTopicLastIndex(String topicId, int index) async {
    final tid = topicId.trim();
    await _prefs?.setInt('user_topic_${tid}_last_index', index);
    if (_practiceSessions.containsKey(tid)) {
      _practiceSessions[tid] = _practiceSessions[tid]!.copyWith(
        lastQuestionIndex: index,
        updatedAt: DateTime.now(),
      );
      await _persistPracticeSessions();
    }
  }

  /// Calculates the next appropriate question index to resume for a topic.
  /// Finds the first unattempted question; if all attempted, returns lastIndex or 0.
  int getResumeQuestionIndex(String topicId, List<Question> questions) {
    if (questions.isEmpty) return 0;
    final attemptedIds = getTopicAttemptedQids(topicId).toSet();
    if (attemptedIds.isEmpty) return 0;

    // First unattempted question index
    final firstUnattempted = questions.indexWhere((q) => !attemptedIds.contains(q.id));
    if (firstUnattempted != -1) {
      return firstUnattempted;
    }

    // If all are attempted, return last saved index if valid, else 0
    final lastIdx = getTopicLastIndex(topicId);
    if (lastIdx >= 0 && lastIdx < questions.length) {
      return lastIdx;
    }
    return 0;
  }

  /// Returns the 0-based index of the first currently unattempted question in [questions]
  /// using question IDs. Returns -1 if all questions in [questions] are already attempted.
  int getFirstUnattemptedQuestionIndex(String topicId, List<Question> questions) {
    if (questions.isEmpty) return 0;
    final attemptedIds = getTopicAttemptedQids(topicId).toSet();
    if (attemptedIds.isEmpty) return 0;
    return questions.indexWhere((q) => !attemptedIds.contains(q.id));
  }

  /// Checks if all questions for a topic have been attempted based on question IDs.
  bool isTopicPracticeCompleted(String topicId, List<Question> questions) {
    if (questions.isEmpty) return false;
    final attemptedIds = getTopicAttemptedQids(topicId).toSet();
    if (attemptedIds.isEmpty) return false;
    return questions.every((q) => attemptedIds.contains(q.id));
  }

  /// Resets all local progress for a specific topic (answers, attempted questions, last index)
  /// without affecting Question Bank, Bookmarks, Wrong Questions, or Mock/Live attempts.
  Future<void> resetTopicPracticeProgress(String topicId) async {
    final tid = topicId.trim();
    await _prefs?.remove('user_topic_${tid}_last_index');
    await _prefs?.remove('user_topic_${tid}_attempted_qids');
    await _prefs?.remove('user_topic_${tid}_answers');
    await _prefs?.remove('user_topic_${tid}_correct_count');
    _practiceSessions.remove(tid);
    await _persistPracticeSessions();
  }

  // --- Practice Analytics & Global Session Counting ---

  /// Anonymous installation UUID (stable per app install, no hardware/ad identifiers)
  String get installationId {
    if (_installationId != null && _installationId!.isNotEmpty) {
      return _installationId!;
    }
    _installationId = _prefs?.getString('client_installation_uuid');
    if (_installationId == null || _installationId!.isEmpty) {
      _installationId = 'inst_${DateTime.now().millisecondsSinceEpoch}_${(1000 + (DateTime.now().microsecondsSinceEpoch % 9000))}';
      _prefs?.setString('client_installation_uuid', _installationId!);
    }
    return _installationId!;
  }

  /// Retrieves the cached global practice session count for a topic
  int getTopicSessionCount(String topicId) => _topicSessionCounts[topicId.trim()] ?? 0;

  /// Batch updates cached topic session counts
  Future<void> setTopicSessionCounts(Map<String, int> counts) async {
    _topicSessionCounts.addAll(counts);
    await _prefs?.setString('db_topic_session_counts', jsonEncode(_topicSessionCounts));
  }

  /// Updates single cached topic session count
  Future<void> updateTopicSessionCount(String topicId, int count) async {
    _topicSessionCounts[topicId.trim()] = count;
    await _prefs?.setString('db_topic_session_counts', jsonEncode(_topicSessionCounts));
  }

  /// Checks if a practice session ID has already been recorded locally
  bool isPracticeSessionRecorded(String sessionId) {
    final sid = sessionId.trim();
    if (_syncedSessionIds.contains(sid)) return true;
    return _pendingPracticeSessions.any((s) => s['sessionId'] == sid);
  }

  /// Enqueues a new practice session for atomic Firestore sync
  Future<void> enqueuePracticeSession({
    required String topicId,
    required String sessionId,
  }) async {
    final tid = topicId.trim();
    final sid = sessionId.trim();
    if (sid.isEmpty || isPracticeSessionRecorded(sid)) return;

    final event = {
      'topicId': tid,
      'sessionId': sid,
      'installationId': installationId,
      'createdAt': DateTime.now().toIso8601String(),
    };
    _pendingPracticeSessions.add(event);
    await _prefs?.setString('pending_practice_sessions', jsonEncode(_pendingPracticeSessions));

    // Optimistically increment locally so UI updates with 0ms lag
    final current = getTopicSessionCount(tid);
    _topicSessionCounts[tid] = current + 1;
    await _prefs?.setString('db_topic_session_counts', jsonEncode(_topicSessionCounts));
  }

  /// Retrieves unmodifiable list of pending offline practice sessions
  List<Map<String, dynamic>> getPendingPracticeSessions() =>
      List.unmodifiable(_pendingPracticeSessions);

  /// Marks a practice session as successfully synced to Firestore
  Future<void> markPracticeSessionSynced(String sessionId) async {
    final sid = sessionId.trim();
    _pendingPracticeSessions.removeWhere((s) => s['sessionId'] == sid);
    _syncedSessionIds.add(sid);
    await _prefs?.setString('pending_practice_sessions', jsonEncode(_pendingPracticeSessions));
    await _prefs?.setStringList('synced_practice_session_ids', _syncedSessionIds.toList());
  }

  /// Saves a topic practice session
  Future<void> savePracticeSession(TopicPracticeSession session) async {
    _practiceSessions[session.topicId] = session;
    await _persistPracticeSessions();
  }

  /// Retrieves a saved topic practice session
  TopicPracticeSession? getPracticeSession(String topicId) {
    return _practiceSessions[topicId];
  }

  /// Finds the latest incomplete practice session matching the selected exam.
  /// Returns null if no incomplete practice session exists for that exam.
  TopicPracticeSession? getResumablePracticeSession(String selectedExam) {
    final candidates = <TopicPracticeSession>[];

    for (final session in _practiceSessions.values) {
      final currentTotal = getQuestionsByTopic(session.topicId).length;
      final effectiveTotal = currentTotal > 0 ? currentTotal : session.totalQuestions;

      // Must have at least 1 attempt and not be 100% completed
      if (session.attemptedCount > 0 && effectiveTotal > 0 && session.attemptedCount < effectiveTotal) {
        if (selectedExam.toUpperCase() == 'ALL') {
          candidates.add(session.copyWith(totalQuestions: effectiveTotal));
        } else {
          final subject = getSubjectById(session.subjectId);
          if (subject != null && subject.matchesExam(selectedExam)) {
            candidates.add(session.copyWith(totalQuestions: effectiveTotal));
          } else if (session.examCode.toUpperCase() == selectedExam.toUpperCase() ||
              session.examDisplay.toUpperCase().contains(selectedExam.toUpperCase())) {
            candidates.add(session.copyWith(totalQuestions: effectiveTotal));
          }
        }
      }
    }

    // Fallback: check topics with progress in SharedPreferences not yet explicitly in _practiceSessions
    for (final topic in _topics) {
      if (_practiceSessions.containsKey(topic.id)) continue;
      final attempted = getTopicAttemptedCount(topic.id);
      final total = getQuestionsByTopic(topic.id).isNotEmpty
          ? getQuestionsByTopic(topic.id).length
          : topic.questionCount;

      if (attempted > 0 && total > 0 && attempted < total) {
        final subject = getSubjectById(topic.subjectId);
        if (selectedExam.toUpperCase() == 'ALL' || (subject != null && subject.matchesExam(selectedExam))) {
          final attemptedQids = getTopicAttemptedQids(topic.id);
          final correct = getTopicCorrectCount(topic.id);
          candidates.add(TopicPracticeSession(
            topicId: topic.id,
            topicName: topic.name,
            subjectId: topic.subjectId,
            subjectName: subject?.name ?? '',
            examCode: selectedExam.toUpperCase() != 'ALL'
                ? selectedExam
                : (subject?.examCodes.firstOrNull ?? 'CGL'),
            lastQuestionIndex: attempted,
            attemptedQuestionIds: attemptedQids,
            correctCount: correct,
            totalQuestions: total,
            updatedAt: DateTime.fromMillisecondsSinceEpoch(0),
          ));
        }
      }
    }

    if (candidates.isEmpty) return null;

    candidates.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return candidates.first;
  }

  /// Total distinct questions attempted for a specific topic
  int getTopicAttemptedCount(String topicId) {
    final tid = topicId.trim();
    final attemptedKey = 'user_topic_${tid}_attempted_qids';
    final list = _prefs?.getStringList(attemptedKey);
    if (list != null && list.isNotEmpty) return list.length;
    return _prefs?.getInt('user_topic_${tid}_attempts_count') ?? 0;
  }

  /// Total correct answers recorded for a specific topic
  int getTopicCorrectCount(String topicId) {
    final tid = topicId.trim();
    return _prefs?.getInt('user_topic_${tid}_correct_count') ?? 0;
  }

  /// Real topic accuracy: (correct answered attempts / attempted questions) * 100
  double getTopicAccuracy(String topicId) {
    final attempted = getTopicAttemptedCount(topicId);
    if (attempted <= 0) return 0.0;
    final correct = getTopicCorrectCount(topicId);
    return ((correct / attempted) * 100.0).clamp(0.0, 100.0);
  }

  /// Real topic progress: completed / available (clamp 0.0 to 1.0)
  double getTopicProgress(String topicId) {
    final available = getQuestionsByTopic(topicId).length;
    if (available <= 0) return 0.0;
    final attempted = getTopicAttemptedCount(topicId);
    return (attempted / available).clamp(0.0, 1.0);
  }

  /// Calculates total questions answered across all genuine attempts + practice sessions
  int getTotalQuestionsCount() {
    int attemptsQuestions = 0;
    for (final a in _attempts) {
      attemptsQuestions += (a.correctCount + a.wrongCount);
    }
    final practiceQuestions = _prefs?.getInt('user_practice_questions_count') ?? 0;
    return attemptsQuestions + practiceQuestions;
  }

  /// Calculates real accuracy percentage across genuine attempts + practice sessions
  int getAccuracyPercentage() {
    int totalQuestions = 0;
    int totalCorrect = 0;
    for (final a in _attempts) {
      totalQuestions += (a.correctCount + a.wrongCount);
      totalCorrect += a.correctCount;
    }
    totalQuestions += (_prefs?.getInt('user_practice_questions_count') ?? 0);
    totalCorrect += (_prefs?.getInt('user_practice_correct_count') ?? 0);

    if (totalQuestions == 0) return 0;
    return ((totalCorrect / totalQuestions) * 100).round();
  }

  /// Calculates genuine consecutive day streak based on student attempt/practice timestamps
  int getStreakDays() {
    final activeDates = <DateTime>{};

    // Dates from genuine student attempts
    for (final a in _attempts) {
      activeDates.add(DateTime(a.timestamp.year, a.timestamp.month, a.timestamp.day));
    }

    // Dates from genuine practice sessions
    final practiceDates = _prefs?.getStringList('user_practice_dates') ?? [];
    for (final d in practiceDates) {
      final parts = d.split('-');
      if (parts.length == 3) {
        final y = int.tryParse(parts[0]);
        final m = int.tryParse(parts[1]);
        final day = int.tryParse(parts[2]);
        if (y != null && m != null && day != null) {
          activeDates.add(DateTime(y, m, day));
        }
      }
    }

    if (activeDates.isEmpty) return 0;

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));

    // A streak is alive only if the student was active today or yesterday
    DateTime currentCheck;
    if (activeDates.contains(today)) {
      currentCheck = today;
    } else if (activeDates.contains(yesterday)) {
      currentCheck = yesterday;
    } else {
      return 0;
    }

    int streak = 0;
    while (activeDates.contains(currentCheck)) {
      streak++;
      currentCheck = currentCheck.subtract(const Duration(days: 1));
    }

    return streak;
  }

  // User Preferred Exam & Language
  String getSelectedExam() => _prefs?.getString('user_selected_exam') ?? 'CGL';
  Future<void> setSelectedExam(String code) async {
    await _prefs?.setString('user_selected_exam', code);
  }

  String getSelectedLanguage() => _prefs?.getString('user_selected_lang') ?? 'en';
  Future<void> setSelectedLanguage(String lang) async {
    await _prefs?.setString('user_selected_lang', lang);
  }

  bool isOnboardingDone() => _prefs?.getBool('user_onboarding_done') ?? false;
  Future<void> setOnboardingDone(bool done) async {
    await _prefs?.setBool('user_onboarding_done', done);
  }

  // --- Admin API Methods (Questions & Mocks) ---
  Future<void> addQuestion(Question question) async {
    _questions.insert(0, question);
    await _persistQuestions();
  }

  Future<void> updateQuestion(Question question) async {
    final index = _questions.indexWhere((q) => q.id == question.id);
    if (index != -1) {
      _questions[index] = question;
      await _persistQuestions();
    }
  }

  Future<void> deleteQuestion(String id) async {
    _questions.removeWhere((q) => q.id == id);
    await _persistQuestions();
  }

  Future<void> bulkImportQuestions(List<Question> newQuestions) async {
    _questions.insertAll(0, newQuestions);
    await _persistQuestions();
  }

  Future<void> addMockTest(MockTest mockTest) async {
    _mockTests.insert(0, mockTest);
    await _persistMockTests();
  }

  List<ExamCategory> getCategories() => List.unmodifiable(_categories);

  Future<void> syncCategoriesFromFirestore(List<ExamCategory> categories) async {
    _categories.clear();
    _categories.addAll(categories);
    final raw = jsonEncode(_categories.map((c) => c.toMap()).toList());
    await _prefs?.setString('db_categories', raw);
  }

  Future<void> syncExamsFromFirestore(List<Exam> exams) async {
    _exams.clear();
    _exams.addAll(exams);
    final raw = jsonEncode(_exams.map((e) => e.toMap()).toList());
    await _prefs?.setString('db_exams', raw);
  }

  Future<void> syncSubjectsFromFirestore(List<Subject> subjects) async {
    _subjects.clear();
    _subjects.addAll(subjects);
    final raw = jsonEncode(_subjects.map((s) => s.toMap()).toList());
    await _prefs?.setString('db_subjects', raw);
  }

  Future<void> syncTopicsFromFirestore(List<Topic> topics) async {
    _topics.clear();
    _topics.addAll(topics);
    final raw = jsonEncode(_topics.map((t) => t.toMap()).toList());
    await _prefs?.setString('db_topics', raw);
  }

  Future<void> syncMockTestsFromFirestore(List<MockTest> mockTests) async {
    final publishedMocks = mockTests.where((m) => m.status.toLowerCase() == 'published').toList();
    _mockTests.clear();
    _mockTests.addAll(publishedMocks);
    await _persistMockTests();

    // Cache reconciliation: evict any cached live tests whose linked mock is no longer published
    final beforeCount = _liveTests.length;
    _liveTests.removeWhere((t) => !_mockTests.any((m) => m.id == t.testId));
    if (_liveTests.length != beforeCount) {
      await _persistLiveTests();
    }
  }

  Future<void> syncQuestionsFromFirestore(List<Question> firestoreQuestions) async {
    if (firestoreQuestions.isEmpty) return;

    final existingMap = {for (final q in _questions) q.id: q};

    for (final fq in firestoreQuestions) {
      final isBookmarked = _bookmarkedIds.contains(fq.id);
      existingMap[fq.id] = fq.copyWith(isBookmarked: isBookmarked);
    }

    _questions.clear();
    _questions.addAll(existingMap.values);
    await _persistQuestions();
  }

  /// Syncs all published practice questions from Firestore real-time stream.
  /// Updates existing records, adds new ones, and invalidates any questions that were
  /// unpublished or moved out of practice.
  Future<void> syncPracticeQuestionsFromFirestore(List<Question> publishedQuestions) async {
    final publishedIds = publishedQuestions.map((q) => q.id).toSet();
    final existingMap = {for (final q in _questions) q.id: q};

    // 1. Any existing practice question no longer published in Firestore is marked as draft
    for (final entry in existingMap.entries) {
      if (entry.value.isPublished &&
          (entry.value.usageType == 'PRACTICE' || entry.value.usageType == 'BOTH') &&
          !publishedIds.contains(entry.key)) {
        existingMap[entry.key] = entry.value.copyWith(status: 'draft');
      }
    }

    // 2. Add or update all published practice questions
    for (final fq in publishedQuestions) {
      final isBookmarked = _bookmarkedIds.contains(fq.id);
      existingMap[fq.id] = fq.copyWith(isBookmarked: isBookmarked);
    }

    _questions.clear();
    _questions.addAll(existingMap.values);
    await _persistQuestions();
  }

  /// Syncs topic questions and removes/invalidates any cached questions for this topic
  /// that are no longer published in Firestore, preventing stale draft leaks.
  Future<void> syncTopicQuestionsFromFirestore(String topicId, List<Question> publishedQuestions) async {
    final topic = getTopicById(topicId);
    final publishedIds = publishedQuestions.map((q) => q.id).toSet();

    final existingMap = {for (final q in _questions) q.id: q};

    // Any question in cache for this topic that is no longer returned in publishedQuestions
    // is updated to 'draft' so it is never served to students in Practice.
    for (final q in _questions) {
      final matchesTopic = q.topicId == topicId ||
          (topic != null && (q.topicId == topic.id ||
              q.topicId.toLowerCase() == topic.name.toLowerCase() ||
              (q.topicName != null && q.topicName!.toLowerCase() == topic.name.toLowerCase())));
      if (matchesTopic && !publishedIds.contains(q.id)) {
        existingMap[q.id] = q.copyWith(status: 'draft');
      }
    }

    // Add/update published questions
    for (final fq in publishedQuestions) {
      final isBookmarked = _bookmarkedIds.contains(fq.id);
      existingMap[fq.id] = fq.copyWith(isBookmarked: isBookmarked);
    }

    _questions.clear();
    _questions.addAll(existingMap.values);
    await _persistQuestions();
  }

  /// Syncs questions for an entire subject and invalidates stale draft/archived cache.
  Future<void> syncSubjectQuestionsFromFirestore(String subjectId, List<Question> publishedQuestions) async {
    final subject = getSubjectById(subjectId);
    final publishedIds = publishedQuestions.map((q) => q.id).toSet();

    final existingMap = {for (final q in _questions) q.id: q};

    // Any question in cache for this subject that is no longer returned in publishedQuestions
    // is updated to 'draft' so it is never served to students in Practice.
    for (final q in _questions) {
      final matchesSubject = q.subjectId == subjectId ||
          (subject != null && (q.subjectId == subject.id ||
              q.subjectId.toLowerCase() == subject.name.toLowerCase() ||
              (q.subjectName != null && q.subjectName!.toLowerCase() == subject.name.toLowerCase())));
      if (matchesSubject && !publishedIds.contains(q.id)) {
        existingMap[q.id] = q.copyWith(status: 'draft');
      }
    }

    // Add/update published questions
    for (final fq in publishedQuestions) {
      final isBookmarked = _bookmarkedIds.contains(fq.id);
      existingMap[fq.id] = fq.copyWith(isBookmarked: isBookmarked);
    }

    _questions.clear();
    _questions.addAll(existingMap.values);
    await _persistQuestions();
  }

  // --- Purchase & Monetization Access ---
  bool isTestUnlocked(MockTest test) {
    if (test.isFree) return true;
    if (_purchasedProductIds.contains(test.id)) return true;
    if (test.productId != null && _purchasedProductIds.contains(test.productId!)) return true;
    return false;
  }

  Future<void> unlockTest(String testIdOrProductId) async {
    _purchasedProductIds.add(testIdOrProductId);
    await _prefs?.setStringList('saved_purchased_products', _purchasedProductIds.toList());
  }

  Set<String> getPurchasedProductIds() => Set.unmodifiable(_purchasedProductIds);

  // --- Banners, Notices, Live Tests, Remote Config ---
  List<HomeBanner> getBanners() => List.unmodifiable(_banners);
  List<AppNotice> getNotices() => List.unmodifiable(_notices);
  List<LiveTestItem> getLiveTests() {
    return List.unmodifiable(_liveTests.where((t) {
      if (!t.isPublished) return false;
      final mock = getMockTestById(t.testId);
      return mock != null && mock.status.toLowerCase() == 'published';
    }));
  }

  LiveTestItem? getLiveTestById(String id) {
    try {
      final t = _liveTests.firstWhere((item) => item.id == id);
      if (!t.isPublished) return null;
      final mock = getMockTestById(t.testId);
      if (mock == null || mock.status.toLowerCase() != 'published') return null;
      return t;
    } catch (_) {
      return null;
    }
  }

  LiveTestItem? getLiveTestByTestId(String testId) {
    try {
      final t = _liveTests.firstWhere((item) => item.testId == testId);
      if (!t.isPublished) return null;
      final mock = getMockTestById(t.testId);
      if (mock == null || mock.status.toLowerCase() != 'published') return null;
      return t;
    } catch (_) {
      return null;
    }
  }
  RemoteAppConfig getRemoteConfig() => _remoteConfig;

  List<AppNotice> getActiveNotices() {
    final active = _notices.where((n) => n.isCurrentlyActive).toList();
    active.sort((a, b) {
      if (a.isPinned != b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      final aDate = a.publishAt ?? DateTime.tryParse(a.date) ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bDate = b.publishAt ?? DateTime.tryParse(b.date) ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bDate.compareTo(aDate);
    });
    return List.unmodifiable(active);
  }

  LiveTestItem? getActiveOrUpcomingLiveTest() {
    final valid = _liveTests.where((t) {
      if (!t.isPublished) return false;
      if (t.status == LiveTestStatus.ended) return false;
      final mock = getMockTestById(t.testId);
      if (mock == null || mock.status.toLowerCase() != 'published') return false;
      return true;
    }).toList();
    if (valid.isEmpty) return null;
    valid.sort((a, b) {
      // Live tests take precedence over upcoming tests
      if (a.status == LiveTestStatus.live && b.status != LiveTestStatus.live) return -1;
      if (b.status == LiveTestStatus.live && a.status != LiveTestStatus.live) return 1;
      // Featured tests come before non-featured
      if (a.featured != b.featured) return a.featured ? -1 : 1;
      // Earlier start time first
      return a.startAt.compareTo(b.startAt);
    });
    return valid.first;
  }

  Future<void> syncBannersFromFirestore(List<HomeBanner> banners) async {
    _banners.clear();
    _banners.addAll(banners);
    final raw = jsonEncode(_banners.map((b) => b.toMap()).toList());
    await _prefs?.setString('db_banners', raw);
  }

  Future<void> syncNoticesFromFirestore(List<AppNotice> notices) async {
    _notices.clear();
    _notices.addAll(notices);
    final raw = jsonEncode(_notices.map((n) => n.toMap()).toList());
    await _prefs?.setString('db_notices', raw);
  }

  Future<void> syncLiveTestsFromFirestore(List<LiveTestItem> liveTests) async {
    // A Live Test is valid ONLY if it is published AND its linked Mock exists in published mocks
    final valid = liveTests.where((t) {
      if (!t.isPublished) return false;
      final mock = getMockTestById(t.testId);
      return mock != null && mock.status.toLowerCase() == 'published';
    }).toList();
    _liveTests.clear();
    _liveTests.addAll(valid);
    await _persistLiveTests();
  }

  Future<void> _persistLiveTests() async {
    final raw = jsonEncode(_liveTests.map((t) => t.toMap()).toList());
    await _prefs?.setString('db_live_tests', raw);
  }

  // --- Live Test Registrations ---
  LiveTestRegistration? getLiveTestRegistration(String liveTestId) => _liveTestRegistrations[liveTestId];

  Future<void> saveLiveTestRegistration(LiveTestRegistration reg) async {
    _liveTestRegistrations[reg.liveTestId] = reg;
    final map = {for (final e in _liveTestRegistrations.entries) e.key: e.value.toMap()};
    await _prefs?.setString('db_live_test_registrations', jsonEncode(map));
  }

  Future<void> updateLiveTestRegistrationStatus(
    String liveTestId,
    String status, {
    DateTime? startedAt,
    DateTime? submittedAt,
    double? score,
  }) async {
    final existing = _liveTestRegistrations[liveTestId];
    if (existing != null) {
      final updated = existing.copyWith(
        status: status,
        startedAt: startedAt ?? existing.startedAt,
        submittedAt: submittedAt ?? existing.submittedAt,
        score: score ?? existing.score,
      );
      await saveLiveTestRegistration(updated);
    }
  }

  Future<void> syncRemoteConfigFromFirestore(RemoteAppConfig config) async {
    _remoteConfig = config;
    final raw = jsonEncode(_remoteConfig.toMap());
    await _prefs?.setString('db_app_config', raw);
  }

  // --- QOTD Local Attempt Persistence ---
  Future<void> saveQotdAttempt({
    required String date,
    required String questionId,
    required int selectedOption,
    required bool isCorrect,
  }) async {
    final key = 'qotd_attempt_$date';
    final data = {
      'date': date,
      'questionId': questionId,
      'selectedOption': selectedOption,
      'isCorrect': isCorrect,
      'timestamp': DateTime.now().toIso8601String(),
    };
    await _prefs?.setString(key, jsonEncode(data));
  }

  Map<String, dynamic>? getQotdAttempt(String date) {
    final raw = _prefs?.getString('qotd_attempt_$date');
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  // --- Question of the Day (QOTD) Cache & Sync ---
  QuestionOfTheDay? getCachedQotd(String date) {
    if (_cachedQotdByDate.containsKey(date)) {
      return _cachedQotdByDate[date];
    }
    final raw = _prefs?.getString('cached_qotd_$date');
    if (raw == null || raw.isEmpty) return null;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      final qotd = QuestionOfTheDay.fromMap(map);
      _cachedQotdByDate[date] = qotd;
      return qotd;
    } catch (_) {
      return null;
    }
  }

  Future<void> syncQotdFromFirestore(QuestionOfTheDay qotd) async {
    _cachedQotdByDate[qotd.date] = qotd;
    await _prefs?.setString('cached_qotd_${qotd.date}', jsonEncode(qotd.toMap()));
  }

  Future<void> clearCachedQotd(String date) async {
    _cachedQotdByDate.remove(date);
    await _prefs?.remove('cached_qotd_$date');
  }

  // --- Active Exam State Preservation ---
  Future<void> saveExamDraft(String testId, Map<String, dynamic> draftData) async {
    await _prefs?.setString('exam_draft_$testId', jsonEncode(draftData));
  }

  Map<String, dynamic>? getExamDraft(String testId) {
    final raw = _prefs?.getString('exam_draft_$testId');
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> clearExamDraft(String testId) async {
    await _prefs?.remove('exam_draft_$testId');
  }

  // ============================================================================
  // PHASE A: ADMIN-CONTROLLED LMS ACCESSORS & LOCAL PERSISTENCE
  // ============================================================================

  // --- 1. Test Series & Folders ---
  List<TestSeries> getTestSeries({String? examCode, bool publishedOnly = true}) {
    return _testSeries.where((s) {
      if (publishedOnly && !s.isPublished) return false;
      if (examCode != null && examCode.isNotEmpty && examCode.toUpperCase() != 'ALL') {
        if (s.examCode.toUpperCase() != examCode.toUpperCase()) return false;
      }
      return true;
    }).toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  }

  TestSeries? getTestSeriesById(String id) {
    try {
      return _testSeries.firstWhere((s) => s.id == id);
    } catch (_) {
      return null;
    }
  }

  List<TestSeriesFolder> getTestSeriesFolders(String seriesId, {bool publishedOnly = true}) {
    return _testSeriesFolders.where((f) {
      if (f.seriesId != seriesId) return false;
      if (publishedOnly && !f.isPublished) return false;
      return true;
    }).toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  }

  List<TestSeriesItem> getTestSeriesItems(String seriesId, String folderId, {bool publishedOnly = true}) {
    return _testSeriesItems.where((i) {
      if (i.seriesId != seriesId || i.folderId != folderId) return false;
      if (publishedOnly && !i.isPublished) return false;
      return true;
    }).toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  }

  Future<void> saveTestSeriesList(List<TestSeries> list) async {
    _testSeries.clear();
    _testSeries.addAll(list);
    await _prefs?.setString('db_test_series', jsonEncode(list.map((s) => s.toMap()).toList()));
  }

  Future<void> saveTestSeriesFolders(List<TestSeriesFolder> list) async {
    _testSeriesFolders.clear();
    _testSeriesFolders.addAll(list);
    await _prefs?.setString('db_test_series_folders', jsonEncode(list.map((f) => f.toMap()).toList()));
  }

  Future<void> saveTestSeriesItems(List<TestSeriesItem> list) async {
    _testSeriesItems.clear();
    _testSeriesItems.addAll(list);
    await _prefs?.setString('db_test_series_items', jsonEncode(list.map((i) => i.toMap()).toList()));
  }

  // --- 2. Study Library ---
  List<StudyFolder> getStudyFolders({String? examCode, bool publishedOnly = true}) {
    return _studyFolders.where((f) {
      if (publishedOnly && !f.isPublished) return false;
      if (examCode != null && examCode.isNotEmpty && examCode.toUpperCase() != 'ALL') {
        if (f.examCode.toUpperCase() != examCode.toUpperCase()) return false;
      }
      return true;
    }).toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  }

  List<StudyMaterial> getStudyMaterials({String? folderId, String? examCode, bool publishedOnly = true}) {
    return _studyMaterials.where((m) {
      if (publishedOnly && !m.isPublished) return false;
      if (folderId != null && m.folderId != folderId) return false;
      if (examCode != null && examCode.isNotEmpty && examCode.toUpperCase() != 'ALL') {
        if (m.examCode.toUpperCase() != examCode.toUpperCase()) return false;
      }
      return true;
    }).toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  }

  StudyMaterial? getStudyMaterialById(String id) {
    try {
      return _studyMaterials.firstWhere((m) => m.id == id);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveStudyFolders(List<StudyFolder> list) async {
    _studyFolders.clear();
    _studyFolders.addAll(list);
    await _prefs?.setString('db_study_folders', jsonEncode(list.map((f) => f.toMap()).toList()));
  }

  Future<void> saveStudyMaterials(List<StudyMaterial> list) async {
    _studyMaterials.clear();
    _studyMaterials.addAll(list);
    await _prefs?.setString('db_study_materials', jsonEncode(list.map((m) => m.toMap()).toList()));
  }

  // --- 3. Battle / Competition Mode ---
  List<BattleItem> getBattles({String? examCode, bool publishedOnly = true}) {
    return _battles.where((b) {
      if (publishedOnly && !b.isPublished) return false;
      if (examCode != null && examCode.isNotEmpty && examCode.toUpperCase() != 'ALL') {
        if (b.examCode.toUpperCase() != examCode.toUpperCase()) return false;
      }
      return true;
    }).toList()..sort((a, b) => a.startAt.compareTo(b.startAt));
  }

  BattleItem? getBattleById(String id) {
    try {
      return _battles.firstWhere((b) => b.id == id);
    } catch (_) {
      return null;
    }
  }

  BattleRegistration? getBattleRegistration(String battleId) {
    return _battleRegistrations[battleId];
  }

  Future<void> saveBattles(List<BattleItem> list) async {
    _battles.clear();
    _battles.addAll(list);
    await _prefs?.setString('db_battles', jsonEncode(list.map((b) => b.toMap()).toList()));
  }

  Future<void> saveBattleRegistration(BattleRegistration registration) async {
    _battleRegistrations[registration.battleId] = registration;
    final map = <String, dynamic>{};
    for (final e in _battleRegistrations.entries) {
      map[e.key] = e.value.toMap();
    }
    await _prefs?.setString('db_battle_registrations', jsonEncode(map));
  }

  // --- 4. Career Goals & Roadmap ---
  List<CareerGoal> getCareerGoals({String? examCode, bool publishedOnly = true}) {
    return _careerGoals.where((g) {
      if (publishedOnly && !g.isPublished) return false;
      if (examCode != null && examCode.isNotEmpty && examCode.toUpperCase() != 'ALL') {
        if (g.examCode.toUpperCase() != examCode.toUpperCase()) return false;
      }
      return true;
    }).toList();
  }

  CareerGoal? getCareerGoalByExam(String examCode) {
    try {
      return _careerGoals.firstWhere(
        (g) => g.examCode.toUpperCase() == examCode.toUpperCase() && g.isPublished,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> saveCareerGoals(List<CareerGoal> list) async {
    _careerGoals.clear();
    _careerGoals.addAll(list);
    await _prefs?.setString('db_career_goals', jsonEncode(list.map((g) => g.toMap()).toList()));
  }

  // --- 5. Current Affairs ---
  List<CurrentAffairsItem> getCurrentAffairs({String? category, bool publishedOnly = true}) {
    return _currentAffairs.where((a) {
      if (publishedOnly && !a.isPublished) return false;
      if (category != null && category.isNotEmpty && category.toUpperCase() != 'ALL') {
        if (a.category.toUpperCase() != category.toUpperCase()) return false;
      }
      return true;
    }).toList()..sort((a, b) => b.publishDate.compareTo(a.publishDate));
  }

  CurrentAffairsItem? getCurrentAffairsById(String id) {
    try {
      return _currentAffairs.firstWhere((a) => a.id == id);
    } catch (_) {
      return null;
    }
  }

  Future<void> saveCurrentAffairs(List<CurrentAffairsItem> list) async {
    _currentAffairs.clear();
    _currentAffairs.addAll(list);
    await _prefs?.setString('db_current_affairs', jsonEncode(list.map((a) => a.toMap()).toList()));
  }

  // --- 6. Dynamic Home Section Config ---
  static List<HomeSectionConfig> getDefaultHomeSections() => const [
    HomeSectionConfig(id: 'qotd', sectionType: 'qotd', sortOrder: 1, enabled: true),
    HomeSectionConfig(id: 'banners', sectionType: 'banners', sortOrder: 2, enabled: true),
    HomeSectionConfig(id: 'notices', sectionType: 'notices', sortOrder: 3, enabled: true),
    HomeSectionConfig(id: 'live_tests', sectionType: 'live_tests', sortOrder: 4, enabled: true),
    HomeSectionConfig(id: 'test_series', sectionType: 'test_series', sortOrder: 5, enabled: true),
    HomeSectionConfig(id: 'practice', sectionType: 'practice', sortOrder: 6, enabled: true),
    HomeSectionConfig(id: 'study_material', sectionType: 'study_material', sortOrder: 7, enabled: true),
    HomeSectionConfig(id: 'current_affairs', sectionType: 'current_affairs', sortOrder: 8, enabled: true),
    HomeSectionConfig(id: 'career_goals', sectionType: 'career_goals', sortOrder: 9, enabled: true),
    HomeSectionConfig(id: 'battles', sectionType: 'battles', sortOrder: 10, enabled: false),
  ];

  List<HomeSectionConfig> getHomeSections() {
    if (_homeSections.isEmpty) {
      return getDefaultHomeSections();
    }
    final sorted = List<HomeSectionConfig>.from(_homeSections)
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return sorted;
  }

  Future<void> saveHomeSections(List<HomeSectionConfig> list) async {
    _homeSections.clear();
    _homeSections.addAll(list);
    await _prefs?.setString('db_home_sections', jsonEncode(list.map((s) => s.toMap()).toList()));
  }

  // --- 7. Entitlements & Verification vs UI Cache ---
  // ARCHITECTURAL CORRECTION 1:
  // UI entitlement cache is separated from server-verified entitlement records.
  List<EntitlementItem> getEntitlements() => List.unmodifiable(_entitlements);

  bool hasEntitlement(String targetId) {
    if (_purchasedProductIds.contains(targetId)) return true;
    return _entitlements.any((e) => e.id == targetId);
  }

  Future<void> unlockProduct(String productId) => unlockTest(productId);

  Future<void> recordEntitlement(EntitlementItem item) async {
    _entitlements.removeWhere((e) => e.id == item.id);
    _entitlements.add(item);
    await unlockTest(item.id);
    await _prefs?.setString('saved_entitlements', jsonEncode(_entitlements.map((e) => e.toMap()).toList()));
  }
}


