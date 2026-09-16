import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/app/app.dart';
import 'package:andaman_quiz/core/database/local_database.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  testWidgets('Andaman Quiz app initializes and launches smoke test', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await LocalDatabase.instance.init();

    await tester.pumpWidget(
      const ProviderScope(
        child: AndamanQuizApp(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 2000));

    expect(find.byType(AndamanQuizApp), findsOneWidget);
  });
}
