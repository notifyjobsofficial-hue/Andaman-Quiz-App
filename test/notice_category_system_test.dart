import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/core/providers/app_providers.dart';
import 'package:andaman_quiz/features/notices/presentation/notices_screen.dart';
import 'package:andaman_quiz/features/notices/presentation/notice_details_sheet.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  setUp(() async {
    await LocalDatabase.instance.resetForTesting();
    SharedPreferences.setMockInitialValues({});
    await LocalDatabase.instance.init();
  });

  group('Notice Category System: Serialization & Backward Compatibility', () {
    test('Legacy document without type safely defaults to NOTICE', () {
      final legacyRaw = {
        'id': 'legacy_01',
        'title': 'How are u guys',
        'body': 'Checking in with the community',
        'date': '2026-09-18',
        'status': 'published',
        // 'type' is deliberately missing
      };

      final notice = AppNotice.fromMap(legacyRaw);
      expect(notice.type, 'NOTICE');
      expect(notice.typeDisplayName, 'NOTICE');
      expect(notice.isCurrentlyActive, isTrue);
    });

    test('Notice with pinned alias serializes and deserializes properly', () {
      final notice = AppNotice(
        id: 'admit_01',
        title: 'A & N CHSL 2026 Admit Card Out',
        body: 'Admit cards are now downloadable',
        date: '2026-09-20',
        type: 'ADMIT_CARD',
        isPinned: true,
        primaryUrl: 'https://andaman.gov.in/admit-card',
      );

      final map = notice.toMap();
      expect(map['type'], 'ADMIT_CARD');
      expect(map['isPinned'], isTrue);
      expect(map['pinned'], isTrue);
      expect(map['primaryUrl'], 'https://andaman.gov.in/admit-card');

      final reconstructed = AppNotice.fromMap(map);
      expect(reconstructed.type, 'ADMIT_CARD');
      expect(reconstructed.isPinned, isTrue);
      expect(reconstructed.primaryUrl, 'https://andaman.gov.in/admit-card');
      expect(reconstructed.typeDisplayName, 'ADMIT CARD');
    });
  });

  group('NoticesScreen: Category Filter Chips & Filtering', () {
    final List<AppNotice> mockNotices = [
      AppNotice(
        id: 'n_legacy',
        title: 'How are u guys',
        body: 'Just a casual notice',
        date: '2026-09-18',
        type: '', // Untyped legacy
        publishAt: DateTime.now().subtract(const Duration(days: 2)),
      ),
      AppNotice(
        id: 'n_admit',
        title: 'A & N CHSL 2026 Admit Card Out',
        body: 'Admit cards downloadable',
        date: '2026-09-20',
        type: 'ADMIT_CARD',
        primaryUrl: 'https://andaman.gov.in/chsl-admit',
        publishAt: DateTime.now().subtract(const Duration(hours: 5)),
        isPinned: true,
      ),
      AppNotice(
        id: 'n_job',
        title: 'Forest Guard 200 Posts Vacancy',
        body: 'Applications open',
        date: '2026-09-20',
        type: 'JOB',
        applyUrl: 'https://erecruitment.andaman.gov.in',
        publishAt: DateTime.now().subtract(const Duration(hours: 10)),
      ),
      AppNotice(
        id: 'n_result',
        title: 'AN CGL 2025 Tier 1 Final Result',
        body: 'Check your merit score',
        date: '2026-09-19',
        type: 'RESULT',
        primaryUrl: 'https://andaman.gov.in/results',
        publishAt: DateTime.now().subtract(const Duration(days: 1)),
      ),
      AppNotice(
        id: 'n_key',
        title: 'MTS 2025 Provisional Answer Key',
        body: 'Objections invited',
        date: '2026-09-17',
        type: 'ANSWER_KEY',
        primaryUrl: 'https://andaman.gov.in/keys',
        publishAt: DateTime.now().subtract(const Duration(days: 3)),
      ),
      AppNotice(
        id: 'n_date',
        title: 'Steno Exam Date Announced',
        body: 'Exam on 15 Oct 2026',
        date: '2026-09-16',
        type: 'EXAM_DATE',
        officialUrl: 'https://andaman.gov.in/dates',
        publishAt: DateTime.now().subtract(const Duration(days: 4)),
      ),
    ];

    testWidgets('Renders all category filter chips and filters correctly', (tester) async {
      tester.view.physicalSize = const Size(1200, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            noticesStreamProvider.overrideWith((ref) => Stream<List<AppNotice>>.value(mockNotices)),
          ],
          child: const MaterialApp(
            home: NoticesScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify header and filter chips presence
      expect(find.text('Notice Board'), findsOneWidget);
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Jobs'), findsOneWidget);
      expect(find.text('Admit Card'), findsOneWidget);
      expect(find.text('Results'), findsOneWidget);
      expect(find.text('Answer Key'), findsOneWidget);
      expect(find.text('Exam Date'), findsOneWidget);
      expect(find.text('Notices'), findsOneWidget);

      // In 'All' view, both legacy and categorized notices are shown
      expect(find.text('A & N CHSL 2026 Admit Card Out'), findsOneWidget);
      expect(find.text('Forest Guard 200 Posts Vacancy'), findsOneWidget);
      expect(find.text('AN CGL 2025 Tier 1 Final Result'), findsOneWidget);
      expect(find.text('How are u guys'), findsOneWidget);

      // Tap 'Admit Card' chip
      await tester.tap(find.text('Admit Card'));
      await tester.pumpAndSettle();

      // Only Admit Card notice should appear
      expect(find.text('A & N CHSL 2026 Admit Card Out'), findsOneWidget);
      expect(find.text('Forest Guard 200 Posts Vacancy'), findsNothing);
      expect(find.text('AN CGL 2025 Tier 1 Final Result'), findsNothing);
      expect(find.text('How are u guys'), findsNothing);

      // Tap 'Jobs' chip
      await tester.tap(find.text('Jobs'));
      await tester.pumpAndSettle();

      expect(find.text('Forest Guard 200 Posts Vacancy'), findsOneWidget);
      expect(find.text('A & N CHSL 2026 Admit Card Out'), findsNothing);

      // Tap 'Notices' chip: Untyped legacy notice ('How are u guys') falls back to NOTICE
      await tester.tap(find.text('Notices'));
      await tester.pumpAndSettle();

      expect(find.text('How are u guys'), findsOneWidget);
      expect(find.text('Forest Guard 200 Posts Vacancy'), findsNothing);
      expect(find.text('A & N CHSL 2026 Admit Card Out'), findsNothing);

      // Return to 'All'
      await tester.tap(find.text('All'));
      await tester.pumpAndSettle();
      expect(find.text('A & N CHSL 2026 Admit Card Out'), findsOneWidget);
      expect(find.text('How are u guys'), findsOneWidget);
    });
  });

  group('NoticeDetailsSheet: Dynamic Action Buttons & Zero Empty URLs', () {
    testWidgets('Admit Card renders Download Admit Card button only when URL present', (tester) async {
      final admitNotice = AppNotice(
        id: 'admit_card_demo',
        title: 'Admit Card Available',
        body: 'Admit card description',
        date: '2026-09-20',
        type: 'ADMIT_CARD',
        primaryUrl: 'https://andaman.gov.in/download-hallticket',
        officialUrl: 'https://andaman.gov.in',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => NoticeDetailsSheet.show(ctx, admitNotice),
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('Download Admit Card'), findsOneWidget);
      expect(find.text('Official Website'), findsOneWidget);
      // Empty URLs should never produce buttons
      expect(find.text('Apply Online'), findsNothing);
      expect(find.text('View Answer Key'), findsNothing);
    });

    testWidgets('Result notice renders View Result / Scorecard button', (tester) async {
      final resultNotice = AppNotice(
        id: 'res_01',
        title: 'Tier 1 Merit List',
        body: 'Result declared',
        date: '2026-09-20',
        type: 'RESULT',
        primaryUrl: 'https://andaman.gov.in/scorecard',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => NoticeDetailsSheet.show(ctx, resultNotice),
                child: const Text('Open Result'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Result'));
      await tester.pumpAndSettle();

      expect(find.text('View Result / Scorecard'), findsOneWidget);
      expect(find.text('Download Admit Card'), findsNothing);
    });

    testWidgets('Notice with no URLs renders zero action buttons cleanly', (tester) async {
      final noUrlNotice = AppNotice(
        id: 'no_url_01',
        title: 'General Awareness Workshop',
        body: 'Happening in DBRAIT auditorium this Friday',
        date: '2026-09-20',
        type: 'NOTICE',
        // All URL fields are null/empty
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) => ElevatedButton(
                onPressed: () => NoticeDetailsSheet.show(ctx, noUrlNotice),
                child: const Text('Open No URL'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open No URL'));
      await tester.pumpAndSettle();

      expect(find.text('Official Links & Actions'), findsNothing);
      expect(find.text('Open Link'), findsNothing);
      expect(find.text('View PDF'), findsNothing);
    });
  });
}
