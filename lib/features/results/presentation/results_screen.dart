import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/widgets/app_card.dart';

class ResultsScreen extends StatelessWidget {
  final String attemptId;

  const ResultsScreen({super.key, required this.attemptId});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final attempt = LocalDatabase.instance.getAttemptById(attemptId) ??
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

    final percentage = attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0.0;
    final isPassed = percentage >= 60.0;

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
                          attempt.score.toStringAsFixed(1),
                          style: TextStyle(
                            fontSize: 44,
                            fontWeight: FontWeight.w900,
                            color: isPassed ? AppColors.actionBlue : AppColors.error,
                            letterSpacing: -1,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '/ ${attempt.maxScore.toInt()}',
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
                        '${percentage.toStringAsFixed(1)}% Overall Score',
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
                            value: '${attempt.correctCount}',
                            color: AppColors.success,
                          ),
                          _ResultMetric(
                            title: 'Wrong',
                            value: '${attempt.wrongCount}',
                            color: AppColors.error,
                          ),
                          _ResultMetric(
                            title: 'Unattempted',
                            value: '${attempt.unattemptedCount}',
                            color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                          ),
                          _ResultMetric(
                            title: 'Accuracy',
                            value: '${attempt.accuracy.toInt()}%',
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
                child: Column(
                  children: attempt.sectionScores.entries.map((entry) {
                    final sectionName = entry.key;
                    // Normalized to percentage for visual bar
                    final scorePct = (entry.value * 20).clamp(0.0, 100.0);

                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                sectionName,
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                              ),
                              Text(
                                '${scorePct.toInt()}%',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.actionBlue,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                            child: LinearProgressIndicator(
                              value: scorePct / 100.0,
                              minHeight: 6,
                              backgroundColor: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                              valueColor: AlwaysStoppedAnimation<Color>(
                                scorePct >= 70
                                    ? AppColors.success
                                    : (scorePct >= 40 ? AppColors.actionBlue : AppColors.error),
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

              // Strong Topics & Needs Revision
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
                              Text(
                                'Strong Topics',
                                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.success),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Text('• A&N Geography (82%)\n• Coding-Decoding (88%)\n• Constitution (78%)',
                              style: TextStyle(fontSize: 12, height: 1.4)),
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
                              Text(
                                'Needs Revision',
                                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.error),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Text('• Time & Work (62%)\n• Syllogisms (60%)\n• A&N Tribes (68%)',
                              style: TextStyle(fontSize: 12, height: 1.4)),
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
