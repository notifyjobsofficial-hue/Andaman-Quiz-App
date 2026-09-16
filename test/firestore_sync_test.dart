import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Firestore Integration & Sync Verification Tests', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await LocalDatabase.instance.init();
    });

    test('Question model serializes to and from Firestore map seamlessly', () {
      const q = Question(
        id: 'q_an_test_firestore',
        subjectId: 'sub_an_gk',
        topicId: 'top_an_history',
        examTags: ['CGL', 'POLICE'],
        questionEn: 'Which year was the Ross Island penal colony established?',
        questionHi: 'रॉस द्वीप दंड कॉलोनी किस वर्ष स्थापित की गई थी?',
        optionsEn: ['1858', '1865', '1872', '1880'],
        optionsHi: ['1858', '1865', '1872', '1880'],
        correctIndex: 0,
        explanationEn: 'Established in 1858 following the First War of Independence.',
        explanationHi: '1857 के प्रथम स्वतंत्रता संग्राम के बाद 1858 में स्थापित।',
      );

      final map = q.toMap();
      expect(map['id'], 'q_an_test_firestore');
      expect(map['questionEn'], contains('Ross Island'));
      expect(map['correctIndex'], 0);
      expect(map['optionsEn'].length, 4);

      final deserialized = Question.fromMap(map);
      expect(deserialized.id, q.id);
      expect(deserialized.questionEn, q.questionEn);
      expect(deserialized.optionsEn[0], '1858');
    });

    test('Flow Verification: Admin adds 1 question -> Firestore saves -> Android app displays it', () async {
      // 1. Initial State: App starts with pre-seeded questions
      final initialCount = LocalDatabase.instance.getAllQuestions().length;
      expect(initialCount > 0, true);

      // 2. Admin creates a new question in Control Center
      const newAdminQuestion = Question(
        id: 'q_sync_admin_verified_01',
        subjectId: 'sub_an_gk',
        topicId: 'top_an_history',
        examTags: ['CGL', 'CHSL', 'POLICE'],
        questionEn: 'Which Andaman island is named Netaji Subhash Chandra Bose Dweep?',
        questionHi: 'किस अंडमान द्वीप का नाम नेताजी सुभाष चंद्र बोस द्वीप रखा गया है?',
        optionsEn: ['Ross Island', 'Neil Island', 'Havelock Island', 'Viper Island'],
        optionsHi: ['रॉस द्वीप', 'नील द्वीप', 'हैवलॉक द्वीप', 'वाइपर द्वीप'],
        correctIndex: 0,
        explanationEn: 'Ross Island was officially renamed Netaji Subhash Chandra Bose Dweep in 2018.',
        explanationHi: '2018 में रॉस द्वीप का नाम बदलकर नेताजी सुभाष चंद्र बोस द्वीप किया गया।',
      );

      // 3. Firestore Document representation is generated
      final firestoreDoc = newAdminQuestion.toMap();
      expect(firestoreDoc.isNotEmpty, true);

      // 4. Android App Sync Service receives Firestore stream snapshot
      final incomingCloudQuestions = [Question.fromMap(firestoreDoc)];
      await LocalDatabase.instance.syncQuestionsFromFirestore(incomingCloudQuestions);

      // 5. Verify Android App displays and queries the newly synced question
      final updatedQuestions = LocalDatabase.instance.getAllQuestions();
      expect(updatedQuestions.length, initialCount + 1);

      final fetched = LocalDatabase.instance.getQuestionsByIds(['q_sync_admin_verified_01']);
      expect(fetched.isNotEmpty, true);
      expect(fetched.first.questionEn, 'Which Andaman island is named Netaji Subhash Chandra Bose Dweep?');
      expect(fetched.first.optionsEn[0], 'Ross Island');

      // Verify subject and topic filtering in Android UI
      final subjectQuestions = LocalDatabase.instance.getQuestionsBySubject('sub_an_gk');
      expect(subjectQuestions.any((q) => q.id == 'q_sync_admin_verified_01'), true);

      final topicQuestions = LocalDatabase.instance.getQuestionsByTopic('top_an_history');
      expect(topicQuestions.any((q) => q.id == 'q_sync_admin_verified_01'), true);
    });

    test('Sync preserves student local bookmarks and wrong questions', () async {
      final questions = LocalDatabase.instance.getAllQuestions();
      final targetQ = questions.first;

      // Student bookmarks a question locally without login
      await LocalDatabase.instance.toggleBookmark(targetQ.id);
      expect(LocalDatabase.instance.isBookmarked(targetQ.id), true);

      // Cloud sends updated question data
      final updatedFromCloud = targetQ.copyWith(isBookmarked: false); // cloud doesn't store student's bookmark
      await LocalDatabase.instance.syncQuestionsFromFirestore([updatedFromCloud]);

      // Android app still retains the student bookmark locally
      expect(LocalDatabase.instance.isBookmarked(targetQ.id), true);
    });
  });
}
