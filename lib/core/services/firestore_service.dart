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
  Future<MockTest?> fetchMockTest(String testId) async {
    if (testId.trim().isEmpty) return null;
    try {
      final docMocks = await _firestore.collection(colMocks).doc(testId).get();
      if (docMocks.exists && docMocks.data() != null) {
        final data = docMocks.data()!;
        data['id'] = docMocks.id;
        return MockTest.fromMap(data);
      }
      final docMockTests = await _firestore.collection('mock_tests').doc(testId).get();
      if (docMockTests.exists && docMockTests.data() != null) {
        final data = docMockTests.data()!;
        data['id'] = docMockTests.id;
        return MockTest.fromMap(data);
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

    debugPrint('FirestoreService: real-time listeners started for all collections.');
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

  void _subscribeToMockTests() {
    final Map<String, MockTest> mergedMocks = {};

    void updateAndSync() async {
      final list = mergedMocks.values
          .where((m) => m.status.toLowerCase() == 'published')
          .toList()
        ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
      await LocalDatabase.instance.syncMockTestsFromFirestore(list);
      _mockTestsController.add(list);
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
        final tests = snapshot.docs.map((d) => LiveTestItem.fromMap(d.data())).toList();
        await LocalDatabase.instance.syncLiveTestsFromFirestore(tests);
        _liveTestsController.add(tests);
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

  /// On-demand fetch for questions belonging to a specific topic for MCQ practice.
  Future<List<Question>> fetchQuestionsForTopic(String topicId) async {
    if (Firebase.apps.isEmpty) {
      return LocalDatabase.instance.getQuestionsByTopic(topicId);
    }

    // Check local cache first
    final cached = LocalDatabase.instance.getQuestionsByTopic(topicId);
    if (cached.isNotEmpty) return cached;

    try {
      final snap = await _firestore
          .collection(colQuestions)
          .where('topicId', isEqualTo: topicId)
          .get();

      List<Question> fetched = snap.docs.map((d) => Question.fromMap(d.data())).toList();

      final topic = LocalDatabase.instance.getTopicById(topicId);
      if (fetched.isEmpty && topic != null && topic.name.isNotEmpty && topic.name != topicId) {
        final snapName = await _firestore
            .collection(colQuestions)
            .where('topic', isEqualTo: topic.name)
            .get();
        if (snapName.docs.isNotEmpty) {
          fetched = snapName.docs.map((d) => Question.fromMap(d.data())).toList();
        }
      }

      if (fetched.isNotEmpty) {
        await LocalDatabase.instance.syncQuestionsFromFirestore(fetched);
      }
      return LocalDatabase.instance.getQuestionsByTopic(topicId);
    } catch (e) {
      debugPrint('Error fetching topic questions on demand: $e');
      return cached;
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
