import '../../../core/models/models.dart';

class SectionResult {
  final String sectionName;
  final int totalQuestions;
  final int attemptedCount;
  final int correctCount;
  final int wrongCount;
  final double? accuracy; // null when attemptedCount == 0 ("Not Attempted")

  bool get isAttempted => attemptedCount > 0;

  const SectionResult({
    required this.sectionName,
    required this.totalQuestions,
    required this.attemptedCount,
    required this.correctCount,
    required this.wrongCount,
    required this.accuracy,
  });
}

class TopicResult {
  final String topicName;
  final int totalQuestions;
  final int attemptedCount;
  final int correctCount;
  final int wrongCount;
  final double accuracy; // (correctCount / attemptedCount) * 100.0

  const TopicResult({
    required this.topicName,
    required this.totalQuestions,
    required this.attemptedCount,
    required this.correctCount,
    required this.wrongCount,
    required this.accuracy,
  });
}

class ScorecardAnalytics {
  final int totalQuestions;
  final int correctCount;
  final int wrongCount;
  final int unattemptedCount;
  final int attemptedCount;
  final double accuracy;
  final double score;
  final double maxScore;
  final double percentage;
  final double positiveMarks;
  final double negativeMarks;
  final List<SectionResult> sections;
  final List<TopicResult> strongTopics;
  final List<TopicResult> needsRevisionTopics;

  const ScorecardAnalytics({
    required this.totalQuestions,
    required this.correctCount,
    required this.wrongCount,
    required this.unattemptedCount,
    required this.attemptedCount,
    required this.accuracy,
    required this.score,
    required this.maxScore,
    required this.percentage,
    required this.positiveMarks,
    required this.negativeMarks,
    required this.sections,
    required this.strongTopics,
    required this.needsRevisionTopics,
  });

  /// Factory method to compute pure analytics strictly from actual student attempt,
  /// mock test structure, and question bank data. Zero dummy/fake values.
  factory ScorecardAnalytics.compute({
    required StudentAttempt attempt,
    MockTest? mockTest,
    required List<Question> questions,
  }) {
    final Map<String, Question> questionMap = {for (final q in questions) q.id: q};

    // Determine positive and negative marks from mock or fallback to questions
    final double posMarks = mockTest?.positiveMarks ??
        (mockTest != null && mockTest.totalQuestions > 0
            ? mockTest.totalMarks / mockTest.totalQuestions
            : (questions.isNotEmpty ? questions.first.positiveMarks : 2.0));
    final double negMarks = mockTest?.negativeMarks ??
        (questions.isNotEmpty ? questions.first.negativeMarks : 0.5);

    // Collect all expected question IDs in the test
    final List<String> allTestQuestionIds = [];
    if (mockTest != null && mockTest.sections.isNotEmpty) {
      for (final sec in mockTest.sections) {
        allTestQuestionIds.addAll(sec.questionIds);
      }
    } else if (questions.isNotEmpty) {
      allTestQuestionIds.addAll(questions.map((q) => q.id));
    } else {
      allTestQuestionIds.addAll(attempt.selectedAnswers.keys);
    }

    final int totalQ = allTestQuestionIds.isNotEmpty
        ? allTestQuestionIds.length
        : (attempt.correctCount + attempt.wrongCount + attempt.unattemptedCount);

    int computedCorrect = 0;
    int computedWrong = 0;
    int computedUnattempted = 0;

    for (final qId in allTestQuestionIds) {
      final selected = attempt.selectedAnswers[qId];
      final q = questionMap[qId];

      if (selected == null) {
        computedUnattempted++;
      } else if (q != null && selected == q.correctIndex) {
        computedCorrect++;
      } else {
        computedWrong++;
      }
    }

    // Fallback if questions map is incomplete (e.g., initial load before cache sync)
    final int finalCorrect = (questions.isNotEmpty && allTestQuestionIds.isNotEmpty)
        ? computedCorrect
        : attempt.correctCount;
    final int finalWrong = (questions.isNotEmpty && allTestQuestionIds.isNotEmpty)
        ? computedWrong
        : attempt.wrongCount;
    final int finalUnattempted = (questions.isNotEmpty && allTestQuestionIds.isNotEmpty)
        ? computedUnattempted
        : (totalQ - (finalCorrect + finalWrong) >= 0
            ? totalQ - (finalCorrect + finalWrong)
            : 0);

    final int finalAttempted = finalCorrect + finalWrong;
    final double finalAccuracy = finalAttempted > 0
        ? (finalCorrect / finalAttempted) * 100.0
        : 0.0;

    // Score calculation using actual positive and negative marks
    final double rawScore = (finalCorrect * posMarks) - (finalWrong * negMarks);
    final double maxScore = mockTest != null && mockTest.totalMarks > 0
        ? mockTest.totalMarks
        : (totalQ * posMarks);
    final double overallPercentage = maxScore > 0
        ? ((rawScore > 0 ? rawScore : 0.0) / maxScore) * 100.0
        : 0.0;

    // --- 2. Section Performance ---
    final List<SectionResult> sectionResults = [];

    if (mockTest != null && mockTest.sections.isNotEmpty) {
      for (final sec in mockTest.sections) {
        int secAttempted = 0;
        int secCorrect = 0;

        for (final qId in sec.questionIds) {
          final selected = attempt.selectedAnswers[qId];
          final q = questionMap[qId];

          if (selected != null) {
            secAttempted++;
            if (q != null && selected == q.correctIndex) {
              secCorrect++;
            }
          }
        }

        final int secWrong = secAttempted - secCorrect;
        final double? secAccuracy = secAttempted > 0
            ? (secCorrect / secAttempted) * 100.0
            : null;

        sectionResults.add(SectionResult(
          sectionName: sec.name,
          totalQuestions: sec.questionIds.length,
          attemptedCount: secAttempted,
          correctCount: secCorrect,
          wrongCount: secWrong,
          accuracy: secAccuracy,
        ));
      }
    } else if (questions.isNotEmpty) {
      // Group by subject when mock test sections are not defined
      final Map<String, List<Question>> subjectMap = {};
      for (final q in questions) {
        final sub = q.subjectId.trim().isNotEmpty ? q.subjectId.trim() : 'General';
        subjectMap.putIfAbsent(sub, () => []).add(q);
      }

      for (final entry in subjectMap.entries) {
        final subName = entry.key;
        final subQuestions = entry.value;

        int secAttempted = 0;
        int secCorrect = 0;

        for (final q in subQuestions) {
          final selected = attempt.selectedAnswers[q.id];
          if (selected != null) {
            secAttempted++;
            if (selected == q.correctIndex) {
              secCorrect++;
            }
          }
        }

        final int secWrong = secAttempted - secCorrect;
        final double? secAccuracy = secAttempted > 0
            ? (secCorrect / secAttempted) * 100.0
            : null;

        sectionResults.add(SectionResult(
          sectionName: subName,
          totalQuestions: subQuestions.length,
          attemptedCount: secAttempted,
          correctCount: secCorrect,
          wrongCount: secWrong,
          accuracy: secAccuracy,
        ));
      }
    }

    // --- 3 & 4. Strong Topics & Needs Revision ---
    final Map<String, List<Question>> topicAttemptedMap = {};

    for (final q in questions) {
      final selected = attempt.selectedAnswers[q.id];
      if (selected == null) continue; // Only attempted questions!

      final topic = q.topicId.trim();
      if (topic.isEmpty) continue; // Skip questions with no topic data

      topicAttemptedMap.putIfAbsent(topic, () => []).add(q);
    }

    final List<TopicResult> strongList = [];
    final List<TopicResult> revisionList = [];

    for (final entry in topicAttemptedMap.entries) {
      final topicName = entry.key;
      final qList = entry.value;

      final int topicAttempted = qList.length;
      int topicCorrect = 0;

      for (final q in qList) {
        if (attempt.selectedAnswers[q.id] == q.correctIndex) {
          topicCorrect++;
        }
      }

      final int topicWrong = topicAttempted - topicCorrect;
      final double topicAccuracy = topicAttempted > 0
          ? (topicCorrect / topicAttempted) * 100.0
          : 0.0;

      final result = TopicResult(
        topicName: topicName,
        totalQuestions: topicAttempted,
        attemptedCount: topicAttempted,
        correctCount: topicCorrect,
        wrongCount: topicWrong,
        accuracy: topicAccuracy,
      );

      // Strong topic criteria:
      // - Student actually attempted question(s) in topic
      // - At least 1 correct answer
      // - Accuracy >= 70%
      if (topicCorrect > 0 && topicAccuracy >= 70.0) {
        strongList.add(result);
      }

      // Needs revision criteria:
      // - Student actually attempted question(s) in topic
      // - Contains wrong answer(s)
      // - Accuracy < 60%
      if (topicWrong > 0 && topicAccuracy < 60.0) {
        revisionList.add(result);
      }
    }

    // Sort strong topics by accuracy descending, then by attempt count
    strongList.sort((a, b) {
      final cmp = b.accuracy.compareTo(a.accuracy);
      if (cmp != 0) return cmp;
      return b.attemptedCount.compareTo(a.attemptedCount);
    });

    // Sort revision topics by accuracy ascending (lowest accuracy first), then by errors
    revisionList.sort((a, b) {
      final cmp = a.accuracy.compareTo(b.accuracy);
      if (cmp != 0) return cmp;
      return b.wrongCount.compareTo(a.wrongCount);
    });

    return ScorecardAnalytics(
      totalQuestions: totalQ,
      correctCount: finalCorrect,
      wrongCount: finalWrong,
      unattemptedCount: finalUnattempted,
      attemptedCount: finalAttempted,
      accuracy: finalAccuracy,
      score: rawScore,
      maxScore: maxScore,
      percentage: overallPercentage,
      positiveMarks: posMarks,
      negativeMarks: negMarks,
      sections: sectionResults,
      strongTopics: strongList,
      needsRevisionTopics: revisionList,
    );
  }
}
