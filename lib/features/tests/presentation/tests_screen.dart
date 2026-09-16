import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/models/models.dart';
import '../../../core/widgets/animated_pressable.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/status_badge.dart';

class TestsScreen extends StatefulWidget {
  const TestsScreen({super.key});

  @override
  State<TestsScreen> createState() => _TestsScreenState();
}

class _TestsScreenState extends State<TestsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<String> _examTabs = ['All', 'CGL', 'CHSL', 'Police', 'MTS'];

  String _selectedFilter = 'All';
  final List<String> _filters = ['All', 'Free', 'Live', 'Previous Year'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _examTabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mock Tests & CBT', style: TextStyle(fontWeight: FontWeight.w700)),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: false,
          indicatorColor: AppColors.actionBlue,
          labelColor: AppColors.actionBlue,
          unselectedLabelColor: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: _examTabs.map((e) => Tab(text: e)).toList(),
          onTap: (_) => setState(() {}),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Filter Chips Bar (Free | Live | Previous Year)
            Container(
              height: 48,
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16),
                itemCount: _filters.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final f = _filters[index];
                  final isSelected = _selectedFilter == f;

                  return ChoiceChip(
                    label: Text(f, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500)),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _selectedFilter = f);
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

            // Mock Tests List for Current Tab & Filter
            Expanded(
              child: Builder(
                builder: (context) {
                  final currentTab = _examTabs[_tabController.index];
                  final examCode = currentTab == 'All' ? 'ALL' : currentTab.toUpperCase();
                  final tests = LocalDatabase.instance.getMockTests(
                    examCode: examCode,
                    filter: _selectedFilter == 'All' ? null : _selectedFilter,
                  );

                  if (tests.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.quiz_outlined, size: 48, color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                          const SizedBox(height: 12),
                          Text(
                            'No mock tests in this category yet.',
                            style: TextStyle(
                              color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                            ),
                          ),
                        ],
                      ),
                    );
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.all(AppDimens.space16),
                    itemCount: tests.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 14),
                    itemBuilder: (context, index) {
                      final test = tests[index];
                      return _MockTestListCard(mockTest: test);
                    },
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

class _MockTestListCard extends StatelessWidget {
  final MockTest mockTest;

  const _MockTestListCard({required this.mockTest});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AnimatedPressable(
      onTap: () => context.push('/tests/instructions/${mockTest.id}'),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    if (mockTest.isLive) ...[
                      StatusBadge.live(),
                      const SizedBox(width: 6),
                    ],
                    if (mockTest.isPreviousYear) ...[
                      StatusBadge.pyq(),
                      const SizedBox(width: 6),
                    ],
                    if (mockTest.isFree) StatusBadge.free(),
                  ],
                ),
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
            const SizedBox(height: 6),
            Text(
              '${mockTest.totalQuestions} Questions • ${mockTest.durationMinutes} Minutes\n${mockTest.totalMarks.toInt()} Marks • -${mockTest.negativeMarks.toStringAsFixed(2)} Negative',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.layers_outlined, size: 16, color: AppColors.actionBlue),
                    const SizedBox(width: 4),
                    Text(
                      '${mockTest.sections.length} Sections',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.actionBlue,
                      ),
                    ),
                  ],
                ),
                ElevatedButton(
                  onPressed: () => context.push('/tests/instructions/${mockTest.id}'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(110, 38),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  child: const Text('Start Test', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
