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
import '../../../core/billing/billing_service.dart';

class TestsScreen extends ConsumerStatefulWidget {
  const TestsScreen({super.key});

  @override
  ConsumerState<TestsScreen> createState() => _TestsScreenState();
}

class _TestsScreenState extends ConsumerState<TestsScreen>
    with SingleTickerProviderStateMixin {
  TabController? _tabController;
  List<String> _examTabs = ['All'];

  String _selectedFilter = 'All';
  final List<String> _filters = ['All', 'Free', 'Live', 'Previous Year'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 1, vsync: this);
  }

  void _rebuildTabs(List<String> newTabs) {
    if (newTabs.length != _examTabs.length) {
      _tabController?.dispose();
      _tabController = TabController(length: newTabs.length, vsync: this);
      _examTabs = newTabs;
    }
  }

  @override
  void dispose() {
    _tabController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Dynamic exam tabs from Firestore
    final dbExams = ref.watch(examsStreamProvider).value ??
        LocalDatabase.instance.getExams();
    final examTabs = ['All', ...dbExams.map((e) => e.code)];
    _rebuildTabs(examTabs);

    // Dynamic mock tests from Firestore
    final allMocks = ref.watch(mockTestsStreamProvider).value ??
        LocalDatabase.instance.getMockTests();

    final controller = _tabController!;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mock Tests & CBT', style: TextStyle(fontWeight: FontWeight.w700)),
        bottom: TabBar(
          controller: controller,
          isScrollable: examTabs.length > 4,
          indicatorColor: AppColors.actionBlue,
          labelColor: AppColors.actionBlue,
          unselectedLabelColor: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: examTabs.map((e) => Tab(text: e)).toList(),
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
                    label: Text(f,
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500)),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() => _selectedFilter = f);
                      }
                    },
                    selectedColor: AppColors.actionBlue,
                    labelStyle: TextStyle(
                      color: isSelected
                          ? Colors.white
                          : (isDark ? AppColors.textDark : AppColors.textLight),
                    ),
                    side: BorderSide(
                      color: isSelected
                          ? AppColors.actionBlue
                          : (isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight),
                    ),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppDimens.radiusPill)),
                  );
                },
              ),
            ),

            // Mock Tests List for Current Tab & Filter — live from Firestore
            Expanded(
              child: Builder(
                builder: (context) {
                  final tabIdx = controller.index.clamp(0, examTabs.length - 1);
                  final currentTab = examTabs[tabIdx];
                  final examCode = currentTab == 'All' ? 'ALL' : currentTab.toUpperCase();

                  // Filter from reactive stream
                  var tests = examCode == 'ALL'
                      ? allMocks
                      : allMocks
                          .where((m) => m.examCode.toUpperCase() == examCode)
                          .toList();

                  if (_selectedFilter == 'Free') {
                    tests = tests.where((m) => m.isFree).toList();
                  } else if (_selectedFilter == 'Live') {
                    tests = tests.where((m) => m.isLive).toList();
                  } else if (_selectedFilter == 'Previous Year') {
                    tests = tests.where((m) => m.isPreviousYear).toList();
                  }

                  if (tests.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.quiz_outlined,
                              size: 48,
                              color: isDark
                                  ? AppColors.textMutedDark
                                  : AppColors.textMutedLight),
                          const SizedBox(height: 12),
                          Text(
                            'No mock tests in this category yet.',
                            style: TextStyle(
                              color: isDark
                                  ? AppColors.textMutedDark
                                  : AppColors.textMutedLight,
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

class _MockTestListCard extends StatefulWidget {
  final MockTest mockTest;

  const _MockTestListCard({required this.mockTest});

  @override
  State<_MockTestListCard> createState() => _MockTestListCardState();
}

class _MockTestListCardState extends State<_MockTestListCard> {
  void _handleTestTap(BuildContext context) {
    final isUnlocked = LocalDatabase.instance.isTestUnlocked(widget.mockTest);
    if (isUnlocked) {
      context.push('/tests/instructions/${widget.mockTest.id}');
    } else {
      _showPaidTestSheet(context, widget.mockTest);
    }
  }

  void _showPaidTestSheet(BuildContext context, MockTest test) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final price = test.offerPrice ?? test.price ?? 99.0;
    final origPrice = test.originalPrice;

    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(AppDimens.space24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.lock_outline, color: Color(0xFFB45309), size: 28),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              test.title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Text(
                  '₹${price.toStringAsFixed(0)}',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.actionBlue),
                ),
                if (origPrice != null && origPrice > price) ...[
                  const SizedBox(width: 8),
                  Text(
                    '₹${origPrice.toStringAsFixed(0)}',
                    style: TextStyle(
                      fontSize: 16,
                      color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            Text(
              'Unlock this complete CBT mock test with section-wise questions, timer simulation, detailed explanations, and 100% ad-free experience via Google Play.',
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  final success = await BillingService.instance.buyMockTest(
                    testId: test.id,
                    testTitle: test.title,
                    productId: test.productId,
                    amount: price,
                  );
                  if (mounted) setState(() {});
                  if (success && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Unlocked "${test.title}" successfully!'),
                        backgroundColor: AppColors.success,
                      ),
                    );
                    context.push('/tests/instructions/${test.id}');
                  }
                },
                child: Text('Unlock with Google Play (₹${price.toStringAsFixed(0)})'),
              ),
            ),
            const SizedBox(height: 8),
            Center(
              child: TextButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await BillingService.instance.restorePurchases();
                  if (mounted) setState(() {});
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Checking previous Google Play purchases...')),
                    );
                  }
                },
                child: const Text(
                  'Already purchased? Restore purchases',
                  style: TextStyle(fontSize: 12, color: AppColors.actionBlue),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mockTest = widget.mockTest;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final displayPrice = mockTest.offerPrice ?? mockTest.price;

    return ValueListenableBuilder<Set<String>>(
      valueListenable: BillingService.instance.unlockedNotifier,
      builder: (context, unlockedSet, _) {
        final isUnlocked = LocalDatabase.instance.isTestUnlocked(mockTest);

        return AnimatedPressable(
          onTap: () => _handleTestTap(context),
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
                        if (mockTest.isFree)
                          StatusBadge.free()
                        else if (isUnlocked)
                          StatusBadge.unlocked()
                        else
                          StatusBadge.paid(price: displayPrice),
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
                      onPressed: () => _handleTestTap(context),
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size(110, 38),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                      ),
                      child: Text(
                        isUnlocked ? 'Start Test' : 'Unlock (₹${displayPrice?.toInt() ?? 99})',
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
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
}
