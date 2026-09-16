import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  // Stage 1: Brand Logo Fade & Settle (0ms -> 500ms)
  late Animation<double> _logoOpacity;
  late Animation<double> _logoScale;

  // Stage 2: Tagline Fade (350ms -> 800ms)
  late Animation<double> _taglineOpacity;

  bool _navigated = false;

  @override
  void initState() {
    super.initState();

    // Set matching cream System UI overlay style
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: AppColors.splashCream,
        statusBarIconBrightness: Brightness.dark,
        systemNavigationBarColor: AppColors.splashCream,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
    );

    // Coordinated 1400ms master timeline
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    // Stage 1: Logo Fade & Settle (0ms -> 500ms, interval 0.0 -> 0.36)
    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.36, curve: Curves.easeOutCubic),
      ),
    );
    _logoScale = Tween<double>(begin: 0.95, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.36, curve: Curves.easeOutCubic),
      ),
    );

    // Stage 2: Tagline Fade (350ms -> 800ms, interval 0.25 -> 0.57)
    _taglineOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.25, 0.57, curve: Curves.easeOutCubic),
      ),
    );

    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _navigateNext();
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Respect accessibility reduced-motion preference
      if (MediaQuery.of(context).disableAnimations) {
        _controller.value = 1.0;
        Future.delayed(const Duration(milliseconds: 300), _navigateNext);
      } else {
        _controller.forward();
      }
    });
  }

  void _navigateNext() {
    if (_navigated || !mounted) return;
    _navigated = true;

    // Reset System UI overlay for main app
    final isDark = Theme.of(context).brightness == Brightness.dark;
    SystemChrome.setSystemUIOverlayStyle(
      SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
        systemNavigationBarColor: isDark ? AppColors.surfaceDark : Colors.white,
        systemNavigationBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
      ),
    );

    // Flow routing:
    // First installation -> /onboarding/exam
    // Returning user -> /home
    final isOnboarded = LocalDatabase.instance.isOnboardingDone();
    if (isOnboarded) {
      context.go('/home');
    } else {
      context.go('/onboarding/exam');
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final maxLogoWidth = (size.width * 0.62).clamp(180.0, 260.0);

    return Scaffold(
      backgroundColor: AppColors.splashCream,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.space24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Spacer(flex: 2),

                  // Unified Pristine Brand Logo (Aspect ratio strictly preserved, no crop/stretch)
                  FadeTransition(
                    opacity: _logoOpacity,
                    child: ScaleTransition(
                      scale: _logoScale,
                      child: Image.asset(
                        'assets/images/andaman_logo_clean.png',
                        width: maxLogoWidth,
                        fit: BoxFit.contain,
                        filterQuality: FilterQuality.high,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Academic Tagline
                  FadeTransition(
                    opacity: _taglineOpacity,
                    child: const Text(
                      'Practice. Prepare. Crack A&N Exams.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0F172A),
                        letterSpacing: 0.6,
                      ),
                    ),
                  ),

                  const Spacer(flex: 3),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
