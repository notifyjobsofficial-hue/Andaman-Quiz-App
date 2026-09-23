import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/database/local_database.dart';
import '../../../../core/models/models.dart';

/// Opens a practice topic respecting resume/restart rules:
/// - If no previous progress: starts immediately from Question 1 (no bottom sheet).
/// - If previous progress exists: presents the PracticeStartBottomSheet.
Future<void> openPracticeTopic(BuildContext context, Topic topic) async {
  final db = LocalDatabase.instance;
  final questions = db.getQuestionsByTopic(topic.id);
  final totalQuestions = questions.isNotEmpty ? questions.length : topic.questionCount;
  final attemptedCount = db.getTopicAttemptedCount(topic.id);

  // Requirement: No existing progress -> start immediately from Question 1. Do NOT show unnecessary bottom sheet.
  if (attemptedCount <= 0) {
    await context.push('/practice/mcq/${topic.id}');
    return;
  }

  // Previous progress exists -> show bottom sheet
  if (context.mounted) {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => PracticeStartBottomSheet(
        topic: topic,
        questions: questions,
        totalQuestions: totalQuestions,
        attemptedCount: attemptedCount,
      ),
    );
  }
}

class PracticeStartBottomSheet extends StatefulWidget {
  final Topic topic;
  final List<Question> questions;
  final int totalQuestions;
  final int attemptedCount;

  const PracticeStartBottomSheet({
    super.key,
    required this.topic,
    required this.questions,
    required this.totalQuestions,
    required this.attemptedCount,
  });

  @override
  State<PracticeStartBottomSheet> createState() => _PracticeStartBottomSheetState();
}

class _PracticeStartBottomSheetState extends State<PracticeStartBottomSheet> {
  bool _isProcessing = false;

  Future<void> _handleStartFromQuestion1() async {
    if (_isProcessing) return;

    // Ask confirmation before resetting existing progress
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Restart Practice?',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        content: Text(
          'Starting from Question 1 will reset your current progress (${widget.attemptedCount} / ${widget.totalQuestions} completed) for "${widget.topic.name}".\n\nYour bookmarks and overall performance records will not be deleted.',
          style: const TextStyle(fontSize: 14, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.actionBlue,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.of(dialogCtx).pop(true),
            child: const Text('Restart from Q1'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      setState(() => _isProcessing = true);
      // Reset local topic practice progress
      await LocalDatabase.instance.resetTopicPracticeProgress(widget.topic.id);
      if (mounted) {
        Navigator.of(context).pop(); // close bottom sheet
        // Start fresh session (mcq_practice_screen will generate a new session ID and increment)
        context.push('/practice/mcq/${widget.topic.id}?mode=restart');
      }
    }
  }

  void _handleContinue() {
    if (_isProcessing) return;
    Navigator.of(context).pop(); // close bottom sheet
    // Continue existing session (preserves answers, does NOT increment counter)
    context.push('/practice/mcq/${widget.topic.id}');
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final db = LocalDatabase.instance;

    // Use question IDs to find first currently unattempted question
    final firstUnattemptedIdx = db.getFirstUnattemptedQuestionIndex(widget.topic.id, widget.questions);
    final isCompleted = widget.totalQuestions > 0 &&
        (widget.attemptedCount >= widget.totalQuestions || firstUnattemptedIdx == -1);

    final resumeQuestionNumber = firstUnattemptedIdx != -1
        ? (firstUnattemptedIdx + 1)
        : (widget.attemptedCount < widget.totalQuestions ? widget.attemptedCount + 1 : 1);

    final progressRatio = widget.totalQuestions > 0
        ? (widget.attemptedCount / widget.totalQuestions).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: const [
          BoxShadow(color: Colors.black26, blurRadius: 16, offset: Offset(0, -4)),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Center drag handle
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.black12,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),

            // Topic Name & Subject/Exam Tag
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.topic.name,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                      ),
                      if (widget.topic.hindiName.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            widget.topic.hindiName,
                            style: TextStyle(
                              fontSize: 13,
                              color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                if (isCompleted)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.success.withAlpha(25),
                      borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                      border: Border.all(color: AppColors.success.withAlpha(50)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle, size: 14, color: AppColors.success),
                        SizedBox(width: 4),
                        Text(
                          'Practice Completed',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),

            // Progress Overview Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${widget.attemptedCount} / ${widget.totalQuestions} completed',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        '${(progressRatio * 100).toInt()}%',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.actionBlue,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                    child: LinearProgressIndicator(
                      value: progressRatio,
                      minHeight: 8,
                      backgroundColor: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                      valueColor: AlwaysStoppedAnimation<Color>(
                        isCompleted ? AppColors.success : AppColors.actionBlue,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Action Buttons
            if (!isCompleted) ...[
              // Continue button
              SizedBox(
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: _isProcessing ? null : _handleContinue,
                  icon: const Icon(Icons.play_arrow_rounded, size: 22),
                  label: Text(
                    'Continue from Question $resumeQuestionNumber',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.actionBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Start from Question 1 button
              SizedBox(
                height: 44,
                child: OutlinedButton.icon(
                  onPressed: _isProcessing ? null : _handleStartFromQuestion1,
                  icon: const Icon(Icons.restart_alt_rounded, size: 20),
                  label: const Text(
                    'Start from Question 1',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isDark ? Colors.white70 : AppColors.textDark,
                    side: BorderSide(
                      color: isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1),
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ] else ...[
              // Completed Topic: Only "Practice Again from Question 1"
              SizedBox(
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: _isProcessing ? null : _handleStartFromQuestion1,
                  icon: const Icon(Icons.replay_rounded, size: 22),
                  label: const Text(
                    'Practice Again from Question 1',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.actionBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
