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
import '../../../core/widgets/status_badge.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return 'Good morning 👋';
    } else if (hour < 17) {
      return 'Good afternoon 👋';
    } else {
      return 'Good evening 👋';
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final selectedExam = ref.watch(selectedExamProvider);
    final streak = ref.watch(streakProvider);
    final accuracy = ref.watch(accuracyProvider);
    final totalQuestions = ref.watch(totalQuestionsCountProvider);

    // Watch reactive streams — auto-rebuild when Firestore changes
    final allSubjects = ref.watch(subjectsStreamProvider).value ??
        LocalDatabase.instance.getSubjects();
    final subjects = selectedExam == 'ALL'
        ? allSubjects
        : allSubjects.where((s) => s.examCodes.contains(selectedExam)).toList();

    final allMocks = ref.watch(mockTestsStreamProvider).value ??
        LocalDatabase.instance.getMockTests();
    final latestMock = allMocks
            .where((m) => m.examCode.toUpperCase() == selectedExam.toUpperCase())
            .toList()
            .firstOrNull ??
        allMocks.firstOrNull;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            // instant local refresh
            ref.read(streakProvider.notifier).refresh();
            ref.read(accuracyProvider.notifier).refresh();
            ref.read(totalQuestionsCountProvider.notifier).refresh();
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16, vertical: AppDimens.space16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header Bar
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Image.asset(
                              'assets/images/andaman_symbol.png',
                              width: 22,
                              height: 22,
                              fit: BoxFit.contain,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'ANDAMAN QUIZ',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: isDark ? AppColors.textPrimaryDark : AppColors.deepNavy,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _getGreeting(),
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'Ready for today\'s preparation?',
                          style: TextStyle(
                            fontSize: 13,
                            color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                          ),
                        ),
                      ],
                    ),
                    // Notification / Info Icon
                    IconButton.filledTonal(
                      onPressed: () => context.push('/more'),
                      icon: const Icon(Icons.settings_outlined, size: 20),
                      style: IconButton.styleFrom(
                        backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                        foregroundColor: isDark ? Colors.white : AppColors.textLight,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Compact Statistics Row
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16, vertical: 14),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.surfaceDark : Colors.white,
                    borderRadius: AppDimens.cardBorderRadius,
                    border: Border.all(
                      color: isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _StatItem(
                        icon: Icons.local_fire_department,
                        iconColor: const Color(0xFFEA580C),
                        value: '$streak Days',
                        label: 'Streak',
                      ),
                      _StatDivider(isDark: isDark),
                      _StatItem(
                        icon: Icons.track_changes,
                        iconColor: AppColors.actionBlue,
                        value: '$accuracy%',
                        label: 'Accuracy',
                      ),
                      _StatDivider(isDark: isDark),
                      _StatItem(
                        icon: Icons.check_circle_outline,
                        iconColor: AppColors.success,
                        value: '$totalQuestions',
                        label: 'Questions',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Question of the Day (60-second challenge)
                AnimatedPressable(
                  onTap: () => context.push('/qotd'),
                  child: Container(
                    padding: const EdgeInsets.all(AppDimens.space16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: isDark
                            ? [const Color(0xFF0F2652), const Color(0xFF1E3A8A)]
                            : [const Color(0xFF0B2C5F), const Color(0xFF1D4ED8)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: AppDimens.cardBorderRadius,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0B2C5F).withAlpha(38),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.white.withAlpha(51),
                                borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                              ),
                              child: const Row(
                                children: [
                                  Icon(Icons.bolt, color: Color(0xFFFDE047), size: 14),
                                  SizedBox(width: 4),
                                  Text(
                                    'QUESTION OF THE DAY',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Row(
                              children: [
                                Icon(Icons.timer_outlined, color: Colors.white70, size: 14),
                                SizedBox(width: 4),
                                Text(
                                  '60s Challenge',
                                  style: TextStyle(color: Colors.white70, fontSize: 11),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Test your Island & exam knowledge with today\'s fresh question.',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            height: 1.35,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(AppDimens.radiusSmall),
                              ),
                              child: const Row(
                                children: [
                                  Text(
                                    'Attempt Now',
                                    style: TextStyle(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12,
                                    ),
                                  ),
                                  SizedBox(width: 4),
                                  Icon(Icons.arrow_forward, size: 14, color: AppColors.primary),
                                ],
                              ),
                            ),
                            const Spacer(),
                            const Text(
                              '+2 Marks • Daily Rank',
                              style: TextStyle(color: Colors.white70, fontSize: 11),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Choose Your Exam Section
                Text(
                  'Choose Your Exam',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                _ExamSelectorRow(selectedExam: selectedExam),
                const SizedBox(height: 24),

                // Continue Practice Progress Card
                Text(
                  'Continue Practice',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                _ContinuePracticeCard(),
                const SizedBox(height: 24),

                // Andaman & Nicobar GK Special Banner (Prominent!)
                AnimatedPressable(
                  onTap: () => context.push('/andaman-gk'),
                  child: Container(
                    padding: const EdgeInsets.all(AppDimens.space16),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF064E3B).withAlpha(76) : const Color(0xFFECFDF5),
                      borderRadius: AppDimens.cardBorderRadius,
                      border: Border.all(
                        color: isDark ? const Color(0xFF059669).withAlpha(102) : const Color(0xFFA7F3D0),
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: AppColors.islandEmerald,
                            borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                          ),
                          child: const Icon(Icons.waves, color: Colors.white, size: 28),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    'Andaman & Nicobar GK',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      color: isDark ? Colors.white : const Color(0xFF065F46),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.islandEmerald,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text(
                                      'ESSENTIAL',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'History, Tribes, Geography, 10° Channel, Wildlife & PYQs',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: isDark ? const Color(0xFFA7F3D0) : const Color(0xFF047857),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right, color: AppColors.islandEmerald),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Practice by Subject
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Practice by Subject',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    TextButton(
                      onPressed: () => context.go('/practice'),
                      child: const Text('View All'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (subjects.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    child: Center(
                      child: Text(
                        'No subjects available for this exam yet.',
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                        ),
                      ),
                    ),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: subjects.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final subject = subjects[index];
                      return _SubjectListItem(subject: subject);
                    },
                  ),
                const SizedBox(height: 24),

                // Latest Mock Test Card at Bottom
                Text(
                  'Latest Full Mock Test',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                if (latestMock != null)
                  _LatestMockTestCard(mockTest: latestMock)
                else
                  AppCard(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Row(
                        children: [
                          Icon(Icons.quiz_outlined, color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'No Mock Tests Available Yet',
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Mock tests for this category will be published soon.',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String value;
  final String label;

  const _StatItem({
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: iconColor),
            const SizedBox(width: 4),
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: isDark ? AppColors.textDark : AppColors.textLight,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _StatDivider extends StatelessWidget {
  final bool isDark;
  const _StatDivider({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 32,
      color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
    );
  }
}

class _ExamSelectorRow extends ConsumerWidget {
  final String selectedExam;
  const _ExamSelectorRow({required this.selectedExam});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dbExams = ref.watch(examsStreamProvider).value ??
        LocalDatabase.instance.getExams();
    // Show up to first 4 exams from Firestore; shows nothing if no exams configured yet
    final exams = dbExams.take(4).map((e) => e.code).toList();

    if (exams.isEmpty) {
      return const SizedBox.shrink();
    }

    return Row(
      children: exams.map((exam) {
        final isSelected = selectedExam.toUpperCase() == exam.toUpperCase();
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: AnimatedPressable(
              onTap: () {
                ref.read(selectedExamProvider.notifier).setExam(exam);
              },
              child: Container(
                height: 42,
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.actionBlue
                      : (Theme.of(context).brightness == Brightness.dark ? const Color(0xFF1E293B) : Colors.white),
                  borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                  border: Border.all(
                    color: isSelected
                        ? AppColors.actionBlue
                        : (Theme.of(context).brightness == Brightness.dark ? AppColors.cardBorderDark : AppColors.cardBorderLight),
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  exam,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: isSelected
                        ? Colors.white
                        : (Theme.of(context).brightness == Brightness.dark ? AppColors.textDark : AppColors.textLight),
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _ContinuePracticeCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final attempts = LocalDatabase.instance.getAttempts();

    // If student has previous attempts, display their real latest activity
    if (attempts.isNotEmpty) {
      final latest = attempts.last;
      return AppCard(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    latest.testTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Score: ${latest.score.toStringAsFixed(1)} • ${latest.correctCount}/${latest.correctCount + latest.wrongCount + latest.unattemptedCount} correct',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            ElevatedButton(
              onPressed: () => context.push('/practice'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(90, 36),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 0),
              ),
              child: const Text('Practice', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      );
    }

    // Friendly onboarding state when new
    return AppCard(
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.actionBlue.withAlpha(25),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.school_outlined, color: AppColors.actionBlue, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Start Your Preparation',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Explore subject-wise MCQs & mock tests',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: () => context.push('/practice'),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(80, 36),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
            ),
            child: const Text('Start', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}

class _SubjectListItem extends StatelessWidget {
  final Subject subject;
  const _SubjectListItem({required this.subject});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return AnimatedPressable(
      onTap: () {
        if (subject.isAndamanSpecial) {
          context.push('/andaman-gk');
        } else {
          context.push('/practice/topics/${subject.id}');
        }
      },
      child: AppCard(
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: subject.isAndamanSpecial
                    ? AppColors.islandEmerald.withAlpha(25)
                    : AppColors.actionBlue.withAlpha(25),
                borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
              ),
              child: Icon(
                _getSubjectIcon(subject.iconName),
                color: subject.isAndamanSpecial ? AppColors.islandEmerald : AppColors.actionBlue,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    subject.name,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.textDark : AppColors.textLight,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${subject.questionCount} Questions',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, size: 20, color: AppColors.textMutedLight),
          ],
        ),
      ),
    );
  }

  IconData _getSubjectIcon(String name) {
    switch (name) {
      case 'landscape_outlined':
        return Icons.landscape_outlined;
      case 'calculate_outlined':
        return Icons.calculate_outlined;
      case 'psychology_outlined':
        return Icons.psychology_outlined;
      case 'translate_outlined':
        return Icons.translate_outlined;
      case 'public_outlined':
        return Icons.public_outlined;
      case 'newspaper_outlined':
        return Icons.newspaper_outlined;
      default:
        return Icons.menu_book_outlined;
    }
  }
}

class _LatestMockTestCard extends StatelessWidget {
  final MockTest mockTest;
  const _LatestMockTestCard({required this.mockTest});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              StatusBadge.free(),
              Text(
                '${mockTest.attemptsCount} attempts',
                style: TextStyle(
                  fontSize: 11,
                  color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            mockTest.title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${mockTest.totalQuestions} Questions • ${mockTest.durationMinutes} Minutes • ${mockTest.totalMarks.toInt()} Marks • -${mockTest.negativeMarks.toStringAsFixed(2)} Negative',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton(
              onPressed: () => context.push('/tests/instructions/${mockTest.id}'),
              child: const Text('Start Test', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}
