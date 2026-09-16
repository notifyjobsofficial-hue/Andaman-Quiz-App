import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/models/models.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/animated_pressable.dart';
import '../../../core/widgets/app_card.dart';

class SavedScreen extends ConsumerStatefulWidget {
  const SavedScreen({super.key});

  @override
  ConsumerState<SavedScreen> createState() => _SavedScreenState();
}

class _SavedScreenState extends ConsumerState<SavedScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bookmarks = ref.watch(bookmarksProvider);
    final wrongQuestions = ref.watch(wrongQuestionsProvider);
    final attempts = ref.watch(studentAttemptsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Saved & Revision', style: TextStyle(fontWeight: FontWeight.w700)),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: AppColors.actionBlue,
          labelColor: AppColors.actionBlue,
          unselectedLabelColor: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: [
            Tab(text: 'Bookmarks (${bookmarks.length})'),
            Tab(text: 'Wrong (${wrongQuestions.length})'),
            const Tab(text: 'Revision Due'),
            Tab(text: 'Attempts (${attempts.length})'),
          ],
        ),
      ),
      body: SafeArea(
        child: TabBarView(
          controller: _tabController,
          children: [
            // 1. Bookmarked Questions
            _QuestionListTab(
              questions: bookmarks,
              emptyMessage: 'No bookmarked questions yet.\nTap ♡ during practice to save questions for quick revision.',
              onBookmarkToggle: (qId) => ref.read(bookmarksProvider.notifier).toggle(qId),
            ),

            // 2. Wrong Questions
            _QuestionListTab(
              questions: wrongQuestions,
              emptyMessage: 'No wrong questions recorded.\nPractice questions and tests to populate revision items.',
              onBookmarkToggle: (qId) => ref.read(bookmarksProvider.notifier).toggle(qId),
            ),

            // 3. Revision Due (Topics with lower accuracy)
            _RevisionDueTab(),

            // 4. Previous Attempts
            _PreviousAttemptsTab(attempts: attempts),
          ],
        ),
      ),
    );
  }
}

class _QuestionListTab extends StatelessWidget {
  final List<Question> questions;
  final String emptyMessage;
  final Function(String questionId) onBookmarkToggle;

  const _QuestionListTab({
    required this.questions,
    required this.emptyMessage,
    required this.onBookmarkToggle,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (questions.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppDimens.space32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.bookmark_border, size: 52, color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
              const SizedBox(height: 14),
              Text(
                emptyMessage,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(AppDimens.space16),
      itemCount: questions.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final q = questions[index];
        final isBookmarked = LocalDatabase.instance.isBookmarked(q.id);

        return AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (q.year != null)
                    Text(
                      q.year!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                      ),
                    ),
                  IconButton(
                    icon: Icon(
                      isBookmarked ? Icons.favorite : Icons.favorite_border,
                      size: 20,
                      color: isBookmarked ? AppColors.error : AppColors.textMutedLight,
                    ),
                    onPressed: () => onBookmarkToggle(q.id),
                  ),
                ],
              ),
              Text(
                q.questionEn,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, height: 1.4),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(AppDimens.radiusSmall),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle_outline, size: 16, color: AppColors.success),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Ans: ${q.optionsEn[q.correctIndex]}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.success),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _RevisionDueTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final dueTopics = [
      {'title': 'Time & Work', 'accuracy': '62%', 'subject': 'Quantitative Aptitude', 'id': 'top_quant_time_work'},
      {'title': 'Syllogisms', 'accuracy': '60%', 'subject': 'General Intelligence', 'id': 'top_reason_syllogism'},
      {'title': 'A&N Indigenous Tribes', 'accuracy': '68%', 'subject': 'Andaman GK', 'id': 'top_an_tribes'},
      {'title': 'Profit & Loss', 'accuracy': '65%', 'subject': 'Quantitative Aptitude', 'id': 'top_quant_profit_loss'},
    ];

    return ListView.separated(
      padding: const EdgeInsets.all(AppDimens.space16),
      itemCount: dueTopics.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final item = dueTopics[index];

        return AnimatedPressable(
          onTap: () => context.push('/practice/mcq/${item['id']}'),
          child: AppCard(
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.error.withAlpha(25),
                    borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                  ),
                  child: const Icon(Icons.refresh, color: AppColors.error, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item['title']!,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${item['subject']} • Accuracy: ${item['accuracy']}',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                        ),
                      ),
                    ],
                  ),
                ),
                ElevatedButton(
                  onPressed: () => context.push('/practice/mcq/${item['id']}'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(80, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  child: const Text('Revise', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _PreviousAttemptsTab extends StatelessWidget {
  final List<StudentAttempt> attempts;

  const _PreviousAttemptsTab({required this.attempts});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (attempts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.history, size: 52, color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
            const SizedBox(height: 14),
            Text(
              'No previous test attempts yet.\nTake a mock test to see your history and scorecard here.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(AppDimens.space16),
      itemCount: attempts.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final a = attempts[index];
        final isPassed = a.maxScore > 0 && (a.score / a.maxScore) >= 0.6;

        return AnimatedPressable(
          onTap: () => context.push('/tests/results/${a.id}'),
          child: AppCard(
            child: Row(
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: isPassed ? AppColors.successLight : AppColors.errorLight,
                    borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    a.score.toStringAsFixed(0),
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: isPassed ? AppColors.success : AppColors.error,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        a.testTitle,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Accuracy: ${a.accuracy.toInt()}% • Correct: ${a.correctCount} • Wrong: ${a.wrongCount}',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppColors.textMutedLight),
              ],
            ),
          ),
        );
      },
    );
  }
}
