import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../app/scaffold_with_nav_bar.dart';
import '../../features/andaman_gk/presentation/andaman_gk_screen.dart';
import '../../features/exam/presentation/cbt_exam_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/onboarding/presentation/choose_exam_screen.dart';
import '../../features/onboarding/presentation/choose_language_screen.dart';
import '../../features/onboarding/presentation/splash_screen.dart';
import '../../features/practice/presentation/practice_screen.dart';
import '../../features/practice/presentation/topics_list_screen.dart';
import '../../features/qotd/presentation/qotd_screen.dart';
import '../../features/question/presentation/mcq_practice_screen.dart';
import '../../features/results/presentation/results_screen.dart';
import '../../features/results/presentation/solutions_review_screen.dart';
import '../../features/saved/presentation/saved_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/tests/presentation/test_instructions_screen.dart';
import '../../features/tests/presentation/tests_screen.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

Page<dynamic> _buildSmoothPage({
  required BuildContext context,
  required GoRouterState state,
  required Widget child,
  bool isFadeOnly = false,
  int durationMs = 250,
  int reverseDurationMs = 220,
}) {
  final disableAnimations = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
  if (disableAnimations) {
    return NoTransitionPage(key: state.pageKey, child: child);
  }

  return CustomTransitionPage(
    key: state.pageKey,
    child: child,
    transitionDuration: Duration(milliseconds: durationMs),
    reverseTransitionDuration: Duration(milliseconds: reverseDurationMs),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      if (isFadeOnly) {
        return FadeTransition(
          opacity: CurvedAnimation(parent: animation, curve: Curves.easeInOut),
          child: child,
        );
      }
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      );
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.0, 0.025),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}

final GoRouter appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/splash',
  routes: [
    // Splash Route (Always displays on cold start with brand animation)
    GoRoute(
      path: '/splash',
      pageBuilder: (context, state) => _buildSmoothPage(
        context: context,
        state: state,
        child: const SplashScreen(),
        isFadeOnly: true,
        durationMs: 280,
      ),
    ),

    // Onboarding Routes
    GoRoute(
      path: '/onboarding/exam',
      pageBuilder: (context, state) => _buildSmoothPage(
        context: context,
        state: state,
        child: const ChooseExamScreen(),
      ),
    ),
    GoRoute(
      path: '/onboarding/lang',
      pageBuilder: (context, state) => _buildSmoothPage(
        context: context,
        state: state,
        child: const ChooseLanguageScreen(),
      ),
    ),

    // Stateful Nested Bottom Navigation Shell
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return ScaffoldWithNavBar(navigationShell: navigationShell);
      },
      branches: [
        // Tab 1: Home
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/home',
              pageBuilder: (context, state) => _buildSmoothPage(
                context: context,
                state: state,
                child: const HomeScreen(),
                isFadeOnly: true,
                durationMs: 240,
              ),
            ),
          ],
        ),

        // Tab 2: Practice
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/practice',
              pageBuilder: (context, state) => _buildSmoothPage(
                context: context,
                state: state,
                child: const PracticeScreen(),
                isFadeOnly: true,
                durationMs: 240,
              ),
            ),
          ],
        ),

        // Tab 3: Tests
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/tests',
              pageBuilder: (context, state) => _buildSmoothPage(
                context: context,
                state: state,
                child: const TestsScreen(),
                isFadeOnly: true,
                durationMs: 240,
              ),
            ),
          ],
        ),

        // Tab 4: Saved
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/saved',
              pageBuilder: (context, state) => _buildSmoothPage(
                context: context,
                state: state,
                child: const SavedScreen(),
                isFadeOnly: true,
                durationMs: 240,
              ),
            ),
          ],
        ),

        // Tab 5: More
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/more',
              pageBuilder: (context, state) => _buildSmoothPage(
                context: context,
                state: state,
                child: const SettingsScreen(),
                isFadeOnly: true,
                durationMs: 240,
              ),
            ),
          ],
        ),
      ],
    ),

    // Sub-routes pushed on root navigator (full-screen without bottom nav bar)
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/qotd',
      pageBuilder: (context, state) => _buildSmoothPage(
        context: context,
        state: state,
        child: const QotdScreen(),
      ),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/andaman-gk',
      pageBuilder: (context, state) => _buildSmoothPage(
        context: context,
        state: state,
        child: const AndamanGkScreen(),
      ),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/practice/topics/:subjectId',
      pageBuilder: (context, state) {
        final subjectId = state.pathParameters['subjectId'] ?? '';
        return _buildSmoothPage(
          context: context,
          state: state,
          child: TopicsListScreen(subjectId: subjectId),
        );
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/practice/mcq/:topicId',
      pageBuilder: (context, state) {
        final topicId = state.pathParameters['topicId'] ?? '';
        return _buildSmoothPage(
          context: context,
          state: state,
          child: McqPracticeScreen(topicId: topicId),
        );
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/tests/instructions/:testId',
      pageBuilder: (context, state) {
        final testId = state.pathParameters['testId'] ?? '';
        return _buildSmoothPage(
          context: context,
          state: state,
          child: TestInstructionsScreen(testId: testId),
        );
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/tests/cbt/:testId',
      pageBuilder: (context, state) {
        final testId = state.pathParameters['testId'] ?? '';
        return _buildSmoothPage(
          context: context,
          state: state,
          child: CbtExamScreen(testId: testId),
        );
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/tests/results/:attemptId',
      pageBuilder: (context, state) {
        final attemptId = state.pathParameters['attemptId'] ?? '';
        return _buildSmoothPage(
          context: context,
          state: state,
          child: ResultsScreen(attemptId: attemptId),
        );
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/tests/solutions/:attemptId',
      pageBuilder: (context, state) {
        final attemptId = state.pathParameters['attemptId'] ?? '';
        return _buildSmoothPage(
          context: context,
          state: state,
          child: SolutionsReviewScreen(attemptId: attemptId),
        );
      },
    ),
  ],
);
