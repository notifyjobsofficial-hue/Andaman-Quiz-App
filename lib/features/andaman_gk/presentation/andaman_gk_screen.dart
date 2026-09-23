import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/models/models.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/animated_pressable.dart';
import '../../../core/widgets/app_card.dart';
import '../../practice/presentation/widgets/practice_start_bottom_sheet.dart';

class AndamanGkScreen extends ConsumerStatefulWidget {
  const AndamanGkScreen({super.key});

  @override
  ConsumerState<AndamanGkScreen> createState() => _AndamanGkScreenState();
}

class _AndamanGkScreenState extends ConsumerState<AndamanGkScreen> {
  String _selectedCategory = 'All';

  // Category display names; actual topic filtering uses topic.name or id
  final List<String> _categories = [
    'All',
    'Geography',
    'History',
    'Tribes',
    'Wildlife',
    'Polity',
    'PYQ',
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Find the Andaman GK subject dynamically by isAndamanSpecial flag
    final allSubjects = ref.watch(subjectsStreamProvider).value ??
        LocalDatabase.instance.getSubjects();
    final andamanSubject = allSubjects.firstWhere(
      (s) => s.isAndamanSpecial,
      orElse: () => allSubjects.firstWhere(
        (s) => s.id.contains('an_gk') || s.name.toLowerCase().contains('andaman'),
        orElse: () => const Subject(
          id: '',
          name: '',
          hindiName: '',
          iconName: '',
          questionCount: 0,
          examCodes: [],
        ),
      ),
    );

    // Topics from Firestore for this subject
    final allTopics = ref.watch(topicsStreamProvider).value ??
        LocalDatabase.instance.getTopics();
    final subjectTopics = andamanSubject.id.isNotEmpty
        ? allTopics.where((t) => t.subjectId == andamanSubject.id).toList()
        : <Topic>[];

    // Filter topics by selected category (matches topic name/id keywords)
    final filteredTopics = subjectTopics.where((t) {
      if (_selectedCategory == 'All') return true;
      final lower = t.name.toLowerCase() + t.id.toLowerCase();
      if (_selectedCategory == 'Geography') return lower.contains('geography') || lower.contains('geo');
      if (_selectedCategory == 'History') return lower.contains('history');
      if (_selectedCategory == 'Tribes') return lower.contains('tribe');
      if (_selectedCategory == 'Wildlife') return lower.contains('wildlife') || lower.contains('fauna');
      if (_selectedCategory == 'Polity') return lower.contains('polity') || lower.contains('govern');
      if (_selectedCategory == 'PYQ') return lower.contains('pyq') || lower.contains('previous');
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Andaman & Nicobar GK', style: TextStyle(fontWeight: FontWeight.w700)),
        elevation: 0,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Top Academic Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16, vertical: 14),
              color: isDark ? const Color(0xFF064E3B).withAlpha(51) : const Color(0xFFECFDF5),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: AppColors.islandEmerald,
                      borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                    ),
                    child: const Icon(Icons.school, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'A&N Exam Special Focus',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.islandEmerald,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'High-yield questions specifically asked in A&N Administration, Police & SSC exams.',
                          style: TextStyle(fontSize: 12, height: 1.3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Filter Chips
            Container(
              height: 48,
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16),
                itemCount: _categories.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final cat = _categories[index];
                  final isSelected = _selectedCategory == cat;
                  return ChoiceChip(
                    label: Text(cat, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500)),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _selectedCategory = cat);
                      }
                    },
                    selectedColor: AppColors.islandEmerald,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : (isDark ? AppColors.textDark : AppColors.textLight),
                    ),
                    side: BorderSide(
                      color: isSelected ? AppColors.islandEmerald : (isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight),
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppDimens.radiusPill)),
                  );
                },
              ),
            ),

            // Topics List
            Expanded(
              child: filteredTopics.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.waves,
                            size: 48,
                            color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'No A&N GK topics available yet',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: isDark ? AppColors.textDark : AppColors.textLight,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Topics and questions will appear once added by the administrator.',
                            style: TextStyle(
                              fontSize: 13,
                              color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                            ),
                          ),
                        ],
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(AppDimens.space16),
                      itemCount: filteredTopics.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final topic = filteredTopics[index];
                        final eligibleQuestions = LocalDatabase.instance.getQuestionsByTopic(topic.id);
                        final questionCount = eligibleQuestions.isNotEmpty
                            ? eligibleQuestions.length
                            : topic.questionCount;
                        final attemptedCount = LocalDatabase.instance.getTopicAttemptedCount(topic.id);
                        final accuracy = LocalDatabase.instance.getTopicAccuracy(topic.id);
                        final progress = questionCount > 0 ? (attemptedCount / questionCount).clamp(0.0, 1.0) : 0.0;

                        final sessionCount = LocalDatabase.instance.getTopicSessionCount(topic.id);

                        return AnimatedPressable(
                          onTap: () async {
                            await openPracticeTopic(context, topic);
                            if (mounted) setState(() {});
                          },
                          child: AppCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      width: 40,
                                      height: 40,
                                      decoration: BoxDecoration(
                                        color: AppColors.islandEmerald.withAlpha(25),
                                        borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                                      ),
                                      child: Icon(
                                        _getTopicIcon(topic.id),
                                        color: AppColors.islandEmerald,
                                        size: 22,
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            topic.name,
                                            style: const TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Row(
                                            children: [
                                              Text(
                                                '$questionCount Questions',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                                ),
                                              ),
                                              Text(
                                                ' • ',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                                ),
                                              ),
                                              Icon(
                                                Icons.remove_red_eye_outlined,
                                                size: 13,
                                                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                              ),
                                              const SizedBox(width: 3),
                                              Text(
                                                TopicPracticeSession.formatPracticeCount(sessionCount),
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                                ),
                                              ),
                                              if (attemptedCount > 0) ...[
                                                Text(
                                                  ' • ${accuracy.toInt()}%',
                                                  style: TextStyle(
                                                    fontSize: 12,
                                                    color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    const Icon(Icons.chevron_right, color: AppColors.islandEmerald),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                // Progress bar
                                Row(
                                  children: [
                                    Expanded(
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                                        child: LinearProgressIndicator(
                                          value: progress,
                                          minHeight: 5,
                                          backgroundColor: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                                          valueColor: const AlwaysStoppedAnimation<Color>(AppColors.islandEmerald),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Text(
                                      '${(progress * 100).toInt()}%',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.islandEmerald,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
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

  IconData _getTopicIcon(String id) {
    if (id.contains('history')) return Icons.account_balance_outlined;
    if (id.contains('geography')) return Icons.public_outlined;
    if (id.contains('tribes')) return Icons.people_outline;
    if (id.contains('wildlife')) return Icons.nature_people_outlined;
    if (id.contains('polity')) return Icons.gavel_outlined;
    if (id.contains('pyq')) return Icons.history_edu_outlined;
    return Icons.menu_book_outlined;
  }
}
