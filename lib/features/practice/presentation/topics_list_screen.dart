import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/services/firestore_service.dart';
import '../../../core/widgets/animated_pressable.dart';
import '../../../core/widgets/app_card.dart';

class TopicsListScreen extends StatefulWidget {
  final String subjectId;

  const TopicsListScreen({super.key, required this.subjectId});

  @override
  State<TopicsListScreen> createState() => _TopicsListScreenState();
}

class _TopicsListScreenState extends State<TopicsListScreen> {
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    _syncSubjectQuestions();
  }

  Future<void> _syncSubjectQuestions() async {
    setState(() => _isSyncing = true);
    try {
      await FirestoreService.instance.fetchQuestionsForSubject(widget.subjectId);
    } catch (_) {}
    if (mounted) {
      setState(() => _isSyncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final subject = LocalDatabase.instance.getSubjectById(widget.subjectId);
    final topics = LocalDatabase.instance.getTopicsBySubject(widget.subjectId);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          subject?.name ?? 'Practice Topics',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_isSyncing)
              const LinearProgressIndicator(
                minHeight: 2,
                backgroundColor: Colors.transparent,
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.actionBlue),
              ),
            Expanded(
              child: topics.isEmpty
                  ? Center(
                      child: Text(
                        'No topics found for this subject.',
                        style: TextStyle(
                          color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _syncSubjectQuestions,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(AppDimens.space16),
                        itemCount: topics.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                    final topic = topics[index];
                    final eligibleQuestions = LocalDatabase.instance.getQuestionsByTopic(topic.id);
                    final questionCount = eligibleQuestions.isNotEmpty
                        ? eligibleQuestions.length
                        : topic.questionCount;
                    final attemptedCount = LocalDatabase.instance.getTopicAttemptedCount(topic.id);
                    final accuracy = LocalDatabase.instance.getTopicAccuracy(topic.id);
                    final progress = questionCount > 0 ? (attemptedCount / questionCount).clamp(0.0, 1.0) : 0.0;
                    final percentage = (progress * 100).toInt();

                    return AnimatedPressable(
                      onTap: () async {
                        await context.push('/practice/mcq/${topic.id}');
                        if (mounted) setState(() {});
                      },
                      child: AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    topic.name,
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                Row(
                                  children: [
                                    Text(
                                      'Continue',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.actionBlue,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    const Icon(Icons.arrow_forward, size: 14, color: AppColors.actionBlue),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '$questionCount Questions • ${accuracy.toInt()}% Accuracy',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                              ),
                            ),
                            const SizedBox(height: 14),
                            // Progress Bar
                            Row(
                              children: [
                                Expanded(
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(AppDimens.radiusPill),
                                    child: LinearProgressIndicator(
                                      value: progress,
                                      minHeight: 6,
                                      backgroundColor: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                                      valueColor: const AlwaysStoppedAnimation<Color>(AppColors.actionBlue),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  '$percentage%',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.actionBlue,
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
            ),
          ],
        ),
      ),
    );
  }
}
