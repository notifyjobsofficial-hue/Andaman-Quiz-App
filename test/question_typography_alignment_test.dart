import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:andaman_quiz/core/widgets/question_text_view.dart';
import 'package:andaman_quiz/core/constants/app_colors.dart';

void main() {
  group('QuestionTextView Typography & Alignment Decision Suite', () {
    const shortEnglishQ = 'What is the capital of India?';
    const longEnglishQ =
        'Which of the following environmental factors is primarily responsible for the phenomenon known as ocean acidification, and how does it directly impact calcifying marine organisms?';
    const longHindiQ =
        'भारतीय संविधान के किस अनुच्छेद में मौलिक अधिकारों के प्रवर्तन के लिए सर्वोच्च न्यायालय जाने के अधिकार की गारंटी दी गई है, जिसे डॉ. बी. आर. अम्बेडकर ने संविधान का हृदय और आत्मा कहा था?';
    const mixedHindiEnglishQ =
        'निम्नलिखित में से कौन सा प्रोटोकॉल World Wide Web पर सुरक्षित डेटा ट्रांसफर (HTTPS Secure Communication) के लिए उपयोग किया जाता है?';
    const shortImagePromptQ = 'Study the diagram:';

    test('1. Short English question defaults to LEFT alignment (no abnormal word gaps)', () {
      final shouldJustify320 = QuestionTextView.shouldJustifyText(
        text: shortEnglishQ,
        maxWidth: 280,
      );
      final shouldJustify412 = QuestionTextView.shouldJustifyText(
        text: shortEnglishQ,
        maxWidth: 380,
      );

      expect(shouldJustify320, isFalse);
      expect(shouldJustify412, isFalse);
    });

    test('2. Long English question uses JUSTIFIED alignment on mobile viewports', () {
      final shouldJustify320 = QuestionTextView.shouldJustifyText(
        text: longEnglishQ,
        maxWidth: 280,
      );
      final shouldJustify360 = QuestionTextView.shouldJustifyText(
        text: longEnglishQ,
        maxWidth: 320,
      );
      final shouldJustify412 = QuestionTextView.shouldJustifyText(
        text: longEnglishQ,
        maxWidth: 372,
      );

      expect(shouldJustify320, isTrue);
      expect(shouldJustify360, isTrue);
      expect(shouldJustify412, isTrue);
    });

    test('3. Long Hindi question wraps cleanly and uses JUSTIFIED alignment', () {
      final shouldJustify320 = QuestionTextView.shouldJustifyText(
        text: longHindiQ,
        maxWidth: 280,
      );
      final shouldJustify360 = QuestionTextView.shouldJustifyText(
        text: longHindiQ,
        maxWidth: 320,
      );

      expect(shouldJustify320, isTrue);
      expect(shouldJustify360, isTrue);
    });

    test('4. Mixed Hindi/English question uses JUSTIFIED alignment', () {
      final shouldJustify360 = QuestionTextView.shouldJustifyText(
        text: mixedHindiEnglishQ,
        maxWidth: 320,
      );

      expect(shouldJustify360, isTrue);
    });

    test('5. Short question with image prompt remains LEFT aligned', () {
      final shouldJustify = QuestionTextView.shouldJustifyText(
        text: shortImagePromptQ,
        maxWidth: 280,
      );

      expect(shouldJustify, isFalse);
    });

    test('6. Empty or whitespace question returns false without error', () {
      expect(QuestionTextView.shouldJustifyText(text: '', maxWidth: 320), isFalse);
      expect(QuestionTextView.shouldJustifyText(text: '   ', maxWidth: 320), isFalse);
    });
  });

  group('QuestionTextView Multi-Viewport Widget & Overflow Tests', () {
    const longEnglishQ =
        'Which of the following environmental factors is primarily responsible for the phenomenon known as ocean acidification, and how does it directly impact calcifying marine organisms?';
    const longHindiQ =
        'भारतीय संविधान के किस अनुच्छेद में मौलिक अधिकारों के प्रवर्तन के लिए सर्वोच्च न्यायालय जाने के अधिकार की गारंटी दी गई है, जिसे डॉ. बी. आर. अम्बेडकर ने संविधान का हृदय और आत्मा कहा था?';
    const shortQ = 'What is the capital of India?';

    testWidgets('Renders long English question at 320dp with TextAlign.justify and ZERO overflow', (tester) async {
      tester.view.physicalSize = const Size(320 * 2, 600 * 2);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Padding(
              padding: EdgeInsets.all(16.0),
              child: QuestionTextView(
                text: longEnglishQ,
                fontSize: 16,
                height: 1.45,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final textFinder = find.byType(Text);
      expect(textFinder, findsOneWidget);
      final textWidget = tester.widget<Text>(textFinder);
      expect(textWidget.textAlign, equals(TextAlign.justify));
      expect(tester.takeException(), isNull);
    });

    testWidgets('Renders long Hindi question at 320dp with TextAlign.justify and ZERO overflow', (tester) async {
      tester.view.physicalSize = const Size(320 * 2, 600 * 2);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Padding(
              padding: EdgeInsets.all(16.0),
              child: QuestionTextView(
                text: longHindiQ,
                fontSize: 16,
                height: 1.45,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final textFinder = find.byType(Text);
      expect(textFinder, findsOneWidget);
      final textWidget = tester.widget<Text>(textFinder);
      expect(textWidget.textAlign, equals(TextAlign.justify));
      expect(tester.takeException(), isNull);
    });

    testWidgets('Renders short question at 320dp with TextAlign.left', (tester) async {
      tester.view.physicalSize = const Size(320 * 2, 600 * 2);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Padding(
              padding: EdgeInsets.all(16.0),
              child: QuestionTextView(
                text: shortQ,
                fontSize: 16,
                height: 1.45,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final textFinder = find.byType(Text);
      expect(textFinder, findsOneWidget);
      final textWidget = tester.widget<Text>(textFinder);
      expect(textWidget.textAlign, equals(TextAlign.left));
      expect(tester.takeException(), isNull);
    });

    testWidgets('Renders at 360dp standard width with proper line height', (tester) async {
      tester.view.physicalSize = const Size(360 * 2, 740 * 2);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Padding(
              padding: EdgeInsets.all(16.0),
              child: QuestionTextView(
                text: longEnglishQ,
                prefix: '1. ',
                fontSize: 15,
                height: 1.4,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final textFinder = find.byType(Text);
      expect(textFinder, findsOneWidget);
      final textWidget = tester.widget<Text>(textFinder);
      expect(textWidget.textAlign, equals(TextAlign.justify));
      expect(textWidget.style?.height, inInclusiveRange(1.35, 1.45));
      expect(textWidget.data, startsWith('1. '));
    });

    testWidgets('Renders at 412dp large screen width without overflow', (tester) async {
      tester.view.physicalSize = const Size(412 * 2, 915 * 2);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Padding(
              padding: EdgeInsets.all(16.0),
              child: QuestionTextView(
                text: longEnglishQ,
                fontSize: 16,
                height: 1.45,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final textFinder = find.byType(Text);
      expect(textFinder, findsOneWidget);
      final textWidget = tester.widget<Text>(textFinder);
      expect(textWidget.textAlign, equals(TextAlign.justify));
    });

    testWidgets('Option items remain naturally LEFT aligned while Question is JUSTIFIED', (tester) async {
      tester.view.physicalSize = const Size(360 * 2, 740 * 2);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(tester.view.resetPhysicalSize);

      final options = [
        'A. Increased dissolved carbon dioxide lowering ocean pH',
        'B. Increased nitrogen runoff causing eutrophication',
        'C. Ozone layer depletion in the stratosphere',
        'D. Heavy metal deposition from industrial waste'
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const QuestionTextView(
                    text: longEnglishQ,
                    fontSize: 16,
                    height: 1.45,
                  ),
                  const SizedBox(height: 16),
                  ...options.map(
                    (opt) => Container(
                      key: ValueKey(opt),
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.cardBorderLight),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        opt,
                        textAlign: TextAlign.left, // Natural left alignment
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Question is justified
      final questionFinder = find.descendant(
        of: find.byType(QuestionTextView),
        matching: find.byType(Text),
      );
      expect(questionFinder, findsOneWidget);
      expect(tester.widget<Text>(questionFinder).textAlign, equals(TextAlign.justify));

      // Each option is left aligned
      for (final opt in options) {
        final optFinder = find.descendant(
          of: find.byKey(ValueKey(opt)),
          matching: find.byType(Text),
        );
        expect(tester.widget<Text>(optFinder).textAlign, equals(TextAlign.left));
      }
    });
  });
}
