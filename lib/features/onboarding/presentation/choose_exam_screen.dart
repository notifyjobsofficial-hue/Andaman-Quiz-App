import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/animated_pressable.dart';

class ChooseExamScreen extends ConsumerStatefulWidget {
  const ChooseExamScreen({super.key});

  @override
  ConsumerState<ChooseExamScreen> createState() => _ChooseExamScreenState();
}

class _ChooseExamScreenState extends ConsumerState<ChooseExamScreen> {
  String _selectedExam = 'CGL';

  final List<Map<String, String>> _examOptions = [
    {
      'code': 'CGL',
      'title': 'CGL',
      'subtitle': 'Combined Graduate Level (Group B & C posts in A&N)',
      'badge': 'Graduate',
    },
    {
      'code': 'CHSL',
      'title': 'CHSL',
      'subtitle': 'Combined Higher Secondary (10+2 Level vacancies)',
      'badge': '10+2 Level',
    },
    {
      'code': 'POLICE',
      'title': 'Police',
      'subtitle': 'A&N Police Constable, Sub-Inspector & Executive cadres',
      'badge': 'Constable / SI',
    },
    {
      'code': 'MTS',
      'title': 'MTS',
      'subtitle': 'Multi-Tasking Staff & Havaldar examinations',
      'badge': 'Matriculation',
    },
    {
      'code': 'OTHER',
      'title': 'Other A&N Exams',
      'subtitle': 'Forest Guard, PBMC, Health & Island Administration posts',
      'badge': 'Administration',
    },
  ];

  Future<void> _onContinue() async {
    // Store selected exam locally
    final examCode = _selectedExam == 'OTHER' ? 'CGL' : _selectedExam;
    await ref.read(selectedExamProvider.notifier).setExam(examCode);
    // Mark onboarding as completed so student is never prompted again on startup
    await LocalDatabase.instance.setOnboardingDone(true);

    if (mounted) {
      context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppDimens.space20, vertical: AppDimens.space16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 12),

              // Small Brand Icon & App Title
              Row(
                children: [
                  Image.asset(
                    'assets/images/andaman_symbol.png',
                    width: 32,
                    height: 32,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'ANDAMAN QUIZ',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: AppColors.actionBlue,
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              Text(
                'What are you preparing for?',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.4,
                  fontSize: 24,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Select your primary target examination. You can easily switch anytime in Practice or Tests.',
                style: TextStyle(
                  fontSize: 13,
                  color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),

              // Exam Options List
              Expanded(
                child: ListView.separated(
                  itemCount: _examOptions.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final item = _examOptions[index];
                    final isSelected = _selectedExam == item['code'];

                    return AnimatedPressable(
                      onTap: () {
                        setState(() {
                          _selectedExam = item['code']!;
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? (isDark ? const Color(0xFF1E3A8A).withAlpha(40) : AppColors.actionBlueLight)
                              : (isDark ? AppColors.surfaceDark : Colors.white),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isSelected
                                ? AppColors.actionBlue
                                : (isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight),
                            width: isSelected ? 2.0 : 1.0,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppColors.actionBlue
                                    : (isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9)),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                item['title']!.substring(0, 1),
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: isSelected ? Colors.white : AppColors.actionBlue,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        item['title']!,
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                          color: isDark ? AppColors.textDark : AppColors.textLight,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: isDark ? Colors.white12 : Colors.black.withAlpha(12),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          item['badge']!,
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w600,
                                            color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    item['subtitle']!,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                      height: 1.3,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isSelected ? AppColors.actionBlue : Colors.transparent,
                                border: Border.all(
                                  color: isSelected
                                      ? AppColors.actionBlue
                                      : (isDark ? Colors.white38 : AppColors.textMutedLight),
                                  width: 2,
                                ),
                              ),
                              child: isSelected
                                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                                  : null,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),

              const SizedBox(height: 12),

              // Primary CTA: Continue ->
              SizedBox(
                width: double.infinity,
                height: AppDimens.minButtonHeight,
                child: ElevatedButton(
                  onPressed: _onContinue,
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Continue', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      SizedBox(width: 8),
                      Icon(Icons.arrow_forward, size: 18),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Center(
                child: Text(
                  'No login required • Free & offline ready',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                  ),
                ),
              ),
              const SizedBox(height: 6),
            ],
          ),
        ),
      ),
    );
  }
}
