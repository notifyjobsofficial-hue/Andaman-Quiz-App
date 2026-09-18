import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../database/local_database.dart';
import '../models/models.dart';
import '../services/firestore_service.dart';

// ---------------------------------------------------------------------------
// Reactive Stream Providers (Firestore real-time → UI auto-rebuilds)
// ---------------------------------------------------------------------------

/// Emits a new list every time Firestore categories change.
/// Seeds from LocalDatabase so the UI renders instantly offline.
final categoriesStreamProvider = StreamProvider<List<ExamCategory>>((ref) async* {
  // Emit cached state immediately so the UI isn't blank on first frame
  yield LocalDatabase.instance.getCategories();
  // Then yield real-time Firestore updates
  yield* FirestoreService.instance.categoriesStream;
});

final examsStreamProvider = StreamProvider<List<Exam>>((ref) async* {
  yield LocalDatabase.instance.getExams();
  yield* FirestoreService.instance.examsStream;
});

final subjectsStreamProvider = StreamProvider<List<Subject>>((ref) async* {
  yield LocalDatabase.instance.getSubjects();
  yield* FirestoreService.instance.subjectsStream;
});

final topicsStreamProvider = StreamProvider<List<Topic>>((ref) async* {
  yield LocalDatabase.instance.getTopics();
  yield* FirestoreService.instance.topicsStream;
});

final mockTestsStreamProvider = StreamProvider<List<MockTest>>((ref) async* {
  yield LocalDatabase.instance.getMockTests();
  yield* FirestoreService.instance.mockTestsStream;
});

final bannersStreamProvider = StreamProvider<List<HomeBanner>>((ref) async* {
  yield LocalDatabase.instance.getBanners();
  yield* FirestoreService.instance.bannersStream;
});

final noticesStreamProvider = StreamProvider<List<AppNotice>>((ref) async* {
  yield LocalDatabase.instance.getNotices();
  yield* FirestoreService.instance.noticesStream;
});

final remoteConfigStreamProvider = StreamProvider<RemoteAppConfig>((ref) async* {
  yield LocalDatabase.instance.getRemoteConfig();
  yield* FirestoreService.instance.remoteConfigStream;
});

// ---------------------------------------------------------------------------
// User Preferences (selected exam, language)
// ---------------------------------------------------------------------------

class SelectedExamNotifier extends Notifier<String> {
  @override
  String build() => LocalDatabase.instance.getSelectedExam();

  Future<void> setExam(String examCode) async {
    state = examCode;
    await LocalDatabase.instance.setSelectedExam(examCode);
  }
}

final selectedExamProvider =
    NotifierProvider<SelectedExamNotifier, String>(SelectedExamNotifier.new);

class SelectedLanguageNotifier extends Notifier<String> {
  @override
  String build() => LocalDatabase.instance.getSelectedLanguage();

  Future<void> setLanguage(String lang) async {
    state = lang;
    await LocalDatabase.instance.setSelectedLanguage(lang);
  }
}

final selectedLanguageProvider =
    NotifierProvider<SelectedLanguageNotifier, String>(SelectedLanguageNotifier.new);

// ---------------------------------------------------------------------------
// Home Statistics (computed from genuine attempts only)
// ---------------------------------------------------------------------------

class StreakNotifier extends Notifier<int> {
  @override
  int build() => LocalDatabase.instance.getStreakDays();
  void refresh() => state = LocalDatabase.instance.getStreakDays();
}

final streakProvider = NotifierProvider<StreakNotifier, int>(StreakNotifier.new);

class AccuracyNotifier extends Notifier<int> {
  @override
  int build() => LocalDatabase.instance.getAccuracyPercentage();
  void refresh() => state = LocalDatabase.instance.getAccuracyPercentage();
}

final accuracyProvider = NotifierProvider<AccuracyNotifier, int>(AccuracyNotifier.new);

class TotalQuestionsCountNotifier extends Notifier<int> {
  @override
  int build() => LocalDatabase.instance.getTotalQuestionsCount();
  void refresh() => state = LocalDatabase.instance.getTotalQuestionsCount();
}

final totalQuestionsCountProvider =
    NotifierProvider<TotalQuestionsCountNotifier, int>(TotalQuestionsCountNotifier.new);

// ---------------------------------------------------------------------------
// Bookmarks & Wrong Questions
// ---------------------------------------------------------------------------

class BookmarksNotifier extends Notifier<List<Question>> {
  @override
  List<Question> build() => LocalDatabase.instance.getBookmarkedQuestions();

  void refresh() {
    state = LocalDatabase.instance.getBookmarkedQuestions();
  }

  Future<bool> toggle(String questionId) async {
    final res = await LocalDatabase.instance.toggleBookmark(questionId);
    refresh();
    return res;
  }
}

final bookmarksProvider =
    NotifierProvider<BookmarksNotifier, List<Question>>(BookmarksNotifier.new);

class WrongQuestionsNotifier extends Notifier<List<Question>> {
  @override
  List<Question> build() => LocalDatabase.instance.getWrongQuestions();

  void refresh() {
    state = LocalDatabase.instance.getWrongQuestions();
  }
}

final wrongQuestionsProvider =
    NotifierProvider<WrongQuestionsNotifier, List<Question>>(WrongQuestionsNotifier.new);

// ---------------------------------------------------------------------------
// Student Attempts
// ---------------------------------------------------------------------------

class StudentAttemptsNotifier extends Notifier<List<StudentAttempt>> {
  @override
  List<StudentAttempt> build() => LocalDatabase.instance.getAttempts();

  void refresh() {
    state = LocalDatabase.instance.getAttempts();
  }

  Future<void> record(StudentAttempt attempt) async {
    await LocalDatabase.instance.recordAttempt(attempt);
    refresh();
  }
}

final studentAttemptsProvider =
    NotifierProvider<StudentAttemptsNotifier, List<StudentAttempt>>(StudentAttemptsNotifier.new);

// ---------------------------------------------------------------------------
// Sound & Haptics
// ---------------------------------------------------------------------------

class SoundHapticsNotifier extends Notifier<bool> {
  @override
  bool build() => true;
  void toggle(bool val) => state = val;
}

final soundHapticsProvider =
    NotifierProvider<SoundHapticsNotifier, bool>(SoundHapticsNotifier.new);

// ---------------------------------------------------------------------------
// Questions List (used for bookmarks/wrong question lookups)
// ---------------------------------------------------------------------------

class QuestionsListNotifier extends Notifier<List<Question>> {
  @override
  List<Question> build() => LocalDatabase.instance.getAllQuestions();

  void refresh() {
    state = LocalDatabase.instance.getAllQuestions();
  }
}

final questionsListProvider =
    NotifierProvider<QuestionsListNotifier, List<Question>>(QuestionsListNotifier.new);

// ---------------------------------------------------------------------------
// Question of the Day (Live Firestore provider)
// ---------------------------------------------------------------------------

final todayQotdProvider = FutureProvider<QuestionOfTheDay?>((ref) async {
  final now = DateTime.now();
  final dateStr =
      "${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
  return FirestoreService.instance.fetchQOTD(dateStr);
});
