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

  // Stage 1: Symbol Fade & Scale (0ms -> 450ms)
  late Animation<double> _symbolOpacity;
  late Animation<double> _symbolScale;

  // Stage 2: Wordmark Fade & Slide Up (300ms -> 750ms)
  late Animation<double> _wordmarkOpacity;
  late Animation<Offset> _wordmarkSlide;

  // Stage 3: Tagline Fade (600ms -> 1050ms)
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

    // Coordinated 1600ms master timeline
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    );

    // Stage 1: 0ms -> 450ms (0.0 -> 0.28)
    _symbolOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.28, curve: Curves.easeOutCubic),
      ),
    );
    _symbolScale = Tween<double>(begin: 0.90, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.28, curve: Curves.easeOutCubic),
      ),
    );

    // Stage 2: 300ms -> 750ms (0.18 -> 0.46)
    _wordmarkOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.18, 0.46, curve: Curves.easeOutCubic),
      ),
    );
    _wordmarkSlide = Tween<Offset>(
      begin: const Offset(0.0, 0.20), // subtle ~10dp translate
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.18, 0.46, curve: Curves.easeOutCubic),
      ),
    );

    // Stage 3: 600ms -> 1050ms (0.37 -> 0.65)
    _taglineOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.37, 0.65, curve: Curves.easeIn),
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
        Future.delayed(const Duration(milliseconds: 400), _navigateNext);
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
    final maxSymbolWidth = (size.width * 0.54).clamp(160.0, 240.0);

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

                  // Stage 1: Brand Symbol (Stylized A + Island + Waves)
                  FadeTransition(
                    opacity: _symbolOpacity,
                    child: ScaleTransition(
                      scale: _symbolScale,
                      child: Image.asset(
                        'assets/images/andaman_symbol.png',
                        width: maxSymbolWidth,
                        fit: BoxFit.contain,
                        filterQuality: FilterQuality.medium,
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),

                  // Stage 2: ANDAMAN QUIZ Wordmark
                  FadeTransition(
                    opacity: _wordmarkOpacity,
                    child: SlideTransition(
                      position: _wordmarkSlide,
                      child: Image.asset(
                        'assets/images/andaman_wordmark.png',
                        width: maxSymbolWidth * 0.95,
                        fit: BoxFit.contain,
                        filterQuality: FilterQuality.medium,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Stage 3: Clean Academic Tagline
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
