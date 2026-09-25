import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/database/local_database.dart';
import '../../../../core/models/models.dart';
import '../../../../core/providers/app_providers.dart';
import '../../../../core/widgets/animated_pressable.dart';
import 'live_test_details_sheet.dart';

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

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final streamLiveTests = ref.watch(liveTestsStreamProvider).value;
    final allTests = (streamLiveTests != null && streamLiveTests.isNotEmpty)
        ? streamLiveTests
        : LocalDatabase.instance.getLiveTests();

    // Canonical publication rule:
    // A Live Test is candidate ONLY IF:
    // 1. liveTest.isPublished == true
    // 2. status is live or upcoming
    // 3. linked Mock exists in published mocks (mock.status == 'published')
    final candidateTests = allTests.where((t) {
      if (!t.isPublished) return false;
      if (t.status != LiveTestStatus.live && t.status != LiveTestStatus.upcoming) return false;
      if (t.testId.trim().isEmpty) return false;
      final mock = LocalDatabase.instance.getMockTestById(t.testId);
      if (mock == null || mock.status.toLowerCase() != 'published') return false;
      return true;
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
    final linkedMock = LocalDatabase.instance.getMockTestById(liveTest.testId);

    if (linkedMock == null) {
      return const SizedBox.shrink();
    }

    final detailText = (linkedMock.totalQuestions > 0 && linkedMock.durationMinutes > 0)
        ? '${linkedMock.totalQuestions} Questions • ${linkedMock.durationMinutes} Minutes'
        : (linkedMock.totalQuestions > 0
            ? '${linkedMock.totalQuestions} Questions'
            : 'Live Examination');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Typography Heading
        Text(
          'Live Tests',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        AnimatedPressable(
          onTap: () {
            LiveTestDetailsSheet.show(
              context,
              liveTest: liveTest,
              mockTest: linkedMock,
            );
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
                // Top row: Status Tag & Timer
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Status Tag
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withAlpha(30),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withAlpha(50)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isLive ? Colors.amberAccent : Colors.lightBlueAccent,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            isLive ? 'LIVE NOW' : 'UPCOMING TEST',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Countdown Display
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withAlpha(40),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.timer_outlined, size: 14, color: Colors.white),
                          const SizedBox(width: 5),
                          Text(
                            isLive
                                ? 'Ends: ${_formatDuration(liveTest.remainingDuration)}'
                                : 'Starts: ${_formatDuration(liveTest.remainingDuration)}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Test Title
                Text(
                  liveTest.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 6),

                // Details Text
                Text(
                  detailText,
                  style: TextStyle(
                    color: Colors.white.withAlpha(200),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 16),

                // Bottom Action Button / Prompt
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        isLive ? Icons.play_arrow_rounded : Icons.info_outline,
                        size: 18,
                        color: isLive ? const Color(0xFF991B1B) : const Color(0xFF1E40AF),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        isLive ? 'JOIN TEST' : 'VIEW DETAILS & REGISTER',
                        style: TextStyle(
                          color: isLive ? const Color(0xFF991B1B) : const Color(0xFF1E40AF),
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
