import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/database/local_database.dart';
import '../../../../core/models/models.dart';
import '../../../../core/services/firestore_service.dart';
import '../../../../core/services/live_test_gate_service.dart';
import '../../../../core/widgets/status_badge.dart';

class LiveTestDetailsSheet extends StatefulWidget {
  final LiveTestItem liveTest;
  final MockTest mockTest;

  const LiveTestDetailsSheet({
    super.key,
    required this.liveTest,
    required this.mockTest,
  });

  static Future<void> show(BuildContext context, {
    required LiveTestItem liveTest,
    required MockTest mockTest,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => LiveTestDetailsSheet(
        liveTest: liveTest,
        mockTest: mockTest,
      ),
    );
  }

  @override
  State<LiveTestDetailsSheet> createState() => _LiveTestDetailsSheetState();
}

class _LiveTestDetailsSheetState extends State<LiveTestDetailsSheet> {
  Timer? _countdownTimer;
  final _nameController = TextEditingController();
  final _mobileController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _isRegistering = false;
  String? _registrationError;
  LiveTestRegistration? _currentRegistration;

  @override
  void initState() {
    super.initState();
    _currentRegistration = LocalDatabase.instance.getLiveTestRegistration(widget.liveTest.id);
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _nameController.dispose();
    _mobileController.dispose();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    if (d.isNegative || d == Duration.zero) return '00:00:00';
    final hours = d.inHours.toString().padLeft(2, '0');
    final minutes = (d.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }

  Future<void> _handleRegister() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final studentName = _nameController.text.trim();
    final mobile = _mobileController.text.trim();

    setState(() {
      _isRegistering = true;
      _registrationError = null;
    });

    final installationId = LocalDatabase.instance.installationId;
    final registrationId = '${widget.liveTest.id}_$installationId';
    final now = DateTime.now();

    final registration = LiveTestRegistration(
      id: registrationId,
      liveTestId: widget.liveTest.id,
      testId: widget.liveTest.testId,
      studentName: studentName,
      mobile: mobile.isNotEmpty ? mobile : null,
      installationId: installationId,
      registeredAt: now,
      paymentType: widget.mockTest.isFree ? 'FREE' : 'PAID',
      entitlementStatus: widget.mockTest.isFree || LocalDatabase.instance.isTestUnlocked(widget.mockTest)
          ? 'ACTIVE'
          : 'NONE',
      status: 'REGISTERED',
    );

    // Save locally first for guaranteed immediate availability
    await LocalDatabase.instance.saveLiveTestRegistration(registration);

    // Fire network write to Firestore
    FirestoreService.instance.registerForLiveTest(registration).catchError((e) {
      debugPrint('Background live test registration write error: $e');
      return false;
    });

    if (mounted) {
      setState(() {
        _isRegistering = false;
        _currentRegistration = registration;
      });
    }
  }

  Future<void> _handleEnterTest() async {
    final decision = LiveTestGateService.evaluateAccess(
      testIdOrLiveTestId: widget.liveTest.id,
      liveTest: widget.liveTest,
      mockTest: widget.mockTest,
      registration: _currentRegistration,
    );

    if (!decision.isAllowed) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(decision.message),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    // Transition registration status to STARTED
    final now = DateTime.now();
    await LocalDatabase.instance.updateLiveTestRegistrationStatus(
      widget.liveTest.id,
      'STARTED',
      startedAt: now,
    );
    if (_currentRegistration != null) {
      FirestoreService.instance.updateLiveTestRegistrationStatus(
        widget.liveTest.id,
        _currentRegistration!.id,
        'STARTED',
        startedAt: now,
      );
    }

    if (mounted) {
      Navigator.of(context).pop();
      context.push('/tests/instructions/${widget.mockTest.id}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final now = FirestoreService.instance.getTrustedNow();

    final isUpcoming = now.isBefore(widget.liveTest.startAt);
    final isLive = !isUpcoming && now.isBefore(widget.liveTest.endAt);
    final isEnded = now.isAfter(widget.liveTest.endAt) || now.isAtSameMomentAs(widget.liveTest.endAt);

    final isRegistered = _currentRegistration != null;

    final countdownText = isUpcoming
        ? _formatDuration(widget.liveTest.startAt.difference(now))
        : (isLive ? _formatDuration(widget.liveTest.endAt.difference(now)) : '00:00:00');

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drag Handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.black12,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Badges row
            Row(
              children: [
                StatusBadge.exam(widget.mockTest.examCode),
                const SizedBox(width: 8),
                if (widget.mockTest.isFree)
                  StatusBadge.free()
                else if (LocalDatabase.instance.isTestUnlocked(widget.mockTest))
                  StatusBadge.unlocked()
                else
                  StatusBadge.paid(price: widget.mockTest.offerPrice ?? widget.mockTest.price),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.of(context).pop(),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Title
            Text(
              widget.liveTest.title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 14),

            // Exam Metrics Grid
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                border: Border.all(
                  color: isDark ? Colors.white12 : Colors.black.withAlpha(12),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _StatColumn(
                    title: 'Questions',
                    value: '${widget.mockTest.totalQuestions}',
                  ),
                  _StatColumn(
                    title: 'Duration',
                    value: '${widget.mockTest.durationMinutes}m',
                  ),
                  _StatColumn(
                    title: 'Total Marks',
                    value: widget.mockTest.totalMarks.toStringAsFixed(0),
                  ),
                  _StatColumn(
                    title: 'Negative',
                    value: '-${widget.mockTest.negativeMarks.toStringAsFixed(2)}',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Schedule & Countdown
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isLive
                    ? (isDark ? const Color(0xFF7F1D1D).withAlpha(50) : const Color(0xFFFEF2F2))
                    : (isDark ? const Color(0xFF1E3A8A).withAlpha(50) : const Color(0xFFEFF6FF)),
                borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                border: Border.all(
                  color: isLive ? Colors.red.withAlpha(50) : Colors.blue.withAlpha(50),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isLive ? Icons.sensors : Icons.schedule,
                            size: 16,
                            color: isLive ? Colors.red : AppColors.actionBlue,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            isLive
                                ? 'LIVE NOW (Ends in)'
                                : (isUpcoming ? 'Starts in' : 'Test Status'),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: isLive ? Colors.red : AppColors.actionBlue,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        isEnded ? 'ENDED' : countdownText,
                        style: TextStyle(
                          fontSize: 14,
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.w800,
                          color: isLive ? Colors.red : AppColors.actionBlue,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Divider(height: 1, color: isDark ? Colors.white12 : Colors.black12),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          'Start: ${widget.liveTest.startAt.toLocal().toString().substring(0, 16)}',
                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'End: ${widget.liveTest.endAt.toLocal().toString().substring(0, 16)}',
                          textAlign: TextAlign.end,
                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            if (widget.liveTest.instructions != null && widget.liveTest.instructions!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Instructions:',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white70 : Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.liveTest.instructions!,
                style: const TextStyle(fontSize: 12, height: 1.4, color: Colors.grey),
              ),
            ],

            const SizedBox(height: 20),

            // --- REGISTRATION / ENTER ACTIONS ---
            if (!isRegistered && !isEnded) ...[
              // Registration Form
              const Text(
                'Student Registration (Required)',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              const Text(
                'Enter your details once to register for this Live Test. No password required.',
                style: TextStyle(fontSize: 11, color: Colors.grey),
              ),
              const SizedBox(height: 12),
              Form(
                key: _formKey,
                child: Column(
                  children: [
                    TextFormField(
                      controller: _nameController,
                      decoration: InputDecoration(
                        labelText: 'Full Name *',
                        hintText: 'Enter your name',
                        isDense: true,
                        filled: true,
                        fillColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Please enter your full name';
                        }
                        if (val.trim().length > 100) {
                          return 'Name must be 100 characters or less';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _mobileController,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'Mobile Number (Optional)',
                        hintText: 'e.g. 9876543210',
                        isDense: true,
                        filled: true,
                        fillColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    if (_registrationError != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _registrationError!,
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ],
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      height: 44,
                      child: ElevatedButton(
                        onPressed: _isRegistering ? null : _handleRegister,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.actionBlue,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: _isRegistering
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text(
                                'Register for Test',
                                style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ] else if (isRegistered && isUpcoming) ...[
              // Registered but Upcoming (Waiting for start time)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF059669).withAlpha(20),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF059669).withAlpha(60)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, color: Color(0xFF059669), size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Registered Successfully ✓',
                            style: TextStyle(
                              color: Color(0xFF059669),
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                          Text(
                            'Name: ${_currentRegistration!.studentName}',
                            style: const TextStyle(fontSize: 11, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton.icon(
                  onPressed: null, // Disabled until start time
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.grey.shade400,
                    disabledBackgroundColor: isDark ? Colors.white12 : Colors.grey.shade200,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.lock_clock, size: 18),
                  label: Text(
                    'ENTER TEST (Locked)',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white38 : Colors.grey.shade600,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              const Center(
                child: Text(
                  'Button will automatically unlock when countdown ends.',
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ),
            ] else if (isRegistered && isLive) ...[
              // Registered and LIVE NOW -> Can enter
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF059669).withAlpha(20),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, color: Color(0xFF059669), size: 16),
                    const SizedBox(width: 6),
                    Text(
                      'Registered as ${_currentRegistration!.studentName}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF059669)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: _handleEnterTest,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade700,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.play_arrow, color: Colors.white),
                  label: const Text(
                    'ENTER TEST',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white),
                  ),
                ),
              ),
            ] else if (isEnded) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isDark ? Colors.white10 : Colors.black.withAlpha(10),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Center(
                  child: Text(
                    'This scheduled Live Test has ended.',
                    style: TextStyle(fontWeight: FontWeight.w700, color: Colors.grey),
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

class _StatColumn extends StatelessWidget {
  final String title;
  final String value;

  const _StatColumn({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
        ),
        const SizedBox(height: 2),
        Text(
          title,
          style: const TextStyle(fontSize: 11, color: Colors.grey),
        ),
      ],
    );
  }
}
