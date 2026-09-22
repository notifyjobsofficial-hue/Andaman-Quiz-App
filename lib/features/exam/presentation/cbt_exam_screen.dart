import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/models/models.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/widgets/animated_pressable.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../core/widgets/question_source_metadata.dart';
import '../../../core/widgets/question_text_view.dart';
import '../../../core/services/firestore_service.dart';
import '../../../core/ads/ad_service.dart';

class CbtExamScreen extends ConsumerStatefulWidget {
  final String testId;

  const CbtExamScreen({super.key, required this.testId});

  @override
  ConsumerState<CbtExamScreen> createState() => _CbtExamScreenState();
}

class _CbtExamScreenState extends ConsumerState<CbtExamScreen> with WidgetsBindingObserver {
  late MockTest _test;
  late DateTime _startTime;
  late DateTime _endTime;

  int _currentSectionIndex = 0;
  int _currentQuestionIndex = 0;

  // Question IDs in current section
  late List<String> _currentSectionQuestionIds;
  // All questions cached by ID
  final Map<String, Question> _questionCache = {};

  // Test state maps
  final Map<String, int> _selectedAnswers = {}; // questionId -> optionIndex
  final Map<String, CbtQuestionState> _questionStates = {}; // questionId -> state

  bool _isSubmitting = false;
  bool _isLoadingQuestions = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initExam();
  }

  Future<void> _initExam() async {
    MockTest? mock = LocalDatabase.instance.getMockTestById(widget.testId);
    if (mock == null) {
      try {
        mock = await FirestoreService.instance.fetchMockTest(widget.testId);
        if (mock != null) {
          await LocalDatabase.instance.syncMockTestsFromFirestore([mock]);
        }
      } catch (_) {}
    }

    if (mock == null) {
      if (mounted) {
        setState(() {
          _loadError = 'The requested examination could not be loaded. Please return to tests.';
          _isLoadingQuestions = false;
        });
      }
      return;
    }
    _test = mock;

    // Collect all question IDs from all sections
    final allQuestionIds = <String>[];
    for (final sec in _test.sections) {
      allQuestionIds.addAll(sec.questionIds);
    }

    // Fetch questions on-demand from Firestore (only the IDs needed for this test)
    if (allQuestionIds.isNotEmpty) {
      await FirestoreService.instance.fetchQuestionsForTest(allQuestionIds);
    }

    // Build question cache from local DB (now populated by fetchQuestionsForTest)
    // Only published questions are added to the active test runner session
    for (final sec in _test.sections) {
      for (final qId in sec.questionIds) {
        final q = LocalDatabase.instance.getQuestionById(qId);
        if (q != null && q.isPublished) {
          _questionCache[qId] = q;
        }
        _questionStates[qId] = CbtQuestionState.notVisited;
      }
    }

    _startTime = DateTime.now();
    _endTime = _startTime.add(Duration(minutes: _test.durationMinutes));

    // Check for an active unexpired draft attempt
    bool draftRestored = false;
    final draft = LocalDatabase.instance.getExamDraft(_test.id);
    if (draft != null) {
      final endTimeMs = draft['endTimeMs'] as int?;
      if (endTimeMs != null) {
        final savedEndTime = DateTime.fromMillisecondsSinceEpoch(endTimeMs);
        if (DateTime.now().isBefore(savedEndTime)) {
          final startTimeMs = draft['startTimeMs'] as int?;
          if (startTimeMs != null) {
            _startTime = DateTime.fromMillisecondsSinceEpoch(startTimeMs);
          }
          _endTime = savedEndTime;

          if (draft['selectedAnswers'] != null) {
            final ansMap = Map<String, dynamic>.from(draft['selectedAnswers'] as Map);
            for (final e in ansMap.entries) {
              if (e.value is int) {
                _selectedAnswers[e.key] = e.value as int;
              }
            }
          }

          if (draft['questionStates'] != null) {
            final statesMap = Map<String, dynamic>.from(draft['questionStates'] as Map);
            for (final e in statesMap.entries) {
              final idx = e.value as int?;
              if (idx != null && idx >= 0 && idx < CbtQuestionState.values.length) {
                _questionStates[e.key] = CbtQuestionState.values[idx];
              }
            }
          }

          final savedSec =
              (draft['currentSectionIndex'] as int? ?? 0).clamp(0, _test.sections.length - 1);
          _loadSection(savedSec);
          if (_currentSectionQuestionIds.isNotEmpty) {
            final savedQ =
                (draft['currentQuestionIndex'] as int? ?? 0).clamp(0, _currentSectionQuestionIds.length - 1);
            _currentQuestionIndex = savedQ;
          }
          draftRestored = true;
        } else {
          LocalDatabase.instance.clearExamDraft(_test.id);
        }
      }
    }

    if (!draftRestored) {
      _loadSection(0);
    }

    if (mounted) {
      setState(() => _isLoadingQuestions = false);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _saveExamDraft() {
    if (_isSubmitting) return;
    LocalDatabase.instance.saveExamDraft(_test.id, {
      'startTimeMs': _startTime.millisecondsSinceEpoch,
      'endTimeMs': _endTime.millisecondsSinceEpoch,
      'currentSectionIndex': _currentSectionIndex,
      'currentQuestionIndex': _currentQuestionIndex,
      'selectedAnswers': _selectedAnswers,
      'questionStates': {
        for (final entry in _questionStates.entries) entry.key: entry.value.index,
      },
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Recheck expiry if app returns from background
      if (DateTime.now().isAfter(_endTime) && !_isSubmitting) {
        _submitExam(autoSubmit: true);
      }
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      // Preserve active state when screen turns off or user switches apps
      _saveExamDraft();
    }
  }

  void _loadSection(int sectionIndex) {
    _currentSectionIndex = sectionIndex;
    _currentQuestionIndex = 0;
    _currentSectionQuestionIds = _test.sections[sectionIndex].questionIds
        .where((qId) => _questionCache.containsKey(qId))
        .toList();

    if (_currentSectionQuestionIds.isNotEmpty) {
      final qId = _currentSectionQuestionIds[0];
      if (_questionStates[qId] == CbtQuestionState.notVisited) {
        _questionStates[qId] = CbtQuestionState.notAnswered;
      }
    }
  }

  void _navigateToQuestion(int index) {
    setState(() {
      _currentQuestionIndex = index;
      final qId = _currentSectionQuestionIds[index];
      if (_questionStates[qId] == CbtQuestionState.notVisited) {
        _questionStates[qId] = CbtQuestionState.notAnswered;
      }
    });
    _saveExamDraft();
  }

  void _selectOption(int optionIndex) {
    final currentQId = _currentSectionQuestionIds[_currentQuestionIndex];
    setState(() {
      _selectedAnswers[currentQId] = optionIndex;
    });
    _saveExamDraft();
  }

  void _clearResponse() {
    final currentQId = _currentSectionQuestionIds[_currentQuestionIndex];
    setState(() {
      _selectedAnswers.remove(currentQId);
      _questionStates[currentQId] = CbtQuestionState.notAnswered;
    });
    _saveExamDraft();
  }

  void _saveAndNext() {
    final currentQId = _currentSectionQuestionIds[_currentQuestionIndex];
    final hasAnswer = _selectedAnswers.containsKey(currentQId);

    setState(() {
      _questionStates[currentQId] = hasAnswer
          ? CbtQuestionState.answered
          : CbtQuestionState.notAnswered;

      if (_currentQuestionIndex < _currentSectionQuestionIds.length - 1) {
        _currentQuestionIndex++;
        final nextQId = _currentSectionQuestionIds[_currentQuestionIndex];
        if (_questionStates[nextQId] == CbtQuestionState.notVisited) {
          _questionStates[nextQId] = CbtQuestionState.notAnswered;
        }
      } else if (_currentSectionIndex < _test.sections.length - 1) {
        _loadSection(_currentSectionIndex + 1);
      }
    });
    _saveExamDraft();
  }

  void _markForReviewAndNext() {
    final currentQId = _currentSectionQuestionIds[_currentQuestionIndex];
    final hasAnswer = _selectedAnswers.containsKey(currentQId);

    setState(() {
      _questionStates[currentQId] = hasAnswer
          ? CbtQuestionState.answeredAndMarked
          : CbtQuestionState.markedForReview;

      if (_currentQuestionIndex < _currentSectionQuestionIds.length - 1) {
        _currentQuestionIndex++;
        final nextQId = _currentSectionQuestionIds[_currentQuestionIndex];
        if (_questionStates[nextQId] == CbtQuestionState.notVisited) {
          _questionStates[nextQId] = CbtQuestionState.notAnswered;
        }
      } else if (_currentSectionIndex < _test.sections.length - 1) {
        _loadSection(_currentSectionIndex + 1);
      }
    });
    _saveExamDraft();
  }

  void _previousQuestion() {
    if (_currentQuestionIndex > 0) {
      setState(() {
        _currentQuestionIndex--;
      });
      _saveExamDraft();
    } else if (_currentSectionIndex > 0) {
      setState(() {
        _loadSection(_currentSectionIndex - 1);
        _currentQuestionIndex = _currentSectionQuestionIds.length - 1;
      });
      _saveExamDraft();
    }
  }

  Future<void> _submitExam({bool autoSubmit = false}) async {
    if (_isSubmitting) return;
    _isSubmitting = true;

    // Calculate Scores & Section-wise Performance
    int correctCount = 0;
    int wrongCount = 0;
    int unattemptedCount = 0;
    final Map<String, double> sectionScores = {};

    final positiveMarks = _test.positiveMarks ?? (_test.totalQuestions > 0 ? _test.totalMarks / _test.totalQuestions : 2.0);
    final negativeMarks = _test.negativeMarks;

    for (final sec in _test.sections) {
      double secScore = 0.0;
      for (final qId in sec.questionIds) {
        final q = _questionCache[qId];
        if (q == null) continue; // Skip draft/archived questions
        final selected = _selectedAnswers[qId];

        if (selected == null) {
          unattemptedCount++;
        } else if (selected == q.correctIndex) {
          correctCount++;
          secScore += positiveMarks;
        } else {
          wrongCount++;
          secScore -= negativeMarks;
          LocalDatabase.instance.recordWrongQuestion(qId);
        }
      }
      sectionScores[sec.name] = (secScore < 0) ? 0.0 : secScore;
    }

    final totalScore = (correctCount * positiveMarks) - (wrongCount * negativeMarks);
    final finalScore = totalScore < 0 ? 0.0 : totalScore;
    final accuracy = (correctCount + wrongCount) > 0
        ? (correctCount / (correctCount + wrongCount)) * 100
        : 0.0;

    final attempt = StudentAttempt(
      id: const Uuid().v4(),
      testId: _test.id,
      testTitle: _test.title,
      examCode: _test.examCode,
      timestamp: DateTime.now(),
      score: finalScore,
      maxScore: _test.totalMarks,
      accuracy: accuracy,
      correctCount: correctCount,
      wrongCount: wrongCount,
      unattemptedCount: unattemptedCount,
      sectionScores: sectionScores,
      selectedAnswers: _selectedAnswers,
      timeTakenSeconds: DateTime.now().difference(_startTime).inSeconds,
    );

    await ref.read(studentAttemptsProvider.notifier).record(attempt);
    // Sync attempt to Cloud Firestore
    await FirestoreService.instance.recordTestAttempt(attempt);
    // Clear persisted draft now that attempt is submitted
    await LocalDatabase.instance.clearExamDraft(_test.id);

    if (mounted) {
      AdService.instance.showResultInterstitial(
        isFreeTest: _test.isFree,
        onContinue: () {
          if (!mounted) return;
          context.pushReplacement('/tests/results/${attempt.id}');
        },
      );
    }
  }

  void _showExitConfirmationDialog() {
    _saveExamDraft();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Leave Examination?'),
        content: const Text(
          'Your answers and timer progress have been safely saved. You can resume this exam anytime before time expires, or submit it now.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Stay & Continue'),
          ),
          OutlinedButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.pop();
            },
            child: const Text('Save & Exit'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _submitExam();
            },
            child: const Text('Submit Now'),
          ),
        ],
      ),
    );
  }

  void _showSubmitConfirmationDialog() {
    int answered = 0;
    int marked = 0;
    int notAnswered = 0;

    for (final s in _questionStates.values) {
      if (s == CbtQuestionState.answered || s == CbtQuestionState.answeredAndMarked) {
        answered++;
      } else if (s == CbtQuestionState.markedForReview) {
        marked++;
      } else {
        notAnswered++;
      }
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Submit Examination?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Are you sure you want to end this exam? You cannot modify your answers after submission.'),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.success.withValues(alpha: 0.25)),
                  ),
                  child: Text(
                    'Answered: $answered',
                    style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.success),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.review.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.review.withValues(alpha: 0.25)),
                  ),
                  child: Text(
                    'Marked: $marked',
                    style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.review),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.error.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error.withValues(alpha: 0.25)),
                  ),
                  child: Text(
                    'Unanswered: $notAnswered',
                    style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.error),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _submitExam();
            },
            child: const Text('Submit Now'),
          ),
        ],
      ),
    );
  }

  void _openQuestionPalette() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppDimens.radiusLarge)),
      ),
      builder: (ctx) {
        return _QuestionPaletteSheet(
          sections: _test.sections,
          activeSectionIndex: _currentSectionIndex,
          activeQuestionIndex: _currentQuestionIndex,
          questionStates: _questionStates,
          onQuestionTapped: (secIndex, qIndex) {
            Navigator.pop(ctx);
            setState(() {
              if (_currentSectionIndex != secIndex) {
                _loadSection(secIndex);
              }
              _navigateToQuestion(qIndex);
            });
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    // Show loading spinner while questions are being fetched on-demand from Firestore
    if (_isLoadingQuestions) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Loading exam questions…', style: TextStyle(fontSize: 14)),
            ],
          ),
        ),
      );
    }

    // Show error if test/questions could not be loaded
    if (_loadError != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Exam')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 52, color: Colors.red),
                const SizedBox(height: 16),
                Text(_loadError!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Go Back'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currentQId = _currentSectionQuestionIds.isNotEmpty
        ? _currentSectionQuestionIds[_currentQuestionIndex]
        : '';
    final currentQ = _questionCache[currentQId];
    final selectedOption = _selectedAnswers[currentQId];

    final lang = ref.watch(selectedLanguageProvider);
    final questionText = (currentQ != null && lang == 'hi' && currentQ.cleanQuestionHi.isNotEmpty)
        ? currentQ.cleanQuestionHi
        : currentQ?.cleanQuestionEn ?? '';
    final options = (currentQ != null && lang == 'hi' && currentQ.optionsHi.isNotEmpty)
        ? currentQ.optionsHi
        : currentQ?.optionsEn ?? [];

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          _showExitConfirmationDialog();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          elevation: 1,
          title: Row(
            children: [
              Expanded(
                child: Text(
                  _test.title,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // ISOLATED COUNTDOWN TIMER (rebuilds only this widget every second)
              _CbtCountdownTimer(
                endTime: _endTime,
                onTimeExpired: () => _submitExam(autoSubmit: true),
              ),
            ],
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: ElevatedButton(
                onPressed: _showSubmitConfirmationDialog,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(76, 34),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                ),
                child: const Text('Submit', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: [
              // Section Tabs Row
              Container(
                height: 44,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : Colors.white,
                  border: Border(
                    bottom: BorderSide(
                      color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
                    ),
                  ),
                ),
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  itemCount: _test.sections.length,
                  itemBuilder: (context, index) {
                    final sec = _test.sections[index];
                    final isSelected = _currentSectionIndex == index;

                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                      child: ChoiceChip(
                        label: Text(
                          sec.name,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                        selected: isSelected,
                        onSelected: (selected) {
                          if (selected) {
                            setState(() {
                              _loadSection(index);
                            });
                          }
                        },
                        selectedColor: AppColors.actionBlue,
                        labelStyle: TextStyle(
                          color: isSelected ? Colors.white : (isDark ? AppColors.textDark : AppColors.textLight),
                        ),
                      ),
                    );
                  },
                ),
              ),

              // Question Meta & Palette Trigger
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Question ${_currentQuestionIndex + 1} of ${_currentSectionQuestionIds.length}',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                    Row(
                      children: [
                        // Language switcher
                        ActionChip(
                          label: Text(lang == 'hi' ? 'हिन्दी' : 'English', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                          onPressed: () {
                            final next = lang == 'hi' ? 'en' : 'hi';
                            ref.read(selectedLanguageProvider.notifier).setLanguage(next);
                          },
                        ),
                        const SizedBox(width: 8),
                        // Palette Button
                        IconButton.filledTonal(
                          onPressed: _openQuestionPalette,
                          icon: const Icon(Icons.grid_view, size: 18),
                          tooltip: 'Question Palette',
                          style: IconButton.styleFrom(
                            backgroundColor: AppColors.actionBlueLight,
                            foregroundColor: AppColors.actionBlue,
                            minimumSize: const Size(36, 36),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Question & Options in Scrollable Area (Instantaneous switching - no decorative animation)
              Expanded(
                child: currentQ == null
                    ? const Center(child: CircularProgressIndicator())
                    : SingleChildScrollView(
                        key: ValueKey<String>('q_${_test.id}_${_currentSectionIndex}_$_currentQuestionIndex'),
                        padding: const EdgeInsets.all(AppDimens.space16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                              // Question Box
                              AppCard(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          '+${(_test.totalMarks / _test.totalQuestions).toStringAsFixed(2)} / -${_test.negativeMarks.toStringAsFixed(2)} Marks',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                          ),
                                        ),
                                        if (currentQ.year != null)
                                          Text(
                                            currentQ.year!,
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                              color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    if (questionText.isNotEmpty)
                                      QuestionTextView(
                                        text: questionText,
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                        height: 1.45,
                                      ),
                                    if (currentQ.questionImageUrl != null && currentQ.questionImageUrl!.isNotEmpty) ...[
                                      if (questionText.isNotEmpty) const SizedBox(height: 12),
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: Image.network(
                                          currentQ.questionImageUrl!,
                                          fit: BoxFit.contain,
                                          errorBuilder: (context, error, stackTrace) => Container(
                                            padding: const EdgeInsets.all(12),
                                            decoration: BoxDecoration(
                                              color: Colors.grey.withValues(alpha: 0.1),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: const Row(
                                              children: [
                                                Icon(Icons.broken_image_outlined, size: 20, color: Colors.grey),
                                                SizedBox(width: 8),
                                                Text('Image could not be loaded', style: TextStyle(fontSize: 12, color: Colors.grey)),
                                              ],
                                            ),
                                          ),
                                          loadingBuilder: (context, child, progress) {
                                            if (progress == null) return child;
                                            return const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2)));
                                          },
                                        ),
                                      ),
                                    ],
                                    // Compact source metadata row below question text
                                    QuestionSourceMetadata(sourceInfo: currentQ.resolvedSourceInfo),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 18),

                              // Options
                              ...List.generate(options.length, (index) {
                                final optionLabel = String.fromCharCode(65 + index);
                                final optionText = options[index];
                                final isSelected = selectedOption == index;
                                final hasOptionImg = currentQ.optionImages != null &&
                                    index < currentQ.optionImages!.length &&
                                    currentQ.optionImages![index].isNotEmpty;

                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: AnimatedPressable(
                                    onTap: () => _selectOption(index),
                                    child: Container(
                                      constraints: const BoxConstraints(minHeight: AppDimens.mcqOptionMinHeight),
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                      decoration: BoxDecoration(
                                        color: isSelected
                                            ? (isDark ? const Color(0xFF1E3A8A).withAlpha(51) : AppColors.actionBlueLight)
                                            : (isDark ? AppColors.surfaceDark : Colors.white),
                                        borderRadius: AppDimens.cardBorderRadius,
                                        border: Border.all(
                                          color: isSelected
                                              ? AppColors.actionBlue
                                              : (isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight),
                                          width: isSelected ? 2.0 : 1.0,
                                        ),
                                      ),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.center,
                                        children: [
                                          Container(
                                            width: 28,
                                            height: 28,
                                            alignment: Alignment.center,
                                            decoration: BoxDecoration(
                                              color: isSelected ? AppColors.actionBlue : (isDark ? Colors.grey[800] : Colors.grey[200]),
                                              shape: BoxShape.circle,
                                            ),
                                            child: Text(
                                              optionLabel,
                                              style: TextStyle(
                                                color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.black87),
                                                fontWeight: FontWeight.w700,
                                                fontSize: 13,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                if (optionText.isNotEmpty)
                                                  Text(
                                                    optionText,
                                                    style: TextStyle(
                                                      fontSize: 14,
                                                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                                      color: isDark ? AppColors.textDark : AppColors.textLight,
                                                    ),
                                                  ),
                                                if (hasOptionImg) ...[
                                                  if (optionText.isNotEmpty) const SizedBox(height: 8),
                                                  ClipRRect(
                                                    borderRadius: BorderRadius.circular(6),
                                                    child: Image.network(
                                                      currentQ.optionImages![index],
                                                      height: 90,
                                                      fit: BoxFit.contain,
                                                      errorBuilder: (_, _, _) => const SizedBox.shrink(),
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ),
                                          if (isSelected)
                                            const Icon(Icons.check_circle, color: AppColors.actionBlue, size: 20),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),
              ),

              // SSC CBT Bottom Control Bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16, vertical: 10),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : Colors.white,
                  border: Border(
                    top: BorderSide(
                      color: isDark ? AppColors.dividerDark : AppColors.dividerLight,
                    ),
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _clearResponse,
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size.fromHeight(40),
                              padding: EdgeInsets.zero,
                            ),
                            child: const Text('Clear', style: TextStyle(fontSize: 12)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _markForReviewAndNext,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.review,
                              side: const BorderSide(color: AppColors.review),
                              minimumSize: const Size.fromHeight(40),
                              padding: EdgeInsets.zero,
                            ),
                            child: const Text('Review & Next', style: TextStyle(fontSize: 12)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: (_currentQuestionIndex > 0 || _currentSectionIndex > 0)
                                ? _previousQuestion
                                : null,
                            icon: const Icon(Icons.arrow_back, size: 16),
                            label: const Text('Previous'),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size.fromHeight(44),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _saveAndNext,
                            icon: const Icon(Icons.arrow_forward, size: 16),
                            label: const Text('Save & Next'),
                            style: ElevatedButton.styleFrom(
                              minimumSize: const Size.fromHeight(44),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Dedicated isolated countdown timer widget
class _CbtCountdownTimer extends StatefulWidget {
  final DateTime endTime;
  final VoidCallback onTimeExpired;

  const _CbtCountdownTimer({
    required this.endTime,
    required this.onTimeExpired,
  });

  @override
  State<_CbtCountdownTimer> createState() => _CbtCountdownTimerState();
}

class _CbtCountdownTimerState extends State<_CbtCountdownTimer> {
  late Timer _timer;
  late Duration _remaining;

  @override
  void initState() {
    super.initState();
    _remaining = widget.endTime.difference(DateTime.now());
    if (_remaining.isNegative) _remaining = Duration.zero;

    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      final diff = widget.endTime.difference(DateTime.now());
      if (diff.isNegative || diff.inSeconds <= 0) {
        _timer.cancel();
        if (mounted) {
          setState(() {
            _remaining = Duration.zero;
          });
          widget.onTimeExpired();
        }
      } else {
        if (mounted) {
          setState(() {
            _remaining = diff;
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    final hours = d.inHours.toString().padLeft(2, '0');
    final minutes = (d.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final isLowTime = _remaining.inMinutes < 5;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isLowTime ? AppColors.errorLight : AppColors.actionBlueLight,
        borderRadius: BorderRadius.circular(AppDimens.radiusSmall),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.timer_outlined,
            size: 14,
            color: isLowTime ? AppColors.error : AppColors.actionBlue,
          ),
          const SizedBox(width: 4),
          Text(
            _formatDuration(_remaining),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: isLowTime ? AppColors.error : AppColors.actionBlue,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

// Question Palette Sheet
class _QuestionPaletteSheet extends StatelessWidget {
  final List<TestSection> sections;
  final int activeSectionIndex;
  final int activeQuestionIndex;
  final Map<String, CbtQuestionState> questionStates;
  final Function(int sectionIndex, int questionIndex) onQuestionTapped;

  const _QuestionPaletteSheet({
    required this.sections,
    required this.activeSectionIndex,
    required this.activeQuestionIndex,
    required this.questionStates,
    required this.onQuestionTapped,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Calculate Summary Counts
    int answered = 0;
    int notAnswered = 0;
    int marked = 0;
    int answeredMarked = 0;
    int notVisited = 0;

    for (final s in questionStates.values) {
      switch (s) {
        case CbtQuestionState.answered:
          answered++;
          break;
        case CbtQuestionState.notAnswered:
          notAnswered++;
          break;
        case CbtQuestionState.markedForReview:
          marked++;
          break;
        case CbtQuestionState.answeredAndMarked:
          answeredMarked++;
          break;
        case CbtQuestionState.notVisited:
          notVisited++;
          break;
      }
    }

    return Container(
      padding: const EdgeInsets.all(AppDimens.space16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Question Palette',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Palette Legend Counters
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              StatusBadge.cbtState(CbtQuestionState.answered, count: answered),
              StatusBadge.cbtState(CbtQuestionState.notAnswered, count: notAnswered),
              StatusBadge.cbtState(CbtQuestionState.markedForReview, count: marked),
              StatusBadge.cbtState(CbtQuestionState.answeredAndMarked, count: answeredMarked),
              StatusBadge.cbtState(CbtQuestionState.notVisited, count: notVisited),
            ],
          ),
          const SizedBox(height: 18),
          const Divider(),
          const SizedBox(height: 12),

          // Sections & Question Grid
          Expanded(
            child: ListView.builder(
              itemCount: sections.length,
              itemBuilder: (context, secIdx) {
                final sec = sections[secIdx];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sec.name,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                    const SizedBox(height: 10),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 6,
                        mainAxisSpacing: 8,
                        crossAxisSpacing: 8,
                        childAspectRatio: 1.0,
                      ),
                      itemCount: sec.questionIds.length,
                      itemBuilder: (context, qIdx) {
                        final qId = sec.questionIds[qIdx];
                        final state = questionStates[qId] ?? CbtQuestionState.notVisited;
                        final isCurrent = activeSectionIndex == secIdx && activeQuestionIndex == qIdx;

                        Color btnColor;
                        Color textColor = Colors.white;

                        switch (state) {
                          case CbtQuestionState.answered:
                            btnColor = AppColors.cbtAnswered;
                            break;
                          case CbtQuestionState.notAnswered:
                            btnColor = AppColors.cbtNotAnswered;
                            break;
                          case CbtQuestionState.markedForReview:
                            btnColor = AppColors.cbtMarkedReview;
                            break;
                          case CbtQuestionState.answeredAndMarked:
                            btnColor = AppColors.cbtAnsweredMarked;
                            break;
                          case CbtQuestionState.notVisited:
                            btnColor = isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);
                            textColor = isDark ? Colors.white : AppColors.textLight;
                            break;
                        }

                        return InkWell(
                          onTap: () => onQuestionTapped(secIdx, qIdx),
                          borderRadius: BorderRadius.circular(AppDimens.radiusSmall),
                          child: Container(
                            decoration: BoxDecoration(
                              color: btnColor,
                              borderRadius: BorderRadius.circular(AppDimens.radiusSmall),
                              border: isCurrent
                                  ? Border.all(color: AppColors.actionBlue, width: 2.5)
                                  : null,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '${qIdx + 1}',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                color: textColor,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 18),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
