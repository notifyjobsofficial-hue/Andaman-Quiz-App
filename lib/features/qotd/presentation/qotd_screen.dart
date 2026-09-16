import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/database/seed_data.dart';
import '../../../core/models/models.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/animated_pressable.dart';
import '../../../core/widgets/app_card.dart';

class QotdScreen extends ConsumerStatefulWidget {
  const QotdScreen({super.key});

  @override
  ConsumerState<QotdScreen> createState() => _QotdScreenState();
}

class _QotdScreenState extends ConsumerState<QotdScreen> {
  late Question _question;
  int _secondsRemaining = 60;
  Timer? _timer;
  int? _selectedOption;
  bool _isSubmitted = false;

  @override
  void initState() {
    super.initState();
    _question = SeedData.questionOfTheDay;
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      if (_secondsRemaining > 0 && !_isSubmitted) {
        setState(() {
          _secondsRemaining--;
        });
      } else if (_secondsRemaining <= 0 && !_isSubmitted) {
        _submit();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _selectOption(int index) {
    if (_isSubmitted) return;
    setState(() {
      _selectedOption = index;
    });
  }

  void _submit() {
    if (_isSubmitted) return;
    _timer?.cancel();
    setState(() {
      _isSubmitted = true;
    });

    if (_selectedOption != null) {
      final isCorrect = _selectedOption == _question.correctIndex;
      if (!isCorrect) {
        LocalDatabase.instance.recordWrongQuestion(_question.id);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final lang = ref.watch(selectedLanguageProvider);
    final questionText = (lang == 'hi' && _question.questionHi.isNotEmpty)
        ? _question.questionHi
        : _question.questionEn;
    final options = (lang == 'hi' && _question.optionsHi.isNotEmpty)
        ? _question.optionsHi
        : _question.optionsEn;
    final explanation = (lang == 'hi' && _question.explanationHi.isNotEmpty)
        ? _question.explanationHi
        : _question.explanationEn;

    final progressRatio = _secondsRemaining / 60.0;
    final timerColor = _secondsRemaining <= 10 ? AppColors.error : AppColors.actionBlue;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Question of the Day', style: TextStyle(fontWeight: FontWeight.w700)),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
        actions: [
          // Language Switcher Chip
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ActionChip(
              label: Text(lang == 'hi' ? 'हिन्दी' : 'English', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
              onPressed: () {
                final next = lang == 'hi' ? 'en' : 'hi';
                ref.read(selectedLanguageProvider.notifier).setLanguage(next);
              },
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDimens.space16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Timer & Tag bar
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.actionBlueLight,
                      borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                    ),
                    child: const Text(
                      'DAILY 60s CHALLENGE',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: AppColors.actionBlue,
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      Icon(Icons.timer_outlined, size: 16, color: timerColor),
                      const SizedBox(width: 4),
                      Text(
                        '$_secondsRemaining sec remaining',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: timerColor,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                child: LinearProgressIndicator(
                  value: progressRatio,
                  minHeight: 4,
                  backgroundColor: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                  valueColor: AlwaysStoppedAnimation<Color>(timerColor),
                ),
              ),
              const SizedBox(height: 20),

              // Question Card
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_question.year != null) ...[
                      Text(
                        _question.year!,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                    Text(
                      questionText,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Options
              ...List.generate(options.length, (index) {
                final optionLabel = String.fromCharCode(65 + index); // A, B, C, D
                final optionText = options[index];
                final isSelected = _selectedOption == index;
                final isCorrect = index == _question.correctIndex;

                Color borderColor;
                Color bgColor;
                Widget? trailingIcon;

                if (_isSubmitted) {
                  if (isCorrect) {
                    borderColor = AppColors.success;
                    bgColor = isDark ? const Color(0xFF064E3B).withAlpha(51) : AppColors.successLight;
                    trailingIcon = const Icon(Icons.check_circle, color: AppColors.success, size: 20);
                  } else if (isSelected) {
                    borderColor = AppColors.error;
                    bgColor = isDark ? const Color(0xFF7F1D1D).withAlpha(51) : AppColors.errorLight;
                    trailingIcon = const Icon(Icons.cancel, color: AppColors.error, size: 20);
                  } else {
                    borderColor = isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight;
                    bgColor = isDark ? AppColors.surfaceDark : Colors.white;
                  }
                } else {
                  if (isSelected) {
                    borderColor = AppColors.actionBlue;
                    bgColor = isDark ? const Color(0xFF1E3A8A).withAlpha(51) : AppColors.actionBlueLight;
                  } else {
                    borderColor = isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight;
                    bgColor = isDark ? AppColors.surfaceDark : Colors.white;
                  }
                }

                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: AnimatedPressable(
                    onTap: _isSubmitted ? null : () => _selectOption(index),
                    child: Container(
                      constraints: const BoxConstraints(minHeight: AppDimens.mcqOptionMinHeight),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: bgColor,
                        borderRadius: AppDimens.cardBorderRadius,
                        border: Border.all(
                          color: borderColor,
                          width: isSelected || (_isSubmitted && isCorrect) ? 2.0 : 1.0,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isSelected ? AppColors.actionBlue : (isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9)),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              optionLabel,
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                color: isSelected ? Colors.white : (isDark ? AppColors.textDark : AppColors.textLight),
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              optionText,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                              ),
                            ),
                          ),
                          ?trailingIcon,
                        ],
                      ),
                    ),
                  ),
                );
              }),

              const SizedBox(height: 12),

              // Action button or Explanation
              if (!_isSubmitted) ...[
                SizedBox(
                  width: double.infinity,
                  height: AppDimens.minButtonHeight,
                  child: ElevatedButton(
                    onPressed: _selectedOption != null ? _submit : null,
                    child: const Text('Submit Answer', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ] else ...[
                // Feedback Banner
                Container(
                  padding: const EdgeInsets.all(AppDimens.space16),
                  decoration: BoxDecoration(
                    color: _selectedOption == _question.correctIndex
                        ? (isDark ? const Color(0xFF064E3B).withAlpha(51) : AppColors.successLight)
                        : (isDark ? const Color(0xFF7F1D1D).withAlpha(51) : AppColors.errorLight),
                    borderRadius: AppDimens.cardBorderRadius,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _selectedOption == _question.correctIndex ? Icons.check_circle : Icons.error_outline,
                        color: _selectedOption == _question.correctIndex ? AppColors.success : AppColors.error,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _selectedOption == _question.correctIndex
                              ? 'Correct! +2 Marks credited to today\'s streak.'
                              : 'Incorrect. Don\'t worry, review the explanation below!',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: _selectedOption == _question.correctIndex ? AppColors.success : AppColors.error,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Explanation Card
                AppCard(
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
                        style: const TextStyle(fontSize: 14, height: 1.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  height: AppDimens.minButtonHeight,
                  child: ElevatedButton(
                    onPressed: () => context.pop(),
                    child: const Text('Back to Home', style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
