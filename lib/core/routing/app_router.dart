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

final GoRouter appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/splash',
  routes: [
    // Splash Route (Always displays on cold start with brand animation)
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashScreen(),
    ),

    // Onboarding Routes
    GoRoute(
      path: '/onboarding/exam',
      builder: (context, state) => const ChooseExamScreen(),
    ),
    GoRoute(
      path: '/onboarding/lang',
      builder: (context, state) => const ChooseLanguageScreen(),
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
              builder: (context, state) => const HomeScreen(),
            ),
          ],
        ),

        // Tab 2: Practice
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/practice',
              builder: (context, state) => const PracticeScreen(),
            ),
          ],
        ),

        // Tab 3: Tests
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/tests',
              builder: (context, state) => const TestsScreen(),
            ),
          ],
        ),

        // Tab 4: Saved
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/saved',
              builder: (context, state) => const SavedScreen(),
            ),
          ],
        ),

        // Tab 5: More
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/more',
              builder: (context, state) => const SettingsScreen(),
            ),
          ],
        ),
      ],
    ),

    // Sub-routes pushed on root navigator (full-screen without bottom nav bar)
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/qotd',
      builder: (context, state) => const QotdScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/andaman-gk',
      builder: (context, state) => const AndamanGkScreen(),
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/practice/topics/:subjectId',
      builder: (context, state) {
        final subjectId = state.pathParameters['subjectId'] ?? '';
        return TopicsListScreen(subjectId: subjectId);
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/practice/mcq/:topicId',
      builder: (context, state) {
        final topicId = state.pathParameters['topicId'] ?? '';
        return McqPracticeScreen(topicId: topicId);
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/tests/instructions/:testId',
      builder: (context, state) {
        final testId = state.pathParameters['testId'] ?? '';
        return TestInstructionsScreen(testId: testId);
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/tests/cbt/:testId',
      builder: (context, state) {
        final testId = state.pathParameters['testId'] ?? '';
        return CbtExamScreen(testId: testId);
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/tests/results/:attemptId',
      builder: (context, state) {
        final attemptId = state.pathParameters['attemptId'] ?? '';
        return ResultsScreen(attemptId: attemptId);
      },
    ),
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/tests/solutions/:attemptId',
      builder: (context, state) {
        final attemptId = state.pathParameters['attemptId'] ?? '';
        return SolutionsReviewScreen(attemptId: attemptId);
      },
    ),
  ],
);
