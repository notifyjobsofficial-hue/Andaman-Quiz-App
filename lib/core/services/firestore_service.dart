import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import '../database/local_database.dart';
import '../database/seed_data.dart';
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

  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? _questionsSubscription;

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
      return snapshot.docs.map((doc) {
        return Question.fromMap(doc.data());
      }).toList();
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
  Future<void> saveMockTest(MockTest mockTest) async {
    try {
      await _firestore
          .collection(colMocks)
          .doc(mockTest.id)
          .set(mockTest.toMap(), SetOptions(merge: true));
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

  // --- Cost-Optimized Real-time Sync & On-Demand Question Fetching ---
  Future<void> syncAppCatalog() async {
    if (Firebase.apps.isEmpty) return;

    try {
      // 1. Categories
      final catSnap = await _firestore.collection(colCategories).where('isActive', isEqualTo: true).get();
      if (catSnap.docs.isNotEmpty) {
        final cats = catSnap.docs.map((d) => ExamCategory.fromMap(d.data())).toList();
        cats.sort((a, b) => a.order.compareTo(b.order));
        await LocalDatabase.instance.syncCategoriesFromFirestore(cats);
      }

      // 2. Exams
      final examSnap = await _firestore.collection(colExams).get();
      if (examSnap.docs.isNotEmpty) {
        final exams = examSnap.docs.map((d) => Exam.fromMap(d.data())).toList();
        await LocalDatabase.instance.syncExamsFromFirestore(exams);
      }

      // 3. Subjects
      final subSnap = await _firestore.collection(colSubjects).get();
      if (subSnap.docs.isNotEmpty) {
        final subs = subSnap.docs.map((d) => Subject.fromMap(d.data())).toList();
        await LocalDatabase.instance.syncSubjectsFromFirestore(subs);
      }

      // 4. Mock Tests (published only)
      final mockSnap = await _firestore.collection(colMocks).where('status', isEqualTo: 'published').get();
      if (mockSnap.docs.isNotEmpty) {
        final mocks = mockSnap.docs.map((d) => MockTest.fromMap(d.data())).toList();
        await LocalDatabase.instance.syncMockTestsFromFirestore(mocks);
      }

      // 5. Banners
      final bannerSnap = await _firestore.collection(colBanners).where('active', isEqualTo: true).get();
      if (bannerSnap.docs.isNotEmpty) {
        final banners = bannerSnap.docs.map((d) => HomeBanner.fromMap(d.data())).toList();
        banners.sort((a, b) => a.order.compareTo(b.order));
        await LocalDatabase.instance.syncBannersFromFirestore(banners);
      }

      // 6. Notices
      final noticeSnap = await _firestore.collection(colNotices).where('active', isEqualTo: true).get();
      if (noticeSnap.docs.isNotEmpty) {
        final notices = noticeSnap.docs.map((d) => AppNotice.fromMap(d.data())).toList();
        await LocalDatabase.instance.syncNoticesFromFirestore(notices);
      }

      // 7. Remote App Config & AdMob settings
      final configDoc = await _firestore.collection('app_config').doc('main').get();
      if (configDoc.exists && configDoc.data() != null) {
        final config = RemoteAppConfig.fromMap(configDoc.data()!);
        await LocalDatabase.instance.syncRemoteConfigFromFirestore(config);
      }

      debugPrint('Andaman Quiz app catalog synchronized with Cloud Firestore.');
    } catch (e) {
      debugPrint('Notice during catalog sync (running in local offline mode): $e');
    }
  }

  // --- Question of the Day ---
  Future<QuestionOfTheDay?> fetchQOTD(String dateStr) async {
    try {
      final doc = await _firestore.collection(colQotd).doc(dateStr).get();
      if (doc.exists && doc.data() != null) {
        return QuestionOfTheDay.fromMap(doc.data()!);
      }
      return null;
    } catch (e) {
      debugPrint('Notice fetching QOTD: $e');
      return null;
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

  /// On-demand fetch for specific test questions to minimize Firestore reads
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
      // Firestore whereIn supports up to 30 elements
      for (var i = 0; i < missingIds.length; i += 30) {
        final chunk = missingIds.sublist(i, i + 30 > missingIds.length ? missingIds.length : i + 30);
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

  void initRealtimeSync({void Function(List<Question>)? onSync}) {
    if (Firebase.apps.isEmpty) {
      debugPrint('Firebase not initialized; running in offline local mode.');
      return;
    }

    // Cost-optimized catalog sync on launch
    syncAppCatalog();
  }

  void disposeSync() {
    _questionsSubscription?.cancel();
    _questionsSubscription = null;
  }

  // --- One-Click Initial Cloud Seeder (Populate empty Firestore) ---
  Future<int> seedInitialDataToFirestore() async {
    int count = 0;
    try {
      final batch = _firestore.batch();

      // Seed Exams
      for (final exam in SeedData.exams) {
        final docRef = _firestore.collection(colExams).doc(exam.id);
        batch.set(docRef, exam.toMap(), SetOptions(merge: true));
      }

      // Seed Subjects
      for (final sub in SeedData.subjects) {
        final docRef = _firestore.collection(colSubjects).doc(sub.id);
        batch.set(docRef, sub.toMap(), SetOptions(merge: true));
      }

      // Seed Topics
      for (final top in SeedData.topics) {
        final docRef = _firestore.collection(colTopics).doc(top.id);
        batch.set(docRef, top.toMap(), SetOptions(merge: true));
      }

      // Seed Mock Tests
      for (final mock in SeedData.mockTests) {
        final docRef = _firestore.collection(colMocks).doc(mock.id);
        batch.set(docRef, mock.toMap(), SetOptions(merge: true));
      }

      // Seed Questions
      for (final q in SeedData.questions) {
        final docRef = _firestore.collection(colQuestions).doc(q.id);
        batch.set(docRef, q.toMap(), SetOptions(merge: true));
        count++;
      }

      await batch.commit();
      debugPrint('Successfully seeded $count questions and catalog to Cloud Firestore');
      return count;
    } catch (e) {
      debugPrint('Error seeding data to Firestore: $e');
      rethrow;
    }
  }
}
