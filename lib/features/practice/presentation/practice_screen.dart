import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/widgets/animated_pressable.dart';
import '../../../core/widgets/app_card.dart';

class PracticeScreen extends ConsumerStatefulWidget {
  const PracticeScreen({super.key});

  @override
  ConsumerState<PracticeScreen> createState() => _PracticeScreenState();
}

class _PracticeScreenState extends ConsumerState<PracticeScreen> {
  String _activeExam = 'ALL';

  final List<String> _examFilters = ['ALL', 'CGL', 'CHSL', 'POLICE', 'MTS'];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final subjects = LocalDatabase.instance.getSubjects(
      examCode: _activeExam == 'ALL' ? null : _activeExam,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Subject Practice', style: TextStyle(fontWeight: FontWeight.w700)),
        elevation: 0,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Filter Pills Row
            Container(
              height: 48,
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16),
                itemCount: _examFilters.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final exam = _examFilters[index];
                  final isSelected = _activeExam == exam;

                  return ChoiceChip(
                    label: Text(
                      exam == 'ALL' ? 'All Exams' : exam,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _activeExam = exam);
                      }
                    },
                    selectedColor: AppColors.actionBlue,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : (isDark ? AppColors.textDark : AppColors.textLight),
                    ),
                    side: BorderSide(
                      color: isSelected ? AppColors.actionBlue : (isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight),
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppDimens.radiusPill)),
                  );
                },
              ),
            ),

            // Subject List
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(AppDimens.space16),
                itemCount: subjects.length,
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final subject = subjects[index];
                  final topicsCount = LocalDatabase.instance.getTopicsBySubject(subject.id).length;

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
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              color: subject.isAndamanSpecial
                                  ? AppColors.islandEmerald.withAlpha(25)
                                  : AppColors.actionBlue.withAlpha(25),
                              borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                            ),
                            child: Icon(
                              _getSubjectIcon(subject.iconName),
                              color: subject.isAndamanSpecial ? AppColors.islandEmerald : AppColors.actionBlue,
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        subject.name,
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                          color: isDark ? AppColors.textDark : AppColors.textLight,
                                        ),
                                      ),
                                    ),
                                    if (subject.isAndamanSpecial)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppColors.islandEmerald,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: const Text(
                                          'ISLAND GK',
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
                                  '$topicsCount Topics • ${subject.questionCount} Questions',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(Icons.chevron_right, color: AppColors.textMutedLight),
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
