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
  static const String colQuestions = 'questions';
  static const String colExams = 'exams';
  static const String colSubjects = 'subjects';
  static const String colTopics = 'topics';
  static const String colMocks = 'mocks';
  static const String colLiveTests = 'live_tests';
  static const String colQotd = 'qotd';

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

  // --- Real-time Sync for Android App & Offline Cache ---
  void initRealtimeSync({void Function(List<Question>)? onSync}) {
    if (Firebase.apps.isEmpty) {
      debugPrint('Firebase not initialized; running in offline local mode.');
      return;
    }
    // Avoid multiple subscriptions
    _questionsSubscription?.cancel();

    try {
      _questionsSubscription = _firestore
          .collection(colQuestions)
          .snapshots()
          .listen(
        (snapshot) {
          if (snapshot.docs.isNotEmpty) {
            final cloudQuestions = snapshot.docs
                .map((doc) => Question.fromMap(doc.data()))
                .toList();

            LocalDatabase.instance.syncQuestionsFromFirestore(cloudQuestions);
            onSync?.call(cloudQuestions);
            debugPrint('Synced ${cloudQuestions.length} questions from Cloud Firestore');
          }
        },
        onError: (err) {
          debugPrint('Firestore real-time sync stream notice: $err');
        },
      );
    } catch (e) {
      debugPrint('Firestore real-time sync init notice: $e');
    }
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
