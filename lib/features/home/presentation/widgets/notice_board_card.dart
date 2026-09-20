import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/database/local_database.dart';
import '../../../../core/models/models.dart';
import '../../../../core/providers/app_providers.dart';
import '../../../../core/widgets/animated_pressable.dart';
import '../../../notices/presentation/notice_details_sheet.dart';

class NoticeBoardCard extends ConsumerStatefulWidget {
  const NoticeBoardCard({super.key});

  @override
  ConsumerState<NoticeBoardCard> createState() => _NoticeBoardCardState();
}

class _NoticeBoardCardState extends ConsumerState<NoticeBoardCard> with WidgetsBindingObserver {
  Timer? _rotationTimer;
  int _currentIndex = 0;
  bool _isPaused = false;
  static const int _kVisibleCount = 3;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startRotation();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _isPaused = false;
      _startRotation();
    } else {
      _isPaused = true;
      _stopRotation();
    }
  }

  void _startRotation() {
    _rotationTimer?.cancel();
    _rotationTimer = Timer.periodic(const Duration(milliseconds: 3500), (timer) {
      if (!mounted || _isPaused) return;
      setState(() {
        _currentIndex++;
      });
    });
  }

  void _stopRotation() {
    _rotationTimer?.cancel();
    _rotationTimer = null;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopRotation();
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
      return DateFormat('dd MMM').format(d);
    }
    return n.date;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final streamNotices = ref.watch(noticesStreamProvider).value;
    final allNotices = (streamNotices != null && streamNotices.isNotEmpty)
        ? streamNotices
        : LocalDatabase.instance.getNotices();

    final activeNotices = allNotices.where((n) => n.isCurrentlyActive).toList();
    activeNotices.sort((a, b) {
      if (a.isPinned != b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      final aDate = a.publishAt ?? DateTime.tryParse(a.date) ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bDate = b.publishAt ?? DateTime.tryParse(b.date) ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bDate.compareTo(aDate);
    });

    if (activeNotices.isEmpty) {
      return const SizedBox.shrink();
    }

    // Determine current window of visible notices (up to 3)
    final total = activeNotices.length;
    final startIndex = total > 0 ? (_currentIndex % total) : 0;
    final visibleNotices = <AppNotice>[];
    final countToTake = total < _kVisibleCount ? total : _kVisibleCount;
    for (int i = 0; i < countToTake; i++) {
      visibleNotices.add(activeNotices[(startIndex + i) % total]);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('📢', style: TextStyle(fontSize: 18)),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      'Notice Board',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: () => context.push('/notices'),
              child: const Text('View All'),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Animated Notice Container
        Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : Colors.white,
            borderRadius: AppDimens.cardBorderRadius,
            border: Border.all(
              color: isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha(isDark ? 25 : 8),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            transitionBuilder: (child, animation) {
              return FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0.0, 0.05),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              );
            },
            child: KeyedSubtree(
              key: ValueKey<int>(startIndex),
              child: Column(
                children: List.generate(visibleNotices.length, (index) {
                  final notice = visibleNotices[index];
                  final isLast = index == visibleNotices.length - 1;
                  final typeColor = _getTypeColor(notice.type);

                  return Column(
                    children: [
                      AnimatedPressable(
                        onTap: () => NoticeDetailsSheet.show(context, notice),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppDimens.space14,
                            vertical: 11,
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Wrap(
                                      crossAxisAlignment: WrapCrossAlignment.center,
                                      spacing: 6,
                                      runSpacing: 3,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: typeColor.withAlpha(22),
                                            borderRadius: BorderRadius.circular(3),
                                          ),
                                          child: Text(
                                            notice.typeDisplayName,
                                            style: TextStyle(
                                              color: typeColor,
                                              fontSize: 9,
                                              fontWeight: FontWeight.w800,
                                              letterSpacing: 0.3,
                                            ),
                                          ),
                                        ),
                                        if (notice.isPinned)
                                          const Icon(Icons.push_pin, size: 12, color: AppColors.actionBlue),
                                        Text(
                                          _formatDate(notice),
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                          ),
                                        ),
                                        if (notice.isNew)
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
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      notice.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: isDark ? AppColors.textDark : AppColors.textLight,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(
                                Icons.chevron_right,
                                size: 18,
                                color: isDark ? Colors.white38 : Colors.black26,
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (!isLast)
                        Divider(
                          height: 1,
                          thickness: 1,
                          color: isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight,
                        ),
                    ],
                  );
                }),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
