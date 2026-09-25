import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/models/models.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../core/services/firestore_service.dart';
import '../../../core/services/live_test_gate_service.dart';

class TestInstructionsScreen extends StatefulWidget {
  final String testId;

  const TestInstructionsScreen({super.key, required this.testId});

  @override
  State<TestInstructionsScreen> createState() => _TestInstructionsScreenState();
}

class _TestInstructionsScreenState extends State<TestInstructionsScreen> {
  bool _agreedToTerms = true;
  bool _isStarting = false;
  bool _isLoading = false;
  MockTest? _fetchedTest;

  @override
  void initState() {
    super.initState();
    _ensureTestLoaded();
  }

  Future<void> _ensureTestLoaded() async {
    final local = LocalDatabase.instance.getMockTestById(widget.testId);
    if (local != null) return;

    if (mounted) setState(() => _isLoading = true);
    try {
      final remote = await FirestoreService.instance.fetchMockTest(widget.testId);
      if (remote != null) {
        if (mounted) {
          setState(() {
            _fetchedTest = remote;
            _isLoading = false;
          });
        }
        return;
      }
    } catch (_) {}
    if (mounted) setState(() => _isLoading = false);
  }

  void _onStartTest(MockTest test) {
    if (_isStarting) return;

    final decision = LiveTestGateService.evaluateAccess(testIdOrLiveTestId: test.id, mockTest: test);
    if (!decision.isAllowed) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(decision.message),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _isStarting = true);
    context.pushReplacement('/tests/cbt/${test.id}');
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final test = LocalDatabase.instance.getMockTestById(widget.testId) ?? _fetchedTest;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Test Instructions')),
        body: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 14),
              Text('Loading test details...', style: TextStyle(fontSize: 13)),
            ],
          ),
        ),
      );
    }

    if (test == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Test Instructions')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.info_outline, size: 48, color: AppColors.textMutedLight),
                const SizedBox(height: 16),
                const Text(
                  'Test Unavailable',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text(
                  'This examination is in Draft, no longer active, or could not be loaded.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () => context.go('/tests'),
                  child: const Text('Browse Available Tests'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // Gate Enforcement: Check publication, registration, time window, and entitlement
    final gateDecision = LiveTestGateService.evaluateAccess(testIdOrLiveTestId: test.id, mockTest: test);
    if (!gateDecision.isAllowed) {
      return Scaffold(
        appBar: AppBar(title: const Text('Test Instructions')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  gateDecision.status == LiveTestGateStatus.upcomingBeforeStart
                      ? Icons.lock_clock
                      : Icons.block,
                  size: 52,
                  color: gateDecision.status == LiveTestGateStatus.upcomingBeforeStart
                      ? AppColors.actionBlue
                      : AppColors.error,
                ),
                const SizedBox(height: 16),
                Text(
                  gateDecision.status == LiveTestGateStatus.upcomingBeforeStart
                      ? 'Test Not Started Yet'
                      : (gateDecision.status == LiveTestGateStatus.testEnded
                          ? 'Live Test Ended'
                          : (gateDecision.status == LiveTestGateStatus.notRegistered
                              ? 'Registration Required'
                              : 'Access Blocked')),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                Text(
                  gateDecision.message,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => context.go('/home'),
                  child: const Text('Return to Home'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Test Instructions', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppDimens.space16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Overview Card
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              StatusBadge.exam(test.examCode),
                              const SizedBox(width: 8),
                              if (test.isLive)
                                StatusBadge.live()
                              else if (test.isFree)
                                StatusBadge.free()
                              else if (LocalDatabase.instance.isTestUnlocked(test))
                                StatusBadge.unlocked()
                              else
                                StatusBadge.paid(price: test.offerPrice ?? test.price),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            test.title,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceAround,
                              children: [
                                _TestStatCol(title: 'Questions', value: '${test.totalQuestions}'),
                                _TestStatCol(title: 'Time', value: '${test.durationMinutes} Mins'),
                                _TestStatCol(title: 'Marks', value: test.totalMarks.toStringAsFixed(2)),
                                _TestStatCol(title: 'Negative', value: '-${test.negativeMarks.toStringAsFixed(2)}'),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Section Details
                    Text(
                      'Exam Sections (${test.sections.length})',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 10),
                    AppCard(
                      padding: EdgeInsets.zero,
                      child: Column(
                        children: List.generate(test.sections.length, (index) {
                          final sec = test.sections[index];
                          return ListTile(
                            dense: true,
                            leading: CircleAvatar(
                              radius: 14,
                              backgroundColor: AppColors.actionBlueLight,
                              child: Text(
                                '${index + 1}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.actionBlue,
                                ),
                              ),
                            ),
                            title: Text(
                              sec.name,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                            ),
                            trailing: Text(
                              '${sec.questionIds.length} Qs',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                              ),
                            ),
                          );
                        }),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // SSC CBT Color Legend Instructions
                    Text(
                      'Question Palette Legend',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 10),
                    AppCard(
                      child: Column(
                        children: [
                          _LegendRow(
                            badge: StatusBadge.cbtState(CbtQuestionState.answered),
                            description: 'Question has been answered and saved',
                          ),
                          const SizedBox(height: 8),
                          _LegendRow(
                            badge: StatusBadge.cbtState(CbtQuestionState.notAnswered),
                            description: 'Visited question without answering',
                          ),
                          const SizedBox(height: 8),
                          _LegendRow(
                            badge: StatusBadge.cbtState(CbtQuestionState.markedForReview),
                            description: 'Marked for review without answering',
                          ),
                          const SizedBox(height: 8),
                          _LegendRow(
                            badge: StatusBadge.cbtState(CbtQuestionState.answeredAndMarked),
                            description: 'Answered and marked for review (evaluated)',
                          ),
                          const SizedBox(height: 8),
                          _LegendRow(
                            badge: StatusBadge.cbtState(CbtQuestionState.notVisited),
                            description: 'Question not visited yet',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // General Instructions
                    Text(
                      'Important Instructions',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 10),
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          _BulletPoint(text: 'The clock has been set at the server/system and the countdown timer at the top indicates time left.'),
                          _BulletPoint(text: 'When the timer reaches zero, the examination will end automatically and submit your responses.'),
                          _BulletPoint(text: 'You can switch between sections at any time during the examination.'),
                          _BulletPoint(text: 'Click on Save & Next to save your answer before proceeding.'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Agreement Checkbox
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Checkbox(
                          value: _agreedToTerms,
                          activeColor: AppColors.actionBlue,
                          onChanged: (val) {
                            setState(() {
                              _agreedToTerms = val ?? false;
                            });
                          },
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: () {
                              setState(() {
                                _agreedToTerms = !_agreedToTerms;
                              });
                            },
                            child: Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                'I have read and understood all instructions. I understand that the test will automatically submit when time expires.',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                  height: 1.35,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Start Test CTA
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.surfaceDark : Colors.white,
                border: Border(
                  top: BorderSide(
                    color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
                  ),
                ),
              ),
              child: SizedBox(
                width: double.infinity,
                height: AppDimens.minButtonHeight,
                child: ElevatedButton(
                  onPressed: (_agreedToTerms && !_isStarting) ? () => _onStartTest(test) : null,
                  child: _isStarting
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('I am ready to begin', style: TextStyle(fontWeight: FontWeight.w700)),
                            SizedBox(width: 8),
                            Icon(Icons.arrow_forward, size: 18),
                          ],
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TestStatCol extends StatelessWidget {
  final String title;
  final String value;
  const _TestStatCol({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
        ),
        const SizedBox(height: 2),
        Text(
          title,
          style: TextStyle(
            fontSize: 11,
            color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
          ),
        ),
      ],
    );
  }
}

class _LegendRow extends StatelessWidget {
  final Widget badge;
  final String description;
  const _LegendRow({required this.badge, required this.description});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      children: [
        SizedBox(width: 135, child: badge),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            description,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
            ),
          ),
        ),
      ],
    );
  }
}

class _BulletPoint extends StatelessWidget {
  final String text;
  const _BulletPoint({required this.text});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('• ', style: TextStyle(color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight, fontSize: 14)),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12,
                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
