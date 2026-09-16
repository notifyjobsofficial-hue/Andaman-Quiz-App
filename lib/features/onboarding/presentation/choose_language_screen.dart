import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/constants/app_typography.dart';
import '../../../core/database/local_database.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/animated_pressable.dart';
import '../../../core/widgets/app_card.dart';

class ChooseLanguageScreen extends ConsumerStatefulWidget {
  const ChooseLanguageScreen({super.key});

  @override
  ConsumerState<ChooseLanguageScreen> createState() => _ChooseLanguageScreenState();
}

class _ChooseLanguageScreenState extends ConsumerState<ChooseLanguageScreen> {
  String _selectedLang = 'en';

  @override
  void initState() {
    super.initState();
    _selectedLang = ref.read(selectedLanguageProvider);
  }

  Future<void> _completeOnboarding() async {
    await ref.read(selectedLanguageProvider.notifier).setLanguage(_selectedLang);
    await LocalDatabase.instance.setOnboardingDone(true);
    if (mounted) {
      context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppDimens.space24, vertical: AppDimens.space20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.actionBlueLight,
                  borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                ),
                child: const Text(
                  'ANDAMAN QUIZ • STEP 2 OF 2',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.actionBlue,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Select Study Language',
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'You can switch questions between English and Hindi at any time during practice.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                ),
              ),
              const SizedBox(height: 36),
              // English Card
              AnimatedPressable(
                onTap: () => setState(() => _selectedLang = 'en'),
                child: AppCard(
                  backgroundColor: _selectedLang == 'en'
                      ? (isDark ? const Color(0xFF1E3A8A).withAlpha(51) : AppColors.actionBlueLight.withAlpha(128))
                      : null,
                  border: BorderSide(
                    color: _selectedLang == 'en' ? AppColors.actionBlue : (isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight),
                    width: _selectedLang == 'en' ? 2.0 : 1.0,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: _selectedLang == 'en' ? AppColors.actionBlue : (isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9)),
                          borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                        ),
                        child: Center(
                          child: Text(
                            'EN',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: _selectedLang == 'en' ? Colors.white : AppColors.actionBlue,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'English',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: isDark ? AppColors.textDark : AppColors.textLight,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Questions, explanations & CBT in English',
                              style: TextStyle(
                                fontSize: 13,
                                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                              ),
                            ),
                          ],
                        ),
                      ),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _selectedLang == 'en' ? AppColors.actionBlue : Colors.transparent,
                          border: Border.all(
                            color: _selectedLang == 'en' ? AppColors.actionBlue : (isDark ? Colors.white38 : AppColors.textMutedLight),
                            width: 2,
                          ),
                        ),
                        child: _selectedLang == 'en'
                            ? const Icon(Icons.check, size: 14, color: Colors.white)
                            : null,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // Hindi Card
              AnimatedPressable(
                onTap: () => setState(() => _selectedLang = 'hi'),
                child: AppCard(
                  backgroundColor: _selectedLang == 'hi'
                      ? (isDark ? const Color(0xFF1E3A8A).withAlpha(51) : AppColors.actionBlueLight.withAlpha(128))
                      : null,
                  border: BorderSide(
                    color: _selectedLang == 'hi' ? AppColors.actionBlue : (isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight),
                    width: _selectedLang == 'hi' ? 2.0 : 1.0,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: _selectedLang == 'hi' ? AppColors.actionBlue : (isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9)),
                          borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                        ),
                        child: Center(
                          child: Text(
                            'हिं',
                            style: AppTypography.hindiStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: _selectedLang == 'hi' ? Colors.white : AppColors.actionBlue,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'हिन्दी (Hindi)',
                              style: AppTypography.hindiStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: isDark ? AppColors.textDark : AppColors.textLight,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'हिंदी माध्यम में प्रश्न और व्याख्या उपलब्ध',
                              style: AppTypography.hindiStyle(
                                fontSize: 13,
                                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                              ),
                            ),
                          ],
                        ),
                      ),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _selectedLang == 'hi' ? AppColors.actionBlue : Colors.transparent,
                          border: Border.all(
                            color: _selectedLang == 'hi' ? AppColors.actionBlue : (isDark ? Colors.white38 : AppColors.textMutedLight),
                            width: 2,
                          ),
                        ),
                        child: _selectedLang == 'hi'
                            ? const Icon(Icons.check, size: 14, color: Colors.white)
                            : null,
                      ),
                    ],
                  ),
                ),
              ),
              const Spacer(),
              // Start Button
              SizedBox(
                width: double.infinity,
                height: AppDimens.minButtonHeight,
                child: ElevatedButton(
                  onPressed: _completeOnboarding,
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Start Practicing'),
                      SizedBox(width: 8),
                      Icon(Icons.rocket_launch_outlined, size: 18),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}
