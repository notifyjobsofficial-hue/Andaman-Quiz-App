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
import 'widgets/live_test_home_card.dart';
import 'widgets/notice_board_card.dart';

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
    final streamSubjects = ref.watch(subjectsStreamProvider).value;
    final allSubjects = (streamSubjects != null && streamSubjects.isNotEmpty)
        ? streamSubjects
        : LocalDatabase.instance.getSubjects();
    final subjects = selectedExam == 'ALL'
        ? allSubjects
        : allSubjects.where((s) => s.examCodes.contains(selectedExam)).toList();

    final streamMocks = ref.watch(mockTestsStreamProvider).value;
    final allMocks = (streamMocks != null && streamMocks.isNotEmpty)
        ? streamMocks
        : LocalDatabase.instance.getMockTests();
    final latestMock = allMocks
            .where((m) => m.examCode.toUpperCase() == selectedExam.toUpperCase())
            .toList()
            .firstOrNull ??
        allMocks.firstOrNull;

    final attempts = ref.watch(studentAttemptsProvider);

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            // Instant local refresh
            ref.read(streakProvider.notifier).refresh();
            ref.read(accuracyProvider.notifier).refresh();
            ref.read(totalQuestionsCountProvider.notifier).refresh();
            ref.invalidate(todayQotdProvider);
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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
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
                              Flexible(
                                child: Text(
                                  'ANDAMAN QUIZ',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    color: isDark ? AppColors.textPrimaryDark : AppColors.deepNavy,
                                    letterSpacing: 0.8,
                                  ),
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
                    ),
                    const SizedBox(width: 8),
                    // Settings / More Shortcut
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

                // Compact Premium Statistics Card (100% genuine calculated data)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppDimens.space14, vertical: 12),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.surfaceDark : Colors.white,
                    borderRadius: AppDimens.cardBorderRadius,
                    border: Border.all(
                      color: isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(isDark ? 30 : 10),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      _StatItem(
                        icon: Icons.local_fire_department,
                        iconColor: const Color(0xFFEA580C),
                        bgColor: const Color(0xFFEA580C).withAlpha(22),
                        value: '$streak Days',
                        label: 'Streak',
                      ),
                      _StatDivider(isDark: isDark),
                      _StatItem(
                        icon: Icons.track_changes,
                        iconColor: AppColors.actionBlue,
                        bgColor: AppColors.actionBlue.withAlpha(22),
                        value: '$accuracy%',
                        label: 'Accuracy',
                      ),
                      _StatDivider(isDark: isDark),
                      _StatItem(
                        icon: Icons.check_circle_outline,
                        iconColor: AppColors.success,
                        bgColor: AppColors.success.withAlpha(22),
                        value: '$totalQuestions',
                        label: 'Questions',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Live Question of the Day Hero Card (Firestore-backed with professional empty state)
                const _QotdHeroCard(),
                const SizedBox(height: 24),

                // Choose Your Exam Section
                Text(
                  'Choose Your Exam',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                _ExamSelectorRow(selectedExam: selectedExam),
                const SizedBox(height: 24),

                // Continue Practice Progress Card (Only shown when genuine attempts exist)
                if (attempts.isNotEmpty) ...[
                  Text(
                    'Continue Practice',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 10),
                  _ContinuePracticeCard(latestAttempt: attempts.last),
                  const SizedBox(height: 24),
                ],

                // Dynamic Notice Board (Vertical auto-rotating loop)
                const NoticeBoardCard(),
                const SizedBox(height: 20),

                // Dynamic Live Test Card (Conditioned on active LIVE or scheduled UPCOMING)
                const LiveTestHomeCard(),
                const SizedBox(height: 20),

                // Practice by Subject
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        'Practice by Subject',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                      ),
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
  final Color bgColor;
  final String value;
  final String label;

  const _StatItem({
    required this.icon,
    required this.iconColor,
    required this.bgColor,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: bgColor,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 16, color: iconColor),
          ),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: isDark ? AppColors.textDark : AppColors.textLight,
              ),
            ),
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
      ),
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

class _QotdHeroCard extends ConsumerWidget {
  const _QotdHeroCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final qotdAsync = ref.watch(todayQotdProvider);

    return qotdAsync.when(
      loading: () => Container(
        height: 130,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
          borderRadius: AppDimens.cardBorderRadius,
          border: Border.all(
            color: isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight,
          ),
        ),
        padding: const EdgeInsets.all(AppDimens.space16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            Container(
              width: 130,
              height: 16,
              decoration: BoxDecoration(
                color: isDark ? Colors.white12 : Colors.black12,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            Container(
              width: double.infinity,
              height: 18,
              decoration: BoxDecoration(
                color: isDark ? Colors.white10 : Colors.black12,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            Container(
              width: 100,
              height: 28,
              decoration: BoxDecoration(
                color: isDark ? Colors.white12 : Colors.black12,
                borderRadius: BorderRadius.circular(6),
              ),
            ),
          ],
        ),
      ),
      error: (_, _) => _buildEmptyState(context, isDark),
      data: (qotd) {
        if (qotd == null || !qotd.active) {
          return _buildEmptyState(context, isDark);
        }

        final questionSnippet = (qotd.questionText != null && qotd.questionText!.trim().isNotEmpty)
            ? qotd.questionText!.trim()
            : "Today's daily question is active. Test your knowledge!";

        final todayStr = DateTime.now().toIso8601String().split('T').first;
        final isAttempted = LocalDatabase.instance.getQotdAttempt(todayStr) != null;

        return AnimatedPressable(
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
              border: Border.all(
                color: Colors.white.withAlpha(25),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0B2C5F).withAlpha(45),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header row: ⚡ QUESTION OF THE DAY | PYQ | ⏱ 60s
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withAlpha(51),
                        borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.bolt, color: Color(0xFFFDE047), size: 14),
                          SizedBox(width: 4),
                          Text(
                            'QUESTION OF THE DAY',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDE047).withAlpha(40),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0xFFFDE047).withAlpha(120), width: 0.8),
                      ),
                      child: const Text(
                        'PYQ',
                        style: TextStyle(
                          color: Color(0xFFFDE047),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.timer_outlined, color: Colors.white70, size: 14),
                        SizedBox(width: 4),
                        Text(
                          '⏱ 60s',
                          style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Question Text (max 3 lines) + clean image thumbnail if present
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        questionSnippet,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          height: 1.4,
                        ),
                      ),
                    ),
                    if (qotd.questionImageUrl != null && qotd.questionImageUrl!.isNotEmpty) ...[
                      const SizedBox(width: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: Container(
                          width: 44,
                          height: 44,
                          color: Colors.white12,
                          child: Image.network(
                            qotd.questionImageUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => const SizedBox.shrink(),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 8),

                // Dedicated Separate Source Line
                Text(
                  qotd.formattedSourceInfo,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withAlpha(200),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 14),

                // Attempt CTA button (No fake Daily Rank or fake marks)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppDimens.radiusSmall),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            isAttempted ? 'Review Solution' : 'Attempt Now',
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.arrow_forward, size: 14, color: AppColors.primary),
                        ],
                      ),
                    ),
                    if (isAttempted)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.white.withAlpha(35),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle, size: 12, color: Color(0xFF86EFAC)),
                            SizedBox(width: 4),
                            Text(
                              'Completed Today',
                              style: TextStyle(color: Color(0xFF86EFAC), fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildEmptyState(BuildContext context, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(AppDimens.space16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
        borderRadius: AppDimens.cardBorderRadius,
        border: Border.all(
          color: isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.actionBlue.withAlpha(25),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.wb_sunny_outlined, color: AppColors.actionBlue, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Question of the Day',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text(
                  "Today's question will be available soon.",
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ExamSelectorRow extends ConsumerWidget {
  final String selectedExam;
  const _ExamSelectorRow({required this.selectedExam});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final streamExams = ref.watch(examsStreamProvider).value;
    final dbExams = (streamExams != null && streamExams.isNotEmpty)
        ? streamExams
        : LocalDatabase.instance.getExams();

    // Dynamically build exam options from Firestore (prepend ALL)
    final examOptions = <Map<String, String>>[
      {'code': 'ALL', 'label': 'All Exams'},
      ...dbExams.map((e) => {'code': e.code, 'label': e.code}),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: examOptions.map((item) {
          final code = item['code']!;
          final label = item['label']!;
          final isSelected = selectedExam.toUpperCase() == code.toUpperCase();

          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: AnimatedPressable(
              onTap: () {
                ref.read(selectedExamProvider.notifier).setExam(code);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.actionBlue
                      : (isDark ? const Color(0xFF1E293B) : Colors.white),
                  borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                  border: Border.all(
                    color: isSelected
                        ? AppColors.actionBlue
                        : (isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight),
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: AppColors.actionBlue.withAlpha(60),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                    color: isSelected
                        ? Colors.white
                        : (isDark ? AppColors.textDark : AppColors.textLight),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ContinuePracticeCard extends StatelessWidget {
  final StudentAttempt latestAttempt;
  const _ContinuePracticeCard({required this.latestAttempt});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final totalQuestions = latestAttempt.correctCount + latestAttempt.wrongCount + latestAttempt.unattemptedCount;
    final progress = totalQuestions > 0 ? (latestAttempt.correctCount / totalQuestions).clamp(0.0, 1.0) : 0.0;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  latestAttempt.testTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.actionBlue.withAlpha(25),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '${latestAttempt.accuracy.round()}% ACC',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: AppColors.actionBlue,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Score: ${latestAttempt.score.toStringAsFixed(1)} / ${latestAttempt.maxScore.toStringAsFixed(0)} • ${latestAttempt.correctCount}/$totalQuestions correct',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
            ),
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.actionBlue),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              OutlinedButton(
                onPressed: () => context.push('/tests/solutions/${latestAttempt.id}'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(80, 34),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Review', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () => context.push('/tests/instructions/${latestAttempt.testId}'),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(90, 34),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 0),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Retake', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ],
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
