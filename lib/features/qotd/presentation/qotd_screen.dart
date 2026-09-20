import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/models/models.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/services/firestore_service.dart';
import '../../../core/widgets/animated_pressable.dart';
import '../../../core/widgets/app_card.dart';

class QotdScreen extends ConsumerStatefulWidget {
  const QotdScreen({super.key});

  @override
  ConsumerState<QotdScreen> createState() => _QotdScreenState();
}

class _QotdScreenState extends ConsumerState<QotdScreen> {
  bool _isLoading = true;
  Question? _question;
  String _sourceInfo = '';
  int _secondsRemaining = 60;
  Timer? _timer;
  int? _selectedOption;
  bool _isSubmitted = false;

  @override
  void initState() {
    super.initState();
    _loadQotd();
  }

  Future<void> _loadQotd() async {
    final today = DateTime.now().toIso8601String().split('T').first;
    Question? found;
    String source = '';

    try {
      final qotdDoc = await FirestoreService.instance.fetchQOTD(today);
      if (qotdDoc != null && qotdDoc.active) {
        source = qotdDoc.formattedSourceInfo;
        if (qotdDoc.questionText != null &&
            qotdDoc.options != null &&
            qotdDoc.options!.isNotEmpty) {
          found = Question(
            id: qotdDoc.questionId.isNotEmpty ? qotdDoc.questionId : 'qotd_$today',
            subjectId: 'sub_general',
            topicId: 'top_daily',
            examTags: [source],
            questionEn: qotdDoc.questionText!,
            questionHi: '',
            optionsEn: qotdDoc.options!,
            optionsHi: const [],
            correctIndex: qotdDoc.correctIndex,
            explanationEn: qotdDoc.explanation ?? '',
            explanationHi: '',
            questionImageUrl: qotdDoc.questionImageUrl,
            optionImages: qotdDoc.optionImages,
            explanationImageUrl: qotdDoc.explanationImageUrl,
          );
        } else if (qotdDoc.questionId.isNotEmpty) {
          found = LocalDatabase.instance.getQuestionById(qotdDoc.questionId);
          if (found == null) {
            final remoteList = await FirestoreService.instance.fetchQuestionsForTest([qotdDoc.questionId]);
            if (remoteList.isNotEmpty) {
              found = remoteList.first;
            }
          }
          if (found != null) {
            found = found.copyWith(
              questionImageUrl: qotdDoc.questionImageUrl ?? found.questionImageUrl,
              optionImages: qotdDoc.optionImages ?? found.optionImages,
              explanationImageUrl: qotdDoc.explanationImageUrl ?? found.explanationImageUrl,
            );
          }
        }
      }
    } catch (e) {
      debugPrint('Error loading QOTD: $e');
    }

    // Check if user already attempted today's QOTD
    final previousAttempt = LocalDatabase.instance.getQotdAttempt(today);
    int? previousSelectedOption;
    bool alreadySubmitted = false;

    if (previousAttempt != null) {
      previousSelectedOption = (previousAttempt['selectedOption'] as num?)?.toInt();
      alreadySubmitted = true;
    }

    if (mounted) {
      setState(() {
        _question = found;
        _sourceInfo = source;
        _selectedOption = previousSelectedOption;
        _isSubmitted = alreadySubmitted;
        _isLoading = false;
      });
      if (_question != null && !_isSubmitted) {
        _startTimer();
      }
    }
  }

  void _startTimer() {
    _timer?.cancel();
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
    if (_isSubmitted || _question == null) return;
    _timer?.cancel();
    final today = DateTime.now().toIso8601String().split('T').first;
    final isCorrect = _selectedOption == _question!.correctIndex;

    setState(() {
      _isSubmitted = true;
    });

    LocalDatabase.instance.saveQotdAttempt(
      date: today,
      questionId: _question!.id,
      selectedOption: _selectedOption ?? -1,
      isCorrect: isCorrect,
    );

    if (_selectedOption != null) {
      LocalDatabase.instance.recordPracticeAnswer(isCorrect: isCorrect);
      if (!isCorrect) {
        LocalDatabase.instance.recordWrongQuestion(_question!.id);
      }
    }
  }

  Widget _buildNetworkImage(String url, {double? maxHeight}) {
    if (url.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          url,
          fit: BoxFit.contain,
          height: maxHeight,
          loadingBuilder: (context, child, loadingProgress) {
            if (loadingProgress == null) return child;
            return Container(
              height: maxHeight ?? 140,
              color: Colors.black12,
              child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
            );
          },
          errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Question of the Day', style: TextStyle(fontWeight: FontWeight.w700)),
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => context.pop(),
          ),
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_question == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Question of the Day', style: TextStyle(fontWeight: FontWeight.w700)),
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => context.pop(),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppDimens.space24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.actionBlue.withAlpha(25),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.lightbulb_outline, size: 48, color: AppColors.actionBlue),
                ),
                const SizedBox(height: 20),
                const Text(
                  "Today's question will be available soon.",
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text(
                  'The editorial team is preparing today\'s PYQ. Please check back shortly or explore practice modules below.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => context.pop(),
                  child: const Text('Back to Home', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final question = _question!;
    final lang = ref.watch(selectedLanguageProvider);
    final questionText = (lang == 'hi' && question.questionHi.isNotEmpty)
        ? question.questionHi
        : question.questionEn;
    final options = (lang == 'hi' && question.optionsHi.isNotEmpty)
        ? question.optionsHi
        : question.optionsEn;
    final explanation = (lang == 'hi' && question.explanationHi.isNotEmpty)
        ? question.explanationHi
        : question.explanationEn;

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
                  if (!_isSubmitted)
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
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.success.withAlpha(25),
                        borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.check_circle, size: 14, color: AppColors.success),
                          SizedBox(width: 4),
                          Text(
                            'Completed',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.success),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              if (!_isSubmitted) ...[
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
              ],
              const SizedBox(height: 20),

              // Question Card
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_sourceInfo.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          _sourceInfo,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isDark ? const Color(0xFF93C5FD) : AppColors.actionBlue,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                    ] else if (question.year != null) ...[
                      Text(
                        question.year!,
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
                    if (question.questionImageUrl != null && question.questionImageUrl!.isNotEmpty)
                      _buildNetworkImage(question.questionImageUrl!, maxHeight: 180),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Options
              ...List.generate(options.length, (index) {
                final optionLabel = String.fromCharCode(65 + index); // A, B, C, D
                final optionText = options[index];
                final isSelected = _selectedOption == index;
                final isCorrect = index == question.correctIndex;
                final optImg = (question.optionImages != null && index < question.optionImages!.length)
                    ? question.optionImages![index]
                    : null;

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
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  optionText,
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                                  ),
                                ),
                                if (optImg != null && optImg.isNotEmpty)
                                  _buildNetworkImage(optImg, maxHeight: 80),
                              ],
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
                    color: _selectedOption == question.correctIndex
                        ? (isDark ? const Color(0xFF064E3B).withAlpha(51) : AppColors.successLight)
                        : (isDark ? const Color(0xFF7F1D1D).withAlpha(51) : AppColors.errorLight),
                    borderRadius: AppDimens.cardBorderRadius,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _selectedOption == question.correctIndex ? Icons.check_circle : Icons.error_outline,
                        color: _selectedOption == question.correctIndex ? AppColors.success : AppColors.error,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _selectedOption == question.correctIndex
                              ? 'Correct! Well done.'
                              : 'Incorrect. Review the detailed explanation below.',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: _selectedOption == question.correctIndex ? AppColors.success : AppColors.error,
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
                      if (question.explanationImageUrl != null && question.explanationImageUrl!.isNotEmpty)
                        _buildNetworkImage(question.explanationImageUrl!, maxHeight: 180),
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
