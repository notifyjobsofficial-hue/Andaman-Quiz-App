import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import '../database/local_database.dart';
import '../models/models.dart';

class FirestoreService {
  static final FirestoreService instance = FirestoreService._internal();
  FirestoreService._internal();

  FirebaseFirestore get _firestore => FirebaseFirestore.instance;

  // Collection names matching firestore.rules
  static const String colCategories = 'categories';
  static const String colQuestions = 'questions';
  static const String colExams = 'exams';
  static const String colSubjects = 'subjects';
  static const String colTopics = 'topics';
  static const String colMocks = 'mocks';
  static const String colLiveTests = 'live_tests';
  static const String colQotd = 'qotd';
  static const String colBanners = 'banners';
  static const String colNotices = 'notices';
  static const String colPracticeTopicStats = 'practice_topic_stats';
  static const String colTestSeries = 'test_series';
  static const String colStudyFolders = 'study_folders';
  static const String colStudyMaterials = 'study_materials';
  static const String colBattles = 'battles';
  static const String colQuestionReports = 'question_reports';
  static const String colCareerGoals = 'career_goals';
  static const String colCurrentAffairs = 'current_affairs';
  static const String colHomeSections = 'app_home_sections';

  // Broadcast stream controllers for reactive UI updates
  final _categoriesController = StreamController<List<ExamCategory>>.broadcast();
  final _examsController = StreamController<List<Exam>>.broadcast();
  final _subjectsController = StreamController<List<Subject>>.broadcast();
  final _topicsController = StreamController<List<Topic>>.broadcast();
  final _mockTestsController = StreamController<List<MockTest>>.broadcast();
  final _bannersController = StreamController<List<HomeBanner>>.broadcast();
  final _noticesController = StreamController<List<AppNotice>>.broadcast();
  final _liveTestsController = StreamController<List<LiveTestItem>>.broadcast();
  final _remoteConfigController = StreamController<RemoteAppConfig>.broadcast();
  final _qotdController = StreamController<QuestionOfTheDay?>.broadcast();
  final _practiceQuestionsController = StreamController<List<Question>>.broadcast();
  final _testSeriesController = StreamController<List<TestSeries>>.broadcast();
  final _studyFoldersController = StreamController<List<StudyFolder>>.broadcast();
  final _studyMaterialsController = StreamController<List<StudyMaterial>>.broadcast();
  final _battlesController = StreamController<List<BattleItem>>.broadcast();
  final _careerGoalsController = StreamController<List<CareerGoal>>.broadcast();
  final _currentAffairsController = StreamController<List<CurrentAffairsItem>>.broadcast();
  final _homeSectionsController = StreamController<List<HomeSectionConfig>>.broadcast();

  // Public streams for Riverpod providers to subscribe to
  Stream<List<ExamCategory>> get categoriesStream => _categoriesController.stream;
  Stream<List<Exam>> get examsStream => _examsController.stream;
  Stream<List<Subject>> get subjectsStream => _subjectsController.stream;
  Stream<List<Topic>> get topicsStream => _topicsController.stream;
  Stream<List<MockTest>> get mockTestsStream => _mockTestsController.stream;
  Stream<List<HomeBanner>> get bannersStream => _bannersController.stream;
  Stream<List<AppNotice>> get noticesStream => _noticesController.stream;
  Stream<List<LiveTestItem>> get liveTestsStream => _liveTestsController.stream;
  Stream<RemoteAppConfig> get remoteConfigStream => _remoteConfigController.stream;
  Stream<QuestionOfTheDay?> get qotdStream => _qotdController.stream;
  Stream<List<Question>> get practiceQuestionsStream => _practiceQuestionsController.stream;
  Stream<List<TestSeries>> get testSeriesStream => _testSeriesController.stream;
  Stream<List<StudyFolder>> get studyFoldersStream => _studyFoldersController.stream;
  Stream<List<StudyMaterial>> get studyMaterialsStream => _studyMaterialsController.stream;
  Stream<List<BattleItem>> get battlesStream => _battlesController.stream;
  Stream<List<CareerGoal>> get careerGoalsStream => _careerGoalsController.stream;
  Stream<List<CurrentAffairsItem>> get currentAffairsStream => _currentAffairsController.stream;
  Stream<List<HomeSectionConfig>> get homeSectionsStream => _homeSectionsController.stream;

  // Question report rate limiting cooldown cache (client-side 60s cooldown per question)
  final Map<String, DateTime> _reportCooldowns = {};

  // Active subscriptions
  final List<StreamSubscription> _subscriptions = [];
  bool _syncStarted = false;

  // --- Questions ---
  Future<void> saveQuestion(Question question) async {
    try {
      await _firestore
          .collection(colQuestions)
          .doc(question.id)
          .set(question.toMap(), SetOptions(merge: true));
      debugPrint('Question ${question.id} saved to Firestore');
    } catch (e) {
      debugPrint('Error saving question to Firestore: $e');
      rethrow;
    }
  }

  Future<void> deleteQuestion(String questionId) async {
    try {
      await _firestore.collection(colQuestions).doc(questionId).delete();
      debugPrint('Question $questionId deleted from Firestore');
    } catch (e) {
      debugPrint('Error deleting question from Firestore: $e');
      rethrow;
    }
  }

  Stream<List<Question>> streamQuestions() {
    return _firestore.collection(colQuestions).snapshots().map((snapshot) {
      return snapshot.docs.map((doc) => Question.fromMap(doc.data())).toList();
    });
  }

  Future<List<Question>> fetchQuestions() async {
    try {
      final snapshot = await _firestore.collection(colQuestions).get();
      return snapshot.docs.map((doc) => Question.fromMap(doc.data())).toList();
    } catch (e) {
      debugPrint('Error fetching questions from Firestore: $e');
      return [];
    }
  }

  // --- Mock Tests ---
  Future<MockTest?> fetchMockTest(String testId, {bool allowDraft = false}) async {
    if (testId.trim().isEmpty) return null;
    try {
      final docMocks = await _firestore.collection(colMocks).doc(testId).get();
      if (docMocks.exists && docMocks.data() != null) {
        final data = docMocks.data()!;
        data['id'] = docMocks.id;
        final mock = MockTest.fromMap(data);
        if (!allowDraft && mock.status.toLowerCase() != 'published') {
          debugPrint('fetchMockTest: Test $testId is in ${mock.status} - rejected for student catalog.');
          return null;
        }
        return mock;
      }
      final docMockTests = await _firestore.collection('mock_tests').doc(testId).get();
      if (docMockTests.exists && docMockTests.data() != null) {
        final data = docMockTests.data()!;
        data['id'] = docMockTests.id;
        final mock = MockTest.fromMap(data);
        if (!allowDraft && mock.status.toLowerCase() != 'published') {
          debugPrint('fetchMockTest: Test $testId is in ${mock.status} - rejected for student catalog.');
          return null;
        }
        return mock;
      }
      return null;
    } catch (e) {
      debugPrint('Error fetching mock test $testId: $e');
      return null;
    }
  }

  Future<void> saveMockTest(MockTest mockTest) async {
    try {
      final map = mockTest.toMap();
      await _firestore.collection(colMocks).doc(mockTest.id).set(map, SetOptions(merge: true));
      await _firestore.collection('mock_tests').doc(mockTest.id).set(map, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error saving mock test to Firestore: $e');
      rethrow;
    }
  }

  Stream<List<MockTest>> streamMockTests() {
    return _firestore.collection(colMocks).snapshots().map((snapshot) {
      return snapshot.docs.map((doc) => MockTest.fromMap(doc.data())).toList();
    });
  }

  // --- Exams, Subjects, Topics ---
  Future<void> saveExam(Exam exam) async {
    await _firestore.collection(colExams).doc(exam.id).set(exam.toMap(), SetOptions(merge: true));
  }

  Future<void> saveSubject(Subject subject) async {
    await _firestore.collection(colSubjects).doc(subject.id).set(subject.toMap(), SetOptions(merge: true));
  }

  Future<void> saveTopic(Topic topic) async {
    await _firestore.collection(colTopics).doc(topic.id).set(topic.toMap(), SetOptions(merge: true));
  }

  // --- Real-Time Sync: Persistent Snapshot Listeners ---
  void initRealtimeSync({void Function(List<Question>)? onSync}) {
    if (Firebase.apps.isEmpty) {
      debugPrint('Firebase not initialized; running in offline local mode.');
      return;
    }
    if (_syncStarted) return;
    _syncStarted = true;

    _subscribeToCategories();
    _subscribeToExams();
    _subscribeToSubjects();
    _subscribeToTopics();
    _subscribeToMockTests();
    _subscribeToBanners();
    _subscribeToNotices();
    _subscribeToLiveTests();
    _subscribeToAppConfig();
    _subscribeToQotd();
    _subscribeToPracticeQuestions();

    debugPrint('FirestoreService: real-time listeners started for all collections.');
  }

  void _subscribeToPracticeQuestions() {
    final sub = _firestore
        .collection(colQuestions)
        .where('status', isEqualTo: 'published')
        .snapshots()
        .listen((snapshot) async {
      try {
        final questions = snapshot.docs.map((d) {
          final data = d.data();
          if (data['id'] == null || (data['id'] as String).isEmpty) {
            data['id'] = d.id;
          }
          return Question.fromMap(data);
        }).where((q) => q.isPublished && q.usageType != 'MOCK' && q.usageType != 'NOT_USED').toList();

        await LocalDatabase.instance.syncPracticeQuestionsFromFirestore(questions);
        _practiceQuestionsController.add(questions);
      } catch (e) {
        debugPrint('Practice questions sync error: $e');
      }
    }, onError: (e) => debugPrint('Practice questions stream error: $e'));
    _subscriptions.add(sub);
  }

  void _subscribeToCategories() {
    final sub = _firestore
        .collection(colCategories)
        .where('isActive', isEqualTo: true)
        .snapshots()
        .listen((snapshot) async {
      try {
        final cats = snapshot.docs
            .map((d) => ExamCategory.fromMap(d.data()))
            .toList()
          ..sort((a, b) => a.order.compareTo(b.order));
        await LocalDatabase.instance.syncCategoriesFromFirestore(cats);
        _categoriesController.add(cats);
      } catch (e) {
        debugPrint('Categories sync error: $e');
      }
    }, onError: (e) => debugPrint('Categories stream error: $e'));
    _subscriptions.add(sub);
  }

  void _subscribeToExams() {
    final sub = _firestore.collection(colExams).snapshots().listen((snapshot) async {
      try {
        final exams = snapshot.docs.map((d) => Exam.fromMap(d.data())).toList();
        await LocalDatabase.instance.syncExamsFromFirestore(exams);
        _examsController.add(exams);
      } catch (e) {
        debugPrint('Exams sync error: $e');
      }
    }, onError: (e) => debugPrint('Exams stream error: $e'));
    _subscriptions.add(sub);
  }

  void _subscribeToSubjects() {
    final sub = _firestore.collection(colSubjects).snapshots().listen((snapshot) async {
      try {
        final subs = snapshot.docs.map((d) => Subject.fromMap(d.data())).toList();
        await LocalDatabase.instance.syncSubjectsFromFirestore(subs);
        _subjectsController.add(subs);
      } catch (e) {
        debugPrint('Subjects sync error: $e');
      }
    }, onError: (e) => debugPrint('Subjects stream error: $e'));
    _subscriptions.add(sub);
  }

  void _subscribeToTopics() {
    final sub = _firestore.collection(colTopics).snapshots().listen((snapshot) async {
      try {
        final topics = snapshot.docs.map((d) => Topic.fromMap(d.data())).toList();
        await LocalDatabase.instance.syncTopicsFromFirestore(topics);
        _topicsController.add(topics);
      } catch (e) {
        debugPrint('Topics sync error: $e');
      }
    }, onError: (e) => debugPrint('Topics stream error: $e'));
    _subscriptions.add(sub);
  }

  final Map<String, MockTest> _publishedMocksById = {};
  List<LiveTestItem> _rawLiveTests = [];

  void _reconcileAndEmitLiveTests() async {
    // Only emit live tests whose linked mock exists in published mocks
    final validLiveTests = _rawLiveTests.where((t) {
      if (!t.isPublished) return false;
      final mock = _publishedMocksById[t.testId] ?? LocalDatabase.instance.getMockTestById(t.testId);
      return mock != null && mock.status.toLowerCase() == 'published';
    }).toList();

    await LocalDatabase.instance.syncLiveTestsFromFirestore(validLiveTests);
    _liveTestsController.add(validLiveTests);
  }

  void _subscribeToMockTests() {
    final Map<String, MockTest> mergedMocks = {};

    void updateAndSync() async {
      final list = mergedMocks.values
          .where((m) => m.status.toLowerCase() == 'published')
          .toList()
        ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
      _publishedMocksById.clear();
      for (final m in list) {
        _publishedMocksById[m.id] = m;
      }
      await LocalDatabase.instance.syncMockTestsFromFirestore(list);
      _mockTestsController.add(list);
      _reconcileAndEmitLiveTests();
    }

    final sub1 = _firestore.collection(colMocks).snapshots().listen((snapshot) {
      try {
        for (final doc in snapshot.docs) {
          final data = doc.data();
          data['id'] = doc.id;
          mergedMocks[doc.id] = MockTest.fromMap(data);
        }
        updateAndSync();
      } catch (e) {
        debugPrint('Mocks sync error: $e');
      }
    }, onError: (e) => debugPrint('Mocks stream error: $e'));
    _subscriptions.add(sub1);

    final sub2 = _firestore.collection('mock_tests').snapshots().listen((snapshot) {
      try {
        for (final doc in snapshot.docs) {
          final data = doc.data();
          data['id'] = doc.id;
          if (!mergedMocks.containsKey(doc.id)) {
            mergedMocks[doc.id] = MockTest.fromMap(data);
          }
        }
        updateAndSync();
      } catch (e) {
        debugPrint('Mock_tests sync error: $e');
      }
    }, onError: (e) => debugPrint('Mock_tests stream error: $e'));
    _subscriptions.add(sub2);
  }

  void _subscribeToBanners() {
    final sub = _firestore
        .collection(colBanners)
        .where('active', isEqualTo: true)
        .snapshots()
        .listen((snapshot) async {
      try {
        final banners = snapshot.docs
            .map((d) => HomeBanner.fromMap(d.data()))
            .toList()
          ..sort((a, b) => a.order.compareTo(b.order));
        await LocalDatabase.instance.syncBannersFromFirestore(banners);
        _bannersController.add(banners);
      } catch (e) {
        debugPrint('Banners sync error: $e');
      }
    }, onError: (e) => debugPrint('Banners stream error: $e'));
    _subscriptions.add(sub);
  }

  void _subscribeToNotices() {
    final sub = _firestore
        .collection(colNotices)
        .where('active', isEqualTo: true)
        .snapshots()
        .listen((snapshot) async {
      try {
        final notices = snapshot.docs.map((d) => AppNotice.fromMap(d.data())).toList();
        await LocalDatabase.instance.syncNoticesFromFirestore(notices);
        _noticesController.add(notices);
      } catch (e) {
        debugPrint('Notices sync error: $e');
      }
    }, onError: (e) => debugPrint('Notices stream error: $e'));
    _subscriptions.add(sub);
  }

  void _subscribeToLiveTests() {
    final sub = _firestore
        .collection(colLiveTests)
        .where('isPublished', isEqualTo: true)
        .snapshots()
        .listen((snapshot) async {
      try {
        _rawLiveTests = snapshot.docs.map((d) => LiveTestItem.fromMap(d.data())).toList();
        _reconcileAndEmitLiveTests();
      } catch (e) {
        debugPrint('LiveTests sync error: $e');
      }
    }, onError: (e) => debugPrint('LiveTests stream error: $e'));
    _subscriptions.add(sub);
  }

  void _subscribeToAppConfig() {
    final sub = _firestore
        .collection('app_config')
        .doc('main')
        .snapshots()
        .listen((doc) async {
      try {
        if (doc.exists && doc.data() != null) {
          final config = RemoteAppConfig.fromMap(doc.data()!);
          await LocalDatabase.instance.syncRemoteConfigFromFirestore(config);
          _remoteConfigController.add(config);
        }
      } catch (e) {
        debugPrint('AppConfig sync error: $e');
      }
    }, onError: (e) => debugPrint('AppConfig stream error: $e'));
    _subscriptions.add(sub);
  }

  void _subscribeToQotd() {
    final now = DateTime.now();
    final today =
        "${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

    final sub = _firestore.collection(colQotd).snapshots().listen((snapshot) async {
      try {
        QuestionOfTheDay? found;
        // 1. Check for specific document for today
        for (final d in snapshot.docs) {
          if (d.id == today && d.data().isNotEmpty) {
            final q = QuestionOfTheDay.fromMap(d.data());
            if (q.active) {
              found = q;
              break;
            }
          }
        }
        // 2. Check 'current' document if today doc not found
        if (found == null) {
          for (final d in snapshot.docs) {
            if (d.id == 'current' && d.data().isNotEmpty) {
              final q = QuestionOfTheDay.fromMap(d.data());
              if (q.active && (q.date == today || q.date.isEmpty)) {
                found = q;
                break;
              }
            }
          }
        }

        // Cache or clear in LocalDatabase
        if (found != null) {
          await LocalDatabase.instance.syncQotdFromFirestore(found);
        } else {
          await LocalDatabase.instance.clearCachedQotd(today);
        }

        _qotdController.add(found);
      } catch (e) {
        debugPrint('QOTD sync error: $e');
      }
    }, onError: (e) => debugPrint('QOTD stream error: $e'));

    _subscriptions.add(sub);
  }

  // --- Question of the Day ---
  Future<QuestionOfTheDay?> fetchQOTD(String dateStr) async {
    try {
      final doc = await _firestore.collection(colQotd).doc(dateStr).get();
      if (doc.exists && doc.data() != null) {
        final qotd = QuestionOfTheDay.fromMap(doc.data()!);
        if (qotd.active) {
          await LocalDatabase.instance.syncQotdFromFirestore(qotd);
          return qotd;
        }
      }
      final currentDoc = await _firestore.collection(colQotd).doc('current').get();
      if (currentDoc.exists && currentDoc.data() != null) {
        final qotd = QuestionOfTheDay.fromMap(currentDoc.data()!);
        if (qotd.active && (qotd.date == dateStr || qotd.date.isEmpty)) {
          await LocalDatabase.instance.syncQotdFromFirestore(qotd);
          return qotd;
        }
      }
      // If neither exists remotely, remote deletion confirmed -> purge local cache
      await LocalDatabase.instance.clearCachedQotd(dateStr);
      return null;
    } catch (e) {
      debugPrint('Notice fetching QOTD (offline fallback): $e');
      // On genuine offline network error, fall back to offline cache
      return LocalDatabase.instance.getCachedQotd(dateStr);
    }
  }

  // --- Record Purchases & Attempts ---
  Future<void> recordPurchase({
    required String testId,
    required String testTitle,
    String? productId,
    required double amount,
    required String orderId,
    required String purchaseToken,
  }) async {
    try {
      final purchaseId = 'pur_${DateTime.now().millisecondsSinceEpoch}';
      await _firestore.collection('purchases').doc(purchaseId).set({
        'id': purchaseId,
        'testId': testId,
        'testTitle': testTitle,
        if (productId != null && productId.isNotEmpty) 'productId': productId,
        'amount': amount,
        'orderId': orderId,
        'purchaseToken': purchaseToken,
        'status': 'completed',
        'createdAt': FieldValue.serverTimestamp(),
      });
      debugPrint('Purchase $purchaseId recorded to Cloud Firestore');
    } catch (e) {
      debugPrint('Notice recording purchase: $e');
    }
  }

  Future<void> recordTestAttempt(StudentAttempt attempt) async {
    try {
      await _firestore.collection('test_attempts').doc(attempt.id).set(
        attempt.toMap()..['createdAt'] = FieldValue.serverTimestamp(),
        SetOptions(merge: true),
      );
      debugPrint('Test attempt ${attempt.id} synced to Cloud Firestore');
    } catch (e) {
      debugPrint('Notice syncing test attempt: $e');
    }
  }

  /// On-demand fetch for specific test questions to minimize Firestore reads.
  /// Called when a student opens a test — NOT on app startup.
  Future<List<Question>> fetchQuestionsForTest(List<String> questionIds) async {
    if (questionIds.isEmpty) return [];

    final localQuestions = LocalDatabase.instance.getQuestionsByIds(questionIds);
    final cachedIds = localQuestions.map((q) => q.id).toSet();
    final missingIds = questionIds.where((id) => !cachedIds.contains(id)).toList();

    if (missingIds.isEmpty || Firebase.apps.isEmpty) {
      return localQuestions;
    }

    try {
      final List<Question> fetched = [];
      // Firestore whereIn supports up to 30 elements per call
      for (var i = 0; i < missingIds.length; i += 30) {
        final chunk = missingIds.sublist(
            i, i + 30 > missingIds.length ? missingIds.length : i + 30);
        final snap = await _firestore
            .collection(colQuestions)
            .where(FieldPath.documentId, whereIn: chunk)
            .get();

        for (final doc in snap.docs) {
          fetched.add(Question.fromMap(doc.data()));
        }
      }

      if (fetched.isNotEmpty) {
        await LocalDatabase.instance.syncQuestionsFromFirestore(fetched);
      }
      return LocalDatabase.instance.getQuestionsByIds(questionIds);
    } catch (e) {
      debugPrint('Error fetching test questions on demand: $e');
      return localQuestions;
    }
  }

  /// On-demand fetch for questions belonging to an entire subject for topic listings.
  /// Strictly filters status == 'published' server-side and removes unassigned/draft cached questions.
  Future<List<Question>> fetchQuestionsForSubject(String subjectId) async {
    if (Firebase.apps.isEmpty) {
      return LocalDatabase.instance.getQuestionsBySubject(subjectId);
    }

    try {
      final snap = await _firestore
          .collection(colQuestions)
          .where('subjectId', isEqualTo: subjectId)
          .where('status', isEqualTo: 'published')
          .get();

      List<Question> fetched = snap.docs.map((d) {
        final data = d.data();
        if (data['id'] == null || (data['id'] as String).isEmpty) {
          data['id'] = d.id;
        }
        return Question.fromMap(data);
      }).toList();

      final subject = LocalDatabase.instance.getSubjectById(subjectId);
      if (fetched.isEmpty && subject != null && subject.name.isNotEmpty && subject.name != subjectId) {
        final snapName = await _firestore
            .collection(colQuestions)
            .where('subject', isEqualTo: subject.name)
            .where('status', isEqualTo: 'published')
            .get();
        if (snapName.docs.isNotEmpty) {
          fetched = snapName.docs.map((d) {
            final data = d.data();
            if (data['id'] == null || (data['id'] as String).isEmpty) {
              data['id'] = d.id;
            }
            return Question.fromMap(data);
          }).toList();
        }
      }

      // Sync subject questions into local database
      await LocalDatabase.instance.syncSubjectQuestionsFromFirestore(subjectId, fetched);
      _practiceQuestionsController.add(LocalDatabase.instance.getAllQuestions());
      return LocalDatabase.instance.getQuestionsBySubject(subjectId);
    } catch (e) {
      debugPrint('Error fetching subject questions on demand: $e');
      return LocalDatabase.instance.getQuestionsBySubject(subjectId);
    }
  }

  /// On-demand fetch for questions belonging to a specific topic for MCQ practice.
  /// Strictly filters status == 'published' server-side and removes unassigned/draft cached questions.
  Future<List<Question>> fetchQuestionsForTopic(String topicId) async {
    if (Firebase.apps.isEmpty) {
      return LocalDatabase.instance.getQuestionsByTopic(topicId);
    }

    try {
      final snap = await _firestore
          .collection(colQuestions)
          .where('topicId', isEqualTo: topicId)
          .where('status', isEqualTo: 'published')
          .get();

      List<Question> fetched = snap.docs.map((d) {
        final data = d.data();
        if (data['id'] == null || (data['id'] as String).isEmpty) {
          data['id'] = d.id;
        }
        return Question.fromMap(data);
      }).toList();

      final topic = LocalDatabase.instance.getTopicById(topicId);
      if (fetched.isEmpty && topic != null && topic.name.isNotEmpty && topic.name != topicId) {
        final snapName = await _firestore
            .collection(colQuestions)
            .where('topic', isEqualTo: topic.name)
            .where('status', isEqualTo: 'published')
            .get();
        if (snapName.docs.isNotEmpty) {
          fetched = snapName.docs.map((d) {
            final data = d.data();
            if (data['id'] == null || (data['id'] as String).isEmpty) {
              data['id'] = d.id;
            }
            return Question.fromMap(data);
          }).toList();
        }
      }

      // Sync topic questions: adds/updates published and invalidates stale draft cache
      await LocalDatabase.instance.syncTopicQuestionsFromFirestore(topicId, fetched);
      return LocalDatabase.instance.getQuestionsByTopic(topicId);
    } catch (e) {
      debugPrint('Error fetching topic questions on demand: $e');
      return LocalDatabase.instance.getQuestionsByTopic(topicId);
    }
  }

  // --- Global Practice Session Stats ---

  /// Fetches global practice session stats for all topics in a single efficient collection read.
  /// Caches the results in LocalDatabase for instant 60 FPS offline access.
  Future<Map<String, int>> fetchAllTopicPracticeStats() async {
    if (Firebase.apps.isEmpty) {
      return {};
    }
    try {
      final snap = await _firestore.collection(colPracticeTopicStats).get();
      final Map<String, int> counts = {};
      for (final doc in snap.docs) {
        final data = doc.data();
        final sessions = (data['totalSessions'] as num?)?.toInt() ?? 0;
        counts[doc.id] = sessions;
      }
      await LocalDatabase.instance.setTopicSessionCounts(counts);
      return counts;
    } catch (e) {
      debugPrint('Error fetching topic practice stats: $e');
      return {};
    }
  }

  /// Commits a single practice session increment atomically using a batched write:
  /// 1. Creates an immutable session document under /practice_topic_stats/{topicId}/sessions/{sessionId}
  /// 2. Increments totalSessions by exactly 1 on /practice_topic_stats/{topicId}
  Future<bool> commitPracticeSessionIncrement({
    required String topicId,
    required String sessionId,
    required String installationId,
  }) async {
    if (Firebase.apps.isEmpty) {
      return false;
    }
    try {
      final tid = topicId.trim();
      final sid = sessionId.trim();
      final statsRef = _firestore.collection(colPracticeTopicStats).doc(tid);
      final sessionRef = statsRef.collection('sessions').doc(sid);

      final batch = _firestore.batch();
      batch.set(sessionRef, {
        'sessionId': sid,
        'topicId': tid,
        'installationId': installationId,
        'createdAt': FieldValue.serverTimestamp(),
      });
      batch.set(statsRef, {
        'topicId': tid,
        'totalSessions': FieldValue.increment(1),
        'updatedAt': FieldValue.serverTimestamp(),
        'lastSessionId': sid,
      }, SetOptions(merge: true));

      await batch.commit();
      return true;
    } catch (e) {
      debugPrint('Error committing practice session increment for $topicId ($sessionId): $e');
      return false;
    }
  }

  /// Flushes any locally queued offline practice sessions to Firestore.
  /// Exactly-once client behavior: successfully committed sessions are marked as synced.
  Future<void> syncPendingPracticeSessions() async {
    if (Firebase.apps.isEmpty) return;

    final pending = LocalDatabase.instance.getPendingPracticeSessions();
    if (pending.isEmpty) return;

    for (final event in pending) {
      final tid = event['topicId'] as String?;
      final sid = event['sessionId'] as String?;
      final iid = event['installationId'] as String?;
      if (tid == null || sid == null || iid == null) continue;

      final success = await commitPracticeSessionIncrement(
        topicId: tid,
        sessionId: sid,
        installationId: iid,
      );
      if (success) {
        await LocalDatabase.instance.markPracticeSessionSynced(sid);
      } else {
        // Stop flushing on network error to preserve queue order and prevent excessive retries
        break;
      }
    }
  }

  /// Registers and starts a new practice session:
  /// 1. Enqueues locally (optimistic local counter increment with 0ms lag)
  /// 2. Triggers background atomic commit to Firestore (never blocks the student UI)
  Future<void> recordNewPracticeSession({
    required String topicId,
    required String sessionId,
  }) async {
    final tid = topicId.trim();
    final sid = sessionId.trim();
    if (sid.isEmpty || LocalDatabase.instance.isPracticeSessionRecorded(sid)) return;

    // 1. Enqueue & update local database optimistically
    await LocalDatabase.instance.enqueuePracticeSession(
      topicId: tid,
      sessionId: sid,
    );

    // 2. Attempt asynchronous network commit (non-blocking)
    final iid = LocalDatabase.instance.installationId;
    commitPracticeSessionIncrement(
      topicId: tid,
      sessionId: sid,
      installationId: iid,
    ).then((success) {
      if (success) {
        LocalDatabase.instance.markPracticeSessionSynced(sid);
      }
    }).catchError((e) {
      debugPrint('Background session commit failed, remains in offline queue: $e');
    });
  }

  // --- Live Test Registrations & Trusted Time ---
  Duration _serverTimeOffset = Duration.zero;

  void updateServerTimeOffset(DateTime serverTime) {
    _serverTimeOffset = serverTime.difference(DateTime.now());
  }

  DateTime getTrustedNow() {
    return DateTime.now().add(_serverTimeOffset);
  }

  /// Submits student registration for a live test.
  /// Note & Security Disclosure: The student app is unauthenticated / login-free.
  /// installationId is a pseudonymous device identifier, NOT a verified identity.
  Future<bool> registerForLiveTest(LiveTestRegistration registration) async {
    if (Firebase.apps.isEmpty) return false;
    try {
      final ref = _firestore
          .collection(colLiveTests)
          .doc(registration.liveTestId)
          .collection('registrations')
          .doc(registration.id);

      final map = registration.toMap();
      map['registeredAt'] = FieldValue.serverTimestamp();

      await ref.set(map);
      return true;
    } catch (e) {
      debugPrint('Error registering for live test: $e');
      return false;
    }
  }

  /// Updates registration status: REGISTERED -> STARTED -> SUBMITTED.
  Future<bool> updateLiveTestRegistrationStatus(
    String liveTestId,
    String registrationId,
    String status, {
    DateTime? startedAt,
    DateTime? submittedAt,
    double? score,
  }) async {
    if (Firebase.apps.isEmpty) return false;
    try {
      final ref = _firestore
          .collection(colLiveTests)
          .doc(liveTestId)
          .collection('registrations')
          .doc(registrationId);

      final Map<String, dynamic> updateData = {'status': status};
      if (status == 'STARTED') {
        updateData['startedAt'] = FieldValue.serverTimestamp();
      } else if (status == 'SUBMITTED') {
        updateData['submittedAt'] = FieldValue.serverTimestamp();
        if (score != null) updateData['score'] = score;
      }

      await ref.update(updateData);
      return true;
    } catch (e) {
      debugPrint('Error updating registration status: $e');
      return false;
    }
  }

  // ============================================================================
  // PHASE A: LMS CLOUD FIRESTORE ACCESSORS & DRAFT-ISOLATED SYNC
  // ============================================================================

  // --- 1. Test Series ---
  Future<List<TestSeries>> fetchTestSeries({String? examCode, bool allowDraft = false}) async {
    if (Firebase.apps.isEmpty) return [];
    try {
      final snap = await _firestore.collection(colTestSeries).get();
      return snap.docs
          .map((d) => TestSeries.fromMap({...d.data(), 'id': d.id}))
          .where((s) {
            if (!allowDraft && !s.isPublished) return false;
            if (examCode != null && examCode.isNotEmpty && examCode.toUpperCase() != 'ALL') {
              if (s.examCode.toUpperCase() != examCode.toUpperCase()) return false;
            }
            return true;
          })
          .toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    } catch (e) {
      debugPrint('Error fetching test series: $e');
      return [];
    }
  }

  Future<List<TestSeriesFolder>> fetchTestSeriesFolders(String seriesId, {bool allowDraft = false}) async {
    if (Firebase.apps.isEmpty) return [];
    try {
      final snap = await _firestore
          .collection(colTestSeries)
          .doc(seriesId)
          .collection('folders')
          .get();
      return snap.docs
          .map((d) => TestSeriesFolder.fromMap({...d.data(), 'id': d.id, 'seriesId': seriesId}))
          .where((f) => allowDraft || f.isPublished)
          .toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    } catch (e) {
      debugPrint('Error fetching test series folders for $seriesId: $e');
      return [];
    }
  }

  Future<List<TestSeriesItem>> fetchTestSeriesItems(String seriesId, String folderId, {bool allowDraft = false}) async {
    if (Firebase.apps.isEmpty) return [];
    try {
      final snap = await _firestore
          .collection(colTestSeries)
          .doc(seriesId)
          .collection('folders')
          .doc(folderId)
          .collection('items')
          .get();
      return snap.docs
          .map((d) => TestSeriesItem.fromMap({
                ...d.data(),
                'id': d.id,
                'seriesId': seriesId,
                'folderId': folderId,
              }))
          .where((i) => allowDraft || i.isPublished)
          .toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    } catch (e) {
      debugPrint('Error fetching test series items: $e');
      return [];
    }
  }

  // --- 2. Study Library ---
  Future<List<StudyFolder>> fetchStudyFolders({String? examCode, bool allowDraft = false}) async {
    if (Firebase.apps.isEmpty) return [];
    try {
      final snap = await _firestore.collection(colStudyFolders).get();
      return snap.docs
          .map((d) => StudyFolder.fromMap({...d.data(), 'id': d.id}))
          .where((f) {
            if (!allowDraft && !f.isPublished) return false;
            if (examCode != null && examCode.isNotEmpty && examCode.toUpperCase() != 'ALL') {
              if (f.examCode.toUpperCase() != examCode.toUpperCase()) return false;
            }
            return true;
          })
          .toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    } catch (e) {
      debugPrint('Error fetching study folders: $e');
      return [];
    }
  }

  Future<List<StudyMaterial>> fetchStudyMaterials({String? folderId, String? examCode, bool allowDraft = false}) async {
    if (Firebase.apps.isEmpty) return [];
    try {
      Query query = _firestore.collection(colStudyMaterials);
      if (folderId != null && folderId.isNotEmpty) {
        query = query.where('folderId', isEqualTo: folderId);
      }
      final snap = await query.get();
      return snap.docs
          .map((d) => StudyMaterial.fromMap({...d.data() as Map<String, dynamic>, 'id': d.id}))
          .where((m) {
            if (!allowDraft && !m.isPublished) return false;
            if (examCode != null && examCode.isNotEmpty && examCode.toUpperCase() != 'ALL') {
              if (m.examCode.toUpperCase() != examCode.toUpperCase()) return false;
            }
            return true;
          })
          .toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    } catch (e) {
      debugPrint('Error fetching study materials: $e');
      return [];
    }
  }

  // --- 3. Battle Mode ---
  Future<List<BattleItem>> fetchBattles({String? examCode}) async {
    if (Firebase.apps.isEmpty) return [];
    try {
      final snap = await _firestore.collection(colBattles).get();
      return snap.docs
          .map((d) => BattleItem.fromMap({...d.data(), 'id': d.id}))
          .where((b) {
            if (!b.isPublished) return false;
            if (examCode != null && examCode.isNotEmpty && examCode.toUpperCase() != 'ALL') {
              if (b.examCode.toUpperCase() != examCode.toUpperCase()) return false;
            }
            return true;
          })
          .toList()
        ..sort((a, b) => a.startAt.compareTo(b.startAt));
    } catch (e) {
      debugPrint('Error fetching battles: $e');
      return [];
    }
  }

  Future<bool> registerForBattle(BattleRegistration registration) async {
    if (Firebase.apps.isEmpty) return false;
    try {
      final ref = _firestore
          .collection(colBattles)
          .doc(registration.battleId)
          .collection('registrations')
          .doc(registration.id);

      final map = registration.toMap();
      map['registeredAt'] = FieldValue.serverTimestamp();

      await ref.set(map);
      return true;
    } catch (e) {
      debugPrint('Error registering for battle: $e');
      return false;
    }
  }

  Future<bool> updateBattleRegistrationStatus(
    String battleId,
    String registrationId,
    String status, {
    int? timeTakenSeconds,
    double? score,
    double? accuracy,
  }) async {
    if (Firebase.apps.isEmpty) return false;
    try {
      final ref = _firestore
          .collection(colBattles)
          .doc(battleId)
          .collection('registrations')
          .doc(registrationId);

      final Map<String, dynamic> updateData = {'status': status};
      if (status == 'STARTED' || status == 'LOBBY') {
        updateData['startedAt'] = FieldValue.serverTimestamp();
      } else if (status == 'SUBMITTED') {
        updateData['submittedAt'] = FieldValue.serverTimestamp();
        if (score != null) updateData['score'] = score;
        if (accuracy != null) updateData['accuracy'] = accuracy;
        if (timeTakenSeconds != null) updateData['timeTakenSeconds'] = timeTakenSeconds;
      }

      await ref.update(updateData);
      return true;
    } catch (e) {
      debugPrint('Error updating battle registration status: $e');
      return false;
    }
  }

  // --- 4. Question Reporting System ---
  Future<bool> submitQuestionReport(QuestionReport report) async {
    if (Firebase.apps.isEmpty) return false;

    // Client-side cooldown (60 seconds per question to protect network and prevent spam)
    final lastReported = _reportCooldowns[report.questionId];
    if (lastReported != null && DateTime.now().difference(lastReported).inSeconds < 60) {
      debugPrint('Report throttled: already reported question ${report.questionId} within 60s cooldown.');
      return false;
    }

    try {
      final ref = _firestore.collection(colQuestionReports).doc(report.id);
      final map = report.toMap();
      map['createdAt'] = FieldValue.serverTimestamp();
      await ref.set(map);
      _reportCooldowns[report.questionId] = DateTime.now();
      return true;
    } catch (e) {
      debugPrint('Error submitting question report: $e');
      return false;
    }
  }

  // --- 5. Career Goals ---
  Future<List<CareerGoal>> fetchCareerGoals({String? examCode, bool allowDraft = false}) async {
    if (Firebase.apps.isEmpty) return [];
    try {
      final snap = await _firestore.collection(colCareerGoals).get();
      return snap.docs
          .map((d) => CareerGoal.fromMap({...d.data(), 'id': d.id}))
          .where((g) {
            if (!allowDraft && !g.isPublished) return false;
            if (examCode != null && examCode.isNotEmpty && examCode.toUpperCase() != 'ALL') {
              if (g.examCode.toUpperCase() != examCode.toUpperCase()) return false;
            }
            return true;
          })
          .toList();
    } catch (e) {
      debugPrint('Error fetching career goals: $e');
      return [];
    }
  }

  // --- 6. Current Affairs ---
  Future<List<CurrentAffairsItem>> fetchCurrentAffairs({String? category, bool allowDraft = false}) async {
    if (Firebase.apps.isEmpty) return [];
    try {
      final snap = await _firestore.collection(colCurrentAffairs).get();
      return snap.docs
          .map((d) => CurrentAffairsItem.fromMap({...d.data(), 'id': d.id}))
          .where((a) {
            if (!allowDraft && !a.isPublished) return false;
            if (category != null && category.isNotEmpty && category.toUpperCase() != 'ALL') {
              if (a.category.toUpperCase() != category.toUpperCase()) return false;
            }
            return true;
          })
          .toList()
        ..sort((a, b) => b.publishDate.compareTo(a.publishDate));
    } catch (e) {
      debugPrint('Error fetching current affairs: $e');
      return [];
    }
  }

  // --- 7. Dynamic Home Sections ---
  Future<List<HomeSectionConfig>> fetchHomeSections() async {
    if (Firebase.apps.isEmpty) return LocalDatabase.getDefaultHomeSections();
    try {
      final snap = await _firestore.collection(colHomeSections).get();
      if (snap.docs.isEmpty) {
        return LocalDatabase.getDefaultHomeSections();
      }
      return snap.docs
          .map((d) => HomeSectionConfig.fromMap({...d.data(), 'id': d.id}))
          .toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    } catch (e) {
      debugPrint('Error fetching home sections: $e');
      return LocalDatabase.getDefaultHomeSections();
    }
  }

  void disposeSync() {
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    _subscriptions.clear();
    _syncStarted = false;
  }
}

