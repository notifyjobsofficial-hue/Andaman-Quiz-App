import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/database/local_database.dart';
import '../../../../core/models/models.dart';
import '../../../../core/providers/app_providers.dart';
import '../../../../core/widgets/animated_pressable.dart';

class LiveTestHomeCard extends ConsumerStatefulWidget {
  const LiveTestHomeCard({super.key});

  @override
  ConsumerState<LiveTestHomeCard> createState() => _LiveTestHomeCardState();
}

class _LiveTestHomeCardState extends ConsumerState<LiveTestHomeCard> {
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    if (d.isNegative || d == Duration.zero) return '00:00:00';
    final hours = d.inHours.toString().padLeft(2, '0');
    final minutes = (d.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }

  void _showUpcomingDetails(BuildContext context, LiveTestItem liveTest, MockTest? linkedMock) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.schedule, color: AppColors.actionBlue, size: 22),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                liveTest.title,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              liveTest.instructions != null && liveTest.instructions!.isNotEmpty
                  ? liveTest.instructions!
                  : 'This scheduled examination will become active at the specified start time. Please return when the countdown ends.',
              style: const TextStyle(fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 14),
            if (linkedMock != null) ...[
              Text(
                'Total Questions: ${linkedMock.totalQuestions}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
              Text(
                'Duration: ${linkedMock.durationMinutes} Minutes',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 10),
            ],
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.actionBlue.withAlpha(20),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  const Icon(Icons.timer_outlined, size: 16, color: AppColors.actionBlue),
                  const SizedBox(width: 6),
                  Text(
                    'Starts in: ${_formatDuration(liveTest.remainingDuration)}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.actionBlue,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
          if (liveTest.allowEarlyJoin)
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                context.push('/tests/instructions/${liveTest.mockTestId}');
              },
              child: const Text('Join Early'),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final streamLiveTests = ref.watch(liveTestsStreamProvider).value;
    final allTests = (streamLiveTests != null && streamLiveTests.isNotEmpty)
        ? streamLiveTests
        : LocalDatabase.instance.getLiveTests();

    // Filter valid published tests whose status is either LIVE or UPCOMING
    final candidateTests = allTests.where((t) {
      if (!t.isPublished) return false;
      return t.status == LiveTestStatus.live || t.status == LiveTestStatus.upcoming;
    }).toList();

    if (candidateTests.isEmpty) {
      return const SizedBox.shrink();
    }

    // Sort: LIVE first, then soonest UPCOMING
    candidateTests.sort((a, b) {
      if (a.status == LiveTestStatus.live && b.status != LiveTestStatus.live) return -1;
      if (b.status == LiveTestStatus.live && a.status != LiveTestStatus.live) return 1;
      if (a.featured != b.featured) return a.featured ? -1 : 1;
      return a.startAt.compareTo(b.startAt);
    });

    final liveTest = candidateTests.first;
    final isLive = liveTest.status == LiveTestStatus.live;
    final linkedMock = LocalDatabase.instance.getMockTestById(liveTest.mockTestId);

    final questionsCount = linkedMock?.totalQuestions ?? 100;
    final durationMins = linkedMock?.durationMinutes ?? 120;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedPressable(
          onTap: () {
            if (isLive) {
              context.push('/tests/instructions/${liveTest.mockTestId}');
            } else {
              _showUpcomingDetails(context, liveTest, linkedMock);
            }
          },
          child: Container(
            padding: const EdgeInsets.all(AppDimens.space16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isLive
                    ? (isDark
                        ? [const Color(0xFF7F1D1D), const Color(0xFF991B1B)]
                        : [const Color(0xFF991B1B), const Color(0xFFDC2626)])
                    : (isDark
                        ? [const Color(0xFF1E3A8A), const Color(0xFF1D4ED8)]
                        : [const Color(0xFF1E40AF), const Color(0xFF2563EB)]),
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: AppDimens.cardBorderRadius,
              border: Border.all(
                color: Colors.white.withAlpha(30),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: (isLive ? Colors.red : Colors.blue).withAlpha(40),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: Status indicator badge + Countdown
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withAlpha(45),
                        borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isLive ? const Color(0xFFFDE047) : Colors.white,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            isLive ? 'LIVE NOW' : 'UPCOMING',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.timer_outlined, color: Colors.white70, size: 14),
                        const SizedBox(width: 4),
                        Text(
                          isLive
                              ? 'Ends in ${_formatDuration(liveTest.remainingDuration)}'
                              : 'Starts in ${_formatDuration(liveTest.remainingDuration)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Title
                Text(
                  liveTest.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    height: 1.3,
                  ),
                ),
                const SizedBox(height: 6),

                // Details: Questions & Duration
                Text(
                  '$questionsCount Questions • $durationMins Minutes',
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 14),

                // CTA Button
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(AppDimens.radiusSmall),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            isLive ? 'JOIN TEST' : 'VIEW DETAILS',
                            style: TextStyle(
                              color: isLive ? const Color(0xFFDC2626) : AppColors.actionBlue,
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(
                            Icons.arrow_forward,
                            size: 14,
                            color: isLive ? const Color(0xFFDC2626) : AppColors.actionBlue,
                          ),
                        ],
                      ),
                    ),
                    if (!isLive)
                      Text(
                        'Scheduled Exam',
                        style: TextStyle(
                          color: Colors.white.withAlpha(180),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
