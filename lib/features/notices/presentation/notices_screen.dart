import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/models/models.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/animated_pressable.dart';
import 'notice_details_sheet.dart';

class NoticesScreen extends ConsumerStatefulWidget {
  const NoticesScreen({super.key});

  @override
  ConsumerState<NoticesScreen> createState() => _NoticesScreenState();
}

class _NoticesScreenState extends ConsumerState<NoticesScreen> {
  String _selectedFilter = 'All';
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  static const List<String> _filters = [
    'All',
    'Jobs',
    'Admit Card',
    'Results',
    'Answer Key',
    'Exam Date',
    'Notices',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Color _getTypeColor(String type) {
    switch (type.toUpperCase().replaceAll(' ', '_')) {
      case 'JOB':
        return const Color(0xFF2563EB); // Royal Blue
      case 'ADMIT_CARD':
        return const Color(0xFFD97706); // Amber
      case 'RESULT':
        return const Color(0xFF16A34A); // Emerald Green
      case 'ANSWER_KEY':
        return const Color(0xFF9333EA); // Purple
      case 'EXAM_DATE':
        return const Color(0xFFEA580C); // Orange
      case 'NOTICE':
      default:
        return const Color(0xFF475569); // Slate
    }
  }

  String _formatDate(AppNotice n) {
    final d = n.publishAt ?? DateTime.tryParse(n.date);
    if (d != null) {
      return DateFormat('dd MMM yyyy').format(d);
    }
    return n.date;
  }

  bool _matchesFilter(AppNotice notice) {
    if (_selectedFilter == 'All') return true;
    final raw = notice.type.trim().isEmpty ? 'NOTICE' : notice.type.trim();
    final normalized = raw.toUpperCase().replaceAll(' ', '_');
    switch (_selectedFilter) {
      case 'Jobs':
        return normalized == 'JOB';
      case 'Admit Card':
        return normalized == 'ADMIT_CARD';
      case 'Results':
        return normalized == 'RESULT';
      case 'Answer Key':
        return normalized == 'ANSWER_KEY';
      case 'Exam Date':
        return normalized == 'EXAM_DATE';
      case 'Notices':
        return normalized == 'NOTICE';
      default:
        return true;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final streamNotices = ref.watch(noticesStreamProvider).value;
    final allNotices = (streamNotices != null && streamNotices.isNotEmpty)
        ? streamNotices
        : LocalDatabase.instance.getNotices();

    // Filter active and by filter chip & search query
    final filtered = allNotices.where((n) {
      if (!n.isCurrentlyActive) return false;
      if (!_matchesFilter(n)) return false;
      if (_searchQuery.trim().isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchTitle = n.title.toLowerCase().contains(q);
        final matchDesc = n.displayDescription.toLowerCase().contains(q);
        final matchOrg = (n.organization ?? '').toLowerCase().contains(q);
        if (!matchTitle && !matchDesc && !matchOrg) return false;
      }
      return true;
    }).toList();

    // Sort: pinned first, newest published first
    filtered.sort((a, b) {
      if (a.isPinned != b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      final aDate = a.publishAt ?? DateTime.tryParse(a.date) ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bDate = b.publishAt ?? DateTime.tryParse(b.date) ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bDate.compareTo(aDate);
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notice Board', style: TextStyle(fontWeight: FontWeight.w700)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          // Search Field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16, vertical: 8),
            child: TextField(
              controller: _searchController,
              onChanged: (val) => setState(() => _searchQuery = val),
              decoration: InputDecoration(
                hintText: 'Search updates, jobs, results...',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                filled: true,
                fillColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),

          // Filter Chips Row
          SizedBox(
            height: 42,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16),
              itemCount: _filters.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final filter = _filters[index];
                final isSelected = _selectedFilter == filter;
                return FilterChip(
                  label: Text(
                    filter,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected
                          ? Colors.white
                          : (isDark ? AppColors.textDark : AppColors.textLight),
                    ),
                  ),
                  selected: isSelected,
                  onSelected: (val) {
                    setState(() => _selectedFilter = filter);
                  },
                  backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                  selectedColor: AppColors.actionBlue,
                  showCheckmark: false,
                  side: BorderSide(
                    color: isSelected
                        ? AppColors.actionBlue
                        : (isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight),
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 10),

          // Notices List
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(noticesStreamProvider);
              },
              child: filtered.isEmpty
                  ? Center(
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(AppDimens.space24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.actionBlue.withAlpha(20),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.notifications_none, size: 40, color: AppColors.actionBlue),
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'No Notices Found',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _searchQuery.isNotEmpty
                                  ? 'No notices match your search "$_searchQuery".'
                                  : 'There are no active notices for this category yet.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppDimens.space16,
                        vertical: AppDimens.space8,
                      ),
                      itemCount: filtered.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final notice = filtered[index];
                        final typeColor = _getTypeColor(notice.type);

                        return AnimatedPressable(
                          onTap: () => NoticeDetailsSheet.show(context, notice),
                          child: Container(
                            padding: const EdgeInsets.all(AppDimens.space14),
                            decoration: BoxDecoration(
                              color: isDark ? AppColors.surfaceDark : Colors.white,
                              borderRadius: AppDimens.cardBorderRadius,
                              border: Border.all(
                                color: isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withAlpha(isDark ? 25 : 8),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                                            decoration: BoxDecoration(
                                              color: typeColor.withAlpha(22),
                                              borderRadius: BorderRadius.circular(4),
                                              border: Border.all(color: typeColor.withAlpha(80), width: 0.8),
                                            ),
                                            child: Text(
                                              notice.typeDisplayName,
                                              style: TextStyle(
                                                color: typeColor,
                                                fontSize: 9.5,
                                                fontWeight: FontWeight.w800,
                                                letterSpacing: 0.4,
                                              ),
                                            ),
                                          ),
                                          if (notice.isPinned) ...[
                                            const SizedBox(width: 6),
                                            const Icon(Icons.push_pin, size: 13, color: AppColors.actionBlue),
                                          ],
                                          const SizedBox(width: 8),
                                          Text(
                                            _formatDate(notice),
                                            style: TextStyle(
                                              fontSize: 11,
                                              color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                            ),
                                          ),
                                          if (notice.isNew) ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                              decoration: BoxDecoration(
                                                color: AppColors.error,
                                                borderRadius: BorderRadius.circular(3),
                                              ),
                                              child: const Text(
                                                'NEW',
                                                style: TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 8.5,
                                                  fontWeight: FontWeight.w800,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        notice.title,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          height: 1.35,
                                        ),
                                      ),
                                      if (notice.displayDescription.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          notice.displayDescription,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                            height: 1.35,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Icon(
                                  Icons.chevron_right,
                                  size: 20,
                                  color: isDark ? Colors.white38 : Colors.black26,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
