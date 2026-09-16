import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import 'seed_data.dart';

class LocalDatabase {
  static final LocalDatabase instance = LocalDatabase._internal();
  LocalDatabase._internal();

  SharedPreferences? _prefs;

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
  RemoteAppConfig _remoteConfig = const RemoteAppConfig();

  bool _isInitialized = false;

  Future<void> init() async {
    if (_isInitialized) return;
    _prefs = await SharedPreferences.getInstance();

    await _loadOrSeedData();
    _isInitialized = true;
  }

  Future<void> _loadOrSeedData() async {
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
        _loadSeedQuestions();
      }
    } else {
      _loadSeedQuestions();
      await _persistQuestions();
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
        _loadDefaultCategories();
      }
    } else {
      _loadDefaultCategories();
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
        _exams.addAll(SeedData.exams);
      }
    } else {
      _exams.clear();
      _exams.addAll(SeedData.exams);
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
        _subjects.addAll(SeedData.subjects);
      }
    } else {
      _subjects.clear();
      _subjects.addAll(SeedData.subjects);
    }

    // 6. Topics
    _topics.clear();
    _topics.addAll(SeedData.topics);

    // 7. Mock Tests
    final mocksRaw = prefs.getString('db_mock_tests');
    if (mocksRaw != null && mocksRaw.isNotEmpty) {
      try {
        final list = jsonDecode(mocksRaw) as List;
        _mockTests.clear();
        for (final item in list) {
          _mockTests.add(MockTest.fromMap(Map<String, dynamic>.from(item)));
        }
      } catch (e) {
        _mockTests.addAll(SeedData.mockTests);
      }
    } else {
      _mockTests.addAll(SeedData.mockTests);
      await _persistMockTests();
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
      }
    }
  }

  void _loadSeedQuestions() {
    _questions.clear();
    for (final q in SeedData.questions) {
      _questions.add(q.copyWith(isBookmarked: _bookmarkedIds.contains(q.id)));
    }
  }

  Future<void> _persistQuestions() async {
    final raw = jsonEncode(_questions.map((q) => q.toMap()).toList());
    await _prefs?.setString('db_questions', raw);
  }

  Future<void> _persistMockTests() async {
    final raw = jsonEncode(_mockTests.map((m) => m.toMap()).toList());
    await _prefs?.setString('db_mock_tests', raw);
  }

  Future<void> _persistAttempts() async {
    final raw = jsonEncode(_attempts.map((a) => a.toMap()).toList());
    await _prefs?.setString('db_student_attempts', raw);
  }

  // --- Exams ---
  List<Exam> getExams() => List.unmodifiable(_exams);
  Exam? getExamByCode(String code) {
    try {
      return _exams.firstWhere((e) => e.code.toUpperCase() == code.toUpperCase());
    } catch (_) {
      return _exams.first;
    }
  }

  // --- Subjects ---
  List<Subject> getSubjects({String? examCode}) {
    if (examCode == null || examCode == 'ALL') {
      return List.unmodifiable(_subjects);
    }
    return _subjects.where((s) => s.examCodes.contains(examCode)).toList();
  }

  Subject? getSubjectById(String id) {
    try {
      return _subjects.firstWhere((s) => s.id == id);
    } catch (_) {
      return null;
    }
  }

  // --- Topics ---
  List<Topic> getTopicsBySubject(String subjectId) {
    return _topics.where((t) => t.subjectId == subjectId).toList();
  }

  Topic? getTopicById(String id) {
    try {
      return _topics.firstWhere((t) => t.id == id);
    } catch (_) {
      return null;
    }
  }

  // --- Questions ---
  List<Question> getAllQuestions() => List.unmodifiable(_questions);

  List<Question> getQuestionsByTopic(String topicId) {
    return _questions.where((q) => q.topicId == topicId).toList();
  }

  List<Question> getQuestionsBySubject(String subjectId) {
    return _questions.where((q) => q.subjectId == subjectId).toList();
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
    var list = _mockTests;
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
      return _mockTests.firstWhere((m) => m.id == id);
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

    // Increment overall practice stats
    final totalAttempts = (_prefs?.getInt('user_total_questions') ?? 328) + attempt.correctCount + attempt.wrongCount;
    await _prefs?.setInt('user_total_questions', totalAttempts);

    // Update streak if applicable
    final lastActiveDateStr = _prefs?.getString('user_last_active_date');
    final todayStr = DateTime.now().toIso8601String().split('T').first;
    int currentStreak = _prefs?.getInt('user_streak_days') ?? 7;

    if (lastActiveDateStr != todayStr) {
      currentStreak += 1;
      await _prefs?.setInt('user_streak_days', currentStreak);
      await _prefs?.setString('user_last_active_date', todayStr);
    }
  }

  int getStreakDays() => _prefs?.getInt('user_streak_days') ?? 7;
  int getTotalQuestionsCount() => _prefs?.getInt('user_total_questions') ?? 328;
  int getAccuracyPercentage() {
    if (_attempts.isEmpty) return 72;
    int totalQuestions = 0;
    int totalCorrect = 0;
    for (final a in _attempts) {
      totalQuestions += (a.correctCount + a.wrongCount);
      totalCorrect += a.correctCount;
    }
    if (totalQuestions == 0) return 72;
    return ((totalCorrect / totalQuestions) * 100).round();
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

  void _loadDefaultCategories() {
    _categories.clear();
    _categories.addAll([
      const ExamCategory(id: 'cat_an', name: 'A&N Exams', code: 'AN', order: 1),
      const ExamCategory(id: 'cat_ssc', name: 'SSC Exams', code: 'SSC', order: 2),
      const ExamCategory(id: 'cat_police', name: 'Police Exams', code: 'POLICE', order: 3),
      const ExamCategory(id: 'cat_other', name: 'Other Exams', code: 'OTHER', order: 4),
    ]);
  }

  List<ExamCategory> getCategories() => List.unmodifiable(_categories);

  Future<void> syncCategoriesFromFirestore(List<ExamCategory> categories) async {
    if (categories.isEmpty) return;
    _categories.clear();
    _categories.addAll(categories);
    final raw = jsonEncode(_categories.map((c) => c.toMap()).toList());
    await _prefs?.setString('db_categories', raw);
  }

  Future<void> syncExamsFromFirestore(List<Exam> exams) async {
    if (exams.isEmpty) return;
    _exams.clear();
    _exams.addAll(exams);
    final raw = jsonEncode(_exams.map((e) => e.toMap()).toList());
    await _prefs?.setString('db_exams', raw);
  }

  Future<void> syncSubjectsFromFirestore(List<Subject> subjects) async {
    if (subjects.isEmpty) return;
    _subjects.clear();
    _subjects.addAll(subjects);
    final raw = jsonEncode(_subjects.map((s) => s.toMap()).toList());
    await _prefs?.setString('db_subjects', raw);
  }

  Future<void> syncMockTestsFromFirestore(List<MockTest> mockTests) async {
    if (mockTests.isEmpty) return;
    _mockTests.clear();
    _mockTests.addAll(mockTests);
    await _persistMockTests();
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

  // --- Banners, Notices, Remote Config ---
  List<HomeBanner> getBanners() => List.unmodifiable(_banners);
  List<AppNotice> getNotices() => List.unmodifiable(_notices);
  RemoteAppConfig getRemoteConfig() => _remoteConfig;

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

  Future<void> syncRemoteConfigFromFirestore(RemoteAppConfig config) async {
    _remoteConfig = config;
    final raw = jsonEncode(_remoteConfig.toMap());
    await _prefs?.setString('db_app_config', raw);
  }
}
