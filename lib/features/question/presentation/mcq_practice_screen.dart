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

class McqPracticeScreen extends ConsumerStatefulWidget {
  final String topicId;

  const McqPracticeScreen({super.key, required this.topicId});

  @override
  ConsumerState<McqPracticeScreen> createState() => _McqPracticeScreenState();
}

class _McqPracticeScreenState extends ConsumerState<McqPracticeScreen> {
  late List<Question> _questions;
  late Topic? _topic;
  int _currentIndex = 0;

  // Stored state for current session: questionId -> selectedOptionIndex
  final Map<String, int> _selectedAnswers = {};
  final Map<String, bool> _submitted = {};

  @override
  void initState() {
    super.initState();
    _topic = LocalDatabase.instance.getTopicById(widget.topicId);
    _questions = LocalDatabase.instance.getQuestionsByTopic(widget.topicId);
    if (_questions.isEmpty) {
      // Fallback: If topic has few questions in seed, pull related questions
      _questions = LocalDatabase.instance.getAllQuestions();
    }
  }

  void _onOptionSelected(int index) {
    final currentQ = _questions[_currentIndex];
    if (_submitted[currentQ.id] == true) return;

    setState(() {
      _selectedAnswers[currentQ.id] = index;
      _submitted[currentQ.id] = true;
    });

    final isCorrect = index == currentQ.correctIndex;
    if (!isCorrect) {
      LocalDatabase.instance.recordWrongQuestion(currentQ.id);
    }
  }

  void _goToPrevious() {
    if (_currentIndex > 0) {
      setState(() {
        _currentIndex--;
      });
    }
  }

  void _goToNext() {
    if (_currentIndex < _questions.length - 1) {
      setState(() {
        _currentIndex++;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_questions.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Practice')),
        body: const Center(child: Text('No questions available.')),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currentQ = _questions[_currentIndex];
    final selectedOption = _selectedAnswers[currentQ.id];
    final hasSubmitted = _submitted[currentQ.id] == true;

    final lang = ref.watch(selectedLanguageProvider);
    final questionText = (lang == 'hi' && currentQ.questionHi.isNotEmpty)
        ? currentQ.questionHi
        : currentQ.questionEn;
    final options = (lang == 'hi' && currentQ.optionsHi.isNotEmpty)
        ? currentQ.optionsHi
        : currentQ.optionsEn;
    final explanation = (lang == 'hi' && currentQ.explanationHi.isNotEmpty)
        ? currentQ.explanationHi
        : currentQ.explanationEn;

    final isBookmarked = LocalDatabase.instance.isBookmarked(currentQ.id);
    final progress = (_currentIndex + 1) / _questions.length;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _topic?.name ?? 'Practice',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
        actions: [
          // Bookmark Toggle
          IconButton(
            icon: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              transitionBuilder: (child, animation) => ScaleTransition(scale: animation, child: child),
              child: Icon(
                isBookmarked ? Icons.favorite : Icons.favorite_border,
                key: ValueKey<bool>(isBookmarked),
                color: isBookmarked ? AppColors.error : (isDark ? Colors.white70 : AppColors.textLight),
              ),
            ),
            onPressed: () async {
              await ref.read(bookmarksProvider.notifier).toggle(currentQ.id);
              setState(() {});
            },
          ),
          // Language switcher
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ActionChip(
              label: Text(
                lang == 'hi' ? 'हिन्दी' : 'English',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
              ),
              onPressed: () {
                final next = lang == 'hi' ? 'en' : 'hi';
                ref.read(selectedLanguageProvider.notifier).setLanguage(next);
              },
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Progress Bar & Count
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16, vertical: 8),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Question ${_currentIndex + 1} of ${_questions.length}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                        ),
                      ),
                      if (currentQ.difficulty.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            currentQ.difficulty,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 5,
                      backgroundColor: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                      valueColor: const AlwaysStoppedAnimation<Color>(AppColors.actionBlue),
                    ),
                  ),
                ],
              ),
            ),

            // Question and Options in Scrollable Area
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppDimens.space16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Question Box
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (currentQ.year != null) ...[
                            Text(
                              currentQ.year!,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                              ),
                            ),
                            const SizedBox(height: 8),
                          ],
                          if (questionText.isNotEmpty)
                            Text(
                              questionText,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                height: 1.45,
                              ),
                            ),
                          if (currentQ.questionImageUrl != null && currentQ.questionImageUrl!.isNotEmpty) ...[
                            if (questionText.isNotEmpty) const SizedBox(height: 12),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                currentQ.questionImageUrl!,
                                fit: BoxFit.contain,
                                errorBuilder: (context, error, stackTrace) => Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Row(
                                    children: [
                                      Icon(Icons.broken_image_outlined, size: 20, color: Colors.grey),
                                      SizedBox(width: 8),
                                      Text('Image could not be loaded', style: TextStyle(fontSize: 12, color: Colors.grey)),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Options List
                    ...List.generate(options.length, (index) {
                      final optionLabel = String.fromCharCode(65 + index); // A, B, C, D
                      final optionText = options[index];
                      final isSelected = selectedOption == index;
                      final isCorrect = index == currentQ.correctIndex;
                      final hasOptionImg = currentQ.optionImages != null &&
                          index < currentQ.optionImages!.length &&
                          currentQ.optionImages![index].isNotEmpty;

                      Color borderColor;
                      Color bgColor;
                      Widget? trailingBadge;

                      if (hasSubmitted) {
                        if (isCorrect) {
                          borderColor = AppColors.success;
                          bgColor = isDark ? const Color(0xFF064E3B).withAlpha(51) : AppColors.successLight;
                          trailingBadge = const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.check_circle, color: AppColors.success, size: 18),
                              SizedBox(width: 4),
                              Text(
                                'Correct',
                                style: TextStyle(
                                  color: AppColors.success,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          );
                        } else if (isSelected) {
                          borderColor = AppColors.error;
                          bgColor = isDark ? const Color(0xFF7F1D1D).withAlpha(51) : AppColors.errorLight;
                          trailingBadge = const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.cancel, color: AppColors.error, size: 18),
                              SizedBox(width: 4),
                              Text(
                                'Incorrect',
                                style: TextStyle(
                                  color: AppColors.error,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          );
                        } else {
                          borderColor = isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight;
                          bgColor = isDark ? AppColors.surfaceDark : Colors.white;
                        }
                      } else {
                        borderColor = isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight;
                        bgColor = isDark ? AppColors.surfaceDark : Colors.white;
                      }

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: AnimatedPressable(
                          onTap: () => _onOptionSelected(index),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            constraints: const BoxConstraints(minHeight: AppDimens.mcqOptionMinHeight),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              color: bgColor,
                              borderRadius: AppDimens.cardBorderRadius,
                              border: Border.all(
                                color: borderColor,
                                width: (hasSubmitted && (isCorrect || isSelected)) ? 2.0 : 1.0,
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 32,
                                  height: 32,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: (hasSubmitted && isCorrect)
                                        ? AppColors.success
                                        : (hasSubmitted && isSelected && !isCorrect)
                                            ? AppColors.error
                                            : (isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9)),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    optionLabel,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                      color: (hasSubmitted && (isCorrect || isSelected))
                                          ? Colors.white
                                          : (isDark ? AppColors.textDark : AppColors.textLight),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      if (optionText.isNotEmpty)
                                        Text(
                                          optionText,
                                          style: TextStyle(
                                            fontSize: 15,
                                            fontWeight: (hasSubmitted && (isCorrect || isSelected))
                                                ? FontWeight.w600
                                                : FontWeight.w400,
                                          ),
                                        ),
                                      if (hasOptionImg) ...[
                                        if (optionText.isNotEmpty) const SizedBox(height: 6),
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(6),
                                          child: Image.network(
                                            currentQ.optionImages![index],
                                            height: 70,
                                            fit: BoxFit.contain,
                                            errorBuilder: (context, error, stackTrace) => const Icon(Icons.broken_image_outlined, size: 20, color: Colors.grey),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                ?trailingBadge,
                              ],
                            ),
                          ),
                        ),
                      );
                    }),

                    // Explanation Box (shown after answering)
                    if (hasSubmitted) ...[
                      const SizedBox(height: 12),
                      AppCard(
                        backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.lightbulb_outline, size: 18, color: AppColors.actionBlue),
                                SizedBox(width: 6),
                                Text(
                                  'Explanation',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.actionBlue,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              explanation,
                              style: TextStyle(
                                fontSize: 14,
                                height: 1.5,
                                color: isDark ? AppColors.textDark : AppColors.textLight,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // Bottom Navigation Bar: Previous and Next (Zero ads)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.surfaceDark : Colors.white,
                border: Border(
                  top: BorderSide(
                    color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
                  ),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  OutlinedButton.icon(
                    onPressed: _currentIndex > 0 ? _goToPrevious : null,
                    icon: const Icon(Icons.arrow_back, size: 16),
                    label: const Text('Previous'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(120, 44),
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: _currentIndex < _questions.length - 1 ? _goToNext : () => context.pop(),
                    icon: Icon(_currentIndex < _questions.length - 1 ? Icons.arrow_forward : Icons.done_all, size: 16),
                    label: Text(_currentIndex < _questions.length - 1 ? 'Next' : 'Finish'),
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(120, 44),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
