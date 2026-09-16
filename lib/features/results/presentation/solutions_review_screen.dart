import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/app_card.dart';

class SolutionsReviewScreen extends ConsumerStatefulWidget {
  final String attemptId;

  const SolutionsReviewScreen({super.key, required this.attemptId});

  @override
  ConsumerState<SolutionsReviewScreen> createState() => _SolutionsReviewScreenState();
}

class _SolutionsReviewScreenState extends ConsumerState<SolutionsReviewScreen> {
  String _activeFilter = 'All'; // All, Correct, Incorrect, Unattempted

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final attempt = LocalDatabase.instance.getAttemptById(widget.attemptId) ??
        (LocalDatabase.instance.getAttempts().isNotEmpty
            ? LocalDatabase.instance.getAttempts().first
            : null);

    if (attempt == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Review Solutions')),
        body: const Center(child: Text('No solutions to display.')),
      );
    }

    final mock = LocalDatabase.instance.getMockTestById(attempt.testId);
    final allQuestionIds = <String>[];
    if (mock != null) {
      for (final sec in mock.sections) {
        allQuestionIds.addAll(sec.questionIds);
      }
    } else {
      allQuestionIds.addAll(attempt.selectedAnswers.keys);
    }

    final questions = LocalDatabase.instance.getQuestionsByIds(allQuestionIds);

    // Apply Filter
    final filteredQuestions = questions.where((q) {
      final selected = attempt.selectedAnswers[q.id];
      if (_activeFilter == 'Correct') {
        return selected != null && selected == q.correctIndex;
      } else if (_activeFilter == 'Incorrect') {
        return selected != null && selected != q.correctIndex;
      } else if (_activeFilter == 'Unattempted') {
        return selected == null;
      }
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review Solutions', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Filter Pills
            Container(
              height: 48,
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16),
                children: ['All', 'Correct', 'Incorrect', 'Unattempted'].map((f) {
                  final isSelected = _activeFilter == f;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(f, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500)),
                      selected: isSelected,
                      onSelected: (selected) {
                        if (selected) setState(() => _activeFilter = f);
                      },
                      selectedColor: AppColors.actionBlue,
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.white : (isDark ? AppColors.textDark : AppColors.textLight),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),

            // Question Solutions List
            Expanded(
              child: filteredQuestions.isEmpty
                  ? Center(
                      child: Text(
                        'No questions in this filter.',
                        style: TextStyle(color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(AppDimens.space16),
                      itemCount: filteredQuestions.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 16),
                      itemBuilder: (context, index) {
                        final q = filteredQuestions[index];
                        final userSelected = attempt.selectedAnswers[q.id];
                        final isCorrect = userSelected != null && userSelected == q.correctIndex;
                        final isUnattempted = userSelected == null;
                        final isBookmarked = LocalDatabase.instance.isBookmarked(q.id);

                        return AppCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: isCorrect
                                              ? AppColors.successLight
                                              : (isUnattempted ? const Color(0xFFF1F5F9) : AppColors.errorLight),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          isCorrect
                                              ? 'CORRECT'
                                              : (isUnattempted ? 'UNATTEMPTED' : 'INCORRECT'),
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w800,
                                            color: isCorrect
                                                ? AppColors.success
                                                : (isUnattempted ? AppColors.cbtNotVisited : AppColors.error),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  IconButton(
                                    icon: Icon(
                                      isBookmarked ? Icons.favorite : Icons.favorite_border,
                                      size: 20,
                                      color: isBookmarked ? AppColors.error : AppColors.textMutedLight,
                                    ),
                                    onPressed: () async {
                                      await ref.read(bookmarksProvider.notifier).toggle(q.id);
                                      setState(() {});
                                    },
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '${index + 1}. ${q.questionEn}',
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, height: 1.4),
                              ),
                              const SizedBox(height: 14),

                              // Options
                              ...List.generate(q.optionsEn.length, (optIdx) {
                                final isThisCorrect = optIdx == q.correctIndex;
                                final isThisUserSelected = userSelected == optIdx;

                                Color borderColor;
                                Color bgColor;
                                if (isThisCorrect) {
                                  borderColor = AppColors.success;
                                  bgColor = isDark ? const Color(0xFF064E3B).withAlpha(51) : AppColors.successLight;
                                } else if (isThisUserSelected && !isThisCorrect) {
                                  borderColor = AppColors.error;
                                  bgColor = isDark ? const Color(0xFF7F1D1D).withAlpha(51) : AppColors.errorLight;
                                } else {
                                  borderColor = isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight;
                                  bgColor = isDark ? AppColors.surfaceDark : Colors.white;
                                }

                                return Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: bgColor,
                                    borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                                    border: Border.all(color: borderColor, width: (isThisCorrect || isThisUserSelected) ? 1.8 : 1.0),
                                  ),
                                  child: Row(
                                    children: [
                                      Text(
                                        '${String.fromCharCode(65 + optIdx)}. ',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: isThisCorrect ? AppColors.success : (isThisUserSelected ? AppColors.error : null),
                                        ),
                                      ),
                                      Expanded(
                                        child: Text(
                                          q.optionsEn[optIdx],
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: (isThisCorrect || isThisUserSelected) ? FontWeight.w600 : FontWeight.w400,
                                          ),
                                        ),
                                      ),
                                      if (isThisCorrect)
                                        const Icon(Icons.check_circle, color: AppColors.success, size: 16),
                                      if (isThisUserSelected && !isThisCorrect)
                                        const Icon(Icons.cancel, color: AppColors.error, size: 16),
                                    ],
                                  ),
                                );
                              }),

                              const SizedBox(height: 10),
                              // Explanation
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Explanation',
                                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.actionBlue),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      q.explanationEn,
                                      style: TextStyle(
                                        fontSize: 13,
                                        height: 1.45,
                                        color: isDark ? AppColors.textDark : AppColors.textLight,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
