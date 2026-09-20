import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/services/firestore_service.dart';
import '../../../core/widgets/app_card.dart';
import '../domain/scorecard_analytics.dart';

class ResultsScreen extends ConsumerStatefulWidget {
  final String attemptId;

  const ResultsScreen({super.key, required this.attemptId});

  @override
  ConsumerState<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends ConsumerState<ResultsScreen> {
  bool _isLoadingQuestions = false;

  @override
  void initState() {
    super.initState();
    _ensureQuestionsLoaded();
  }

  Future<void> _ensureQuestionsLoaded() async {
    final attempt = LocalDatabase.instance.getAttemptById(widget.attemptId) ??
        (LocalDatabase.instance.getAttempts().isNotEmpty
            ? LocalDatabase.instance.getAttempts().first
            : null);
    if (attempt == null) return;

    final mock = LocalDatabase.instance.getMockTestById(attempt.testId);
    final allQuestionIds = <String>[];
    if (mock != null && mock.sections.isNotEmpty) {
      for (final sec in mock.sections) {
        allQuestionIds.addAll(sec.questionIds);
      }
    } else {
      allQuestionIds.addAll(attempt.selectedAnswers.keys);
    }

    if (allQuestionIds.isEmpty) return;

    final cachedQuestions = LocalDatabase.instance.getQuestionsByIds(allQuestionIds);
    if (cachedQuestions.length < allQuestionIds.length) {
      setState(() => _isLoadingQuestions = true);
      try {
        await FirestoreService.instance.fetchQuestionsForTest(allQuestionIds);
      } catch (_) {
        // Fallback to locally cached data
      } finally {
        if (mounted) {
          setState(() => _isLoadingQuestions = false);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final attempt = LocalDatabase.instance.getAttemptById(widget.attemptId) ??
        (LocalDatabase.instance.getAttempts().isNotEmpty
            ? LocalDatabase.instance.getAttempts().first
            : null);

    if (attempt == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Result')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('No result found.'),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => context.go('/home'),
                child: const Text('Back Home'),
              ),
            ],
          ),
        ),
      );
    }

    final mock = LocalDatabase.instance.getMockTestById(attempt.testId);
    final allQuestionIds = <String>[];
    if (mock != null && mock.sections.isNotEmpty) {
      for (final sec in mock.sections) {
        allQuestionIds.addAll(sec.questionIds);
      }
    } else {
      allQuestionIds.addAll(attempt.selectedAnswers.keys);
    }

    final questions = LocalDatabase.instance.getQuestionsByIds(allQuestionIds);

    // Compute 100% genuine dynamic analytics without any dummy/demo data
    final analytics = ScorecardAnalytics.compute(
      attempt: attempt,
      mockTest: mock,
      questions: questions,
    );

    final isPassed = analytics.percentage >= 60.0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Scorecard & Analytics', style: TextStyle(fontWeight: FontWeight.w700)),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDimens.space16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_isLoadingQuestions)
                const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: LinearProgressIndicator(minHeight: 3),
                ),
              // Overall Score Hero Card
              AppCard(
                child: Column(
                  children: [
                    Text(
                      attempt.testTitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          analytics.score.toStringAsFixed(1),
                          style: TextStyle(
                            fontSize: 44,
                            fontWeight: FontWeight.w900,
                            color: isPassed ? AppColors.actionBlue : AppColors.error,
                            letterSpacing: -1,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '/ ${analytics.maxScore.toInt()}',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: isPassed ? AppColors.successLight : AppColors.errorLight,
                        borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                      ),
                      child: Text(
                        '${analytics.percentage.toStringAsFixed(1)}% Overall Score',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: isPassed ? AppColors.success : AppColors.error,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // 4 Stat Grid (Correct, Wrong, Unattempted, Accuracy)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _ResultMetric(
                            title: 'Correct',
                            value: '${analytics.correctCount}',
                            color: AppColors.success,
                          ),
                          _ResultMetric(
                            title: 'Wrong',
                            value: '${analytics.wrongCount}',
                            color: AppColors.error,
                          ),
                          _ResultMetric(
                            title: 'Unattempted',
                            value: '${analytics.unattemptedCount}',
                            color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                          ),
                          _ResultMetric(
                            title: 'Accuracy',
                            value: '${analytics.accuracy.toInt()}%',
                            color: AppColors.actionBlue,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Section Performance
              Text(
                'Section Performance',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              AppCard(
                child: analytics.sections.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Center(
                          child: Text(
                            'No section performance data available.',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                            ),
                          ),
                        ),
                      )
                    : Column(
                        children: analytics.sections.map((sec) {
                          final isAttempted = sec.isAttempted;
                          final accuracy = sec.accuracy ?? 0.0;

                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        sec.sectionName,
                                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      isAttempted ? '${accuracy.toInt()}%' : 'Not Attempted',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: isAttempted
                                            ? AppColors.actionBlue
                                            : (isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                                  child: LinearProgressIndicator(
                                    value: isAttempted ? (accuracy / 100.0).clamp(0.0, 1.0) : 0.0,
                                    minHeight: 6,
                                    backgroundColor: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      !isAttempted
                                          ? Colors.transparent
                                          : (accuracy >= 70.0
                                              ? AppColors.success
                                              : (accuracy >= 40.0 ? AppColors.actionBlue : AppColors.error)),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
              ),
              const SizedBox(height: 24),

              // Strong Topics & Needs Revision (Computed from genuine question attempt history)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Strong Topics
                  Expanded(
                    child: AppCard(
                      backgroundColor: isDark ? const Color(0xFF064E3B).withAlpha(38) : const Color(0xFFF0FDF4),
                      border: BorderSide(
                        color: isDark ? const Color(0xFF059669).withAlpha(76) : const Color(0xFFBBF7D0),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.check_circle, size: 16, color: AppColors.success),
                              SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Strong Topics',
                                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.success),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          if (analytics.strongTopics.isEmpty)
                            Text(
                              'Not enough attempts to identify strong topics yet.',
                              style: TextStyle(
                                fontSize: 12,
                                height: 1.4,
                                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                              ),
                            )
                          else
                            Text(
                              analytics.strongTopics
                                  .map((t) => '• ${t.topicName} (${t.accuracy.toInt()}%)')
                                  .join('\n'),
                              style: const TextStyle(fontSize: 12, height: 1.4),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Needs Revision
                  Expanded(
                    child: AppCard(
                      backgroundColor: isDark ? const Color(0xFF7F1D1D).withAlpha(38) : const Color(0xFFFEF2F2),
                      border: BorderSide(
                        color: isDark ? const Color(0xFFDC2626).withAlpha(76) : const Color(0xFFFECACA),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.warning_amber_rounded, size: 16, color: AppColors.error),
                              SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Needs Revision',
                                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.error),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          if (analytics.needsRevisionTopics.isEmpty)
                            Text(
                              'No revision topics identified yet.',
                              style: TextStyle(
                                fontSize: 12,
                                height: 1.4,
                                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                              ),
                            )
                          else
                            Text(
                              analytics.needsRevisionTopics
                                  .map((t) => '• ${t.topicName} (${t.accuracy.toInt()}%)')
                                  .join('\n'),
                              style: const TextStyle(fontSize: 12, height: 1.4),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),

              // Bottom Action Buttons
              SizedBox(
                width: double.infinity,
                height: AppDimens.minButtonHeight,
                child: ElevatedButton.icon(
                  onPressed: () => context.push('/tests/solutions/${attempt.id}'),
                  icon: const Icon(Icons.assignment_turned_in_outlined, size: 18),
                  label: const Text('Review Solutions', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: AppDimens.minButtonHeight,
                child: OutlinedButton(
                  onPressed: () => context.go('/home'),
                  child: const Text('Back Home', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

class _ResultMetric extends StatelessWidget {
  final String title;
  final String value;
  final Color color;

  const _ResultMetric({
    required this.title,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          title,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
