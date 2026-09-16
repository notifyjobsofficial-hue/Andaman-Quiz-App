import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../database/local_database.dart';
import '../models/models.dart';

// Current Selected Exam Provider (CGL, CHSL, POLICE, MTS)
class SelectedExamNotifier extends Notifier<String> {
  @override
  String build() => LocalDatabase.instance.getSelectedExam();

  Future<void> setExam(String examCode) async {
    state = examCode;
    await LocalDatabase.instance.setSelectedExam(examCode);
  }
}

final selectedExamProvider = NotifierProvider<SelectedExamNotifier, String>(SelectedExamNotifier.new);

// Current Language Provider ('en' or 'hi')
class SelectedLanguageNotifier extends Notifier<String> {
  @override
  String build() => LocalDatabase.instance.getSelectedLanguage();

  Future<void> setLanguage(String lang) async {
    state = lang;
    await LocalDatabase.instance.setSelectedLanguage(lang);
  }
}

final selectedLanguageProvider = NotifierProvider<SelectedLanguageNotifier, String>(SelectedLanguageNotifier.new);

// Home Statistics Notifiers
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

final totalQuestionsCountProvider = NotifierProvider<TotalQuestionsCountNotifier, int>(TotalQuestionsCountNotifier.new);

// Bookmarks Provider
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

final bookmarksProvider = NotifierProvider<BookmarksNotifier, List<Question>>(BookmarksNotifier.new);

// Wrong Questions Provider
class WrongQuestionsNotifier extends Notifier<List<Question>> {
  @override
  List<Question> build() => LocalDatabase.instance.getWrongQuestions();

  void refresh() {
    state = LocalDatabase.instance.getWrongQuestions();
  }
}

final wrongQuestionsProvider = NotifierProvider<WrongQuestionsNotifier, List<Question>>(WrongQuestionsNotifier.new);

// Student Attempts Provider
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

final studentAttemptsProvider = NotifierProvider<StudentAttemptsNotifier, List<StudentAttempt>>(StudentAttemptsNotifier.new);

// Sound & Haptics preferences
class SoundHapticsNotifier extends Notifier<bool> {
  @override
  bool build() => true;
  void toggle(bool val) => state = val;
}

final soundHapticsProvider = NotifierProvider<SoundHapticsNotifier, bool>(SoundHapticsNotifier.new);

// Questions List Provider (for real-time Firestore sync & UI updates)
class QuestionsListNotifier extends Notifier<List<Question>> {
  @override
  List<Question> build() => LocalDatabase.instance.getAllQuestions();

  void refresh() {
    state = LocalDatabase.instance.getAllQuestions();
  }
}

final questionsListProvider = NotifierProvider<QuestionsListNotifier, List<Question>>(QuestionsListNotifier.new);
