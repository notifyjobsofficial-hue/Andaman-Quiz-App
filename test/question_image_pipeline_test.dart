import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/core/widgets/question_image_widget.dart';

void main() {
  group('Question Model Canonical Image Pipeline Suite', () {
    test('1. Reads canonical camelCase image fields with priority over legacy aliases', () {
      final map = {
        'id': 'q_test_1',
        'subjectId': 'sub_1',
        'topicId': 'top_1',
        'examTags': ['TEST'],
        'questionEn': 'Identify the diagram',
        'questionHi': '',
        'optionsEn': ['A', 'B', 'C', 'D'],
        'optionsHi': ['', '', '', ''],
        'correctIndex': 0,
        'explanationEn': 'Explanation test',
        'explanationHi': '',
        'questionImageUrl': 'https://storage/canonical_q.webp',
        'question_image_url': 'https://legacy/old_q.webp',
        'imageUrl': 'https://legacy/very_old_q.webp',
        'optionAImageUrl': 'https://storage/canonical_optA.webp',
        'optionImages': [
          'https://storage/arr_optA.webp',
          'https://storage/arr_optB.webp',
        ],
        'explanationImageUrl': 'https://storage/canonical_exp.webp',
        'explanation_image_url': 'https://legacy/old_exp.webp',
      };

      final q = Question.fromMap(map);

      expect(q.questionImageUrl, 'https://storage/canonical_q.webp');
      expect(q.optionAImageUrl, 'https://storage/canonical_optA.webp');
      expect(q.optionBImageUrl, 'https://storage/arr_optB.webp');
      expect(q.explanationImageUrl, 'https://storage/canonical_exp.webp');
      expect(q.hasQuestionImage, isTrue);
      expect(q.hasOptionImage(0), isTrue);
      expect(q.hasOptionImage(1), isTrue);
      expect(q.hasOptionImage(2), isFalse);
      expect(q.hasAnyOptionImage, isTrue);
    });

    test('2. Falls back to legacy snake_case fields when canonical fields are absent', () {
      final map = {
        'id': 'q_test_2',
        'subjectId': 'sub_1',
        'topicId': 'top_1',
        'examTags': ['TEST'],
        'questionEn': 'Legacy Question',
        'questionHi': '',
        'optionsEn': ['A', 'B', 'C', 'D'],
        'optionsHi': ['', '', '', ''],
        'correctIndex': 1,
        'explanationEn': '',
        'explanationHi': '',
        'question_image_url': 'https://storage/legacy_q.webp',
        'explanation_image_url': 'https://storage/legacy_exp.webp',
        'option_b_image_url': 'https://storage/legacy_optB.webp',
      };

      final q = Question.fromMap(map);

      expect(q.questionImageUrl, 'https://storage/legacy_q.webp');
      expect(q.explanationImageUrl, 'https://storage/legacy_exp.webp');
      expect(q.optionBImageUrl, 'https://storage/legacy_optB.webp');
      expect(q.hasQuestionImage, isTrue);
      expect(q.hasOptionImage(0), isFalse);
      expect(q.hasOptionImage(1), isTrue);
      expect(q.optionImageAt(1), 'https://storage/legacy_optB.webp');
      expect(q.hasAnyOptionImage, isTrue);
    });

    test('3. toMap dual-writes canonical and legacy fields for backward compatibility', () {
      const q = Question(
        id: 'q_test_3',
        subjectId: 'sub_1',
        topicId: 'top_1',
        examTags: ['TEST'],
        questionEn: 'Dual-write Question',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: ['', '', '', ''],
        correctIndex: 2,
        explanationEn: '',
        explanationHi: '',
        questionImageUrl: 'https://storage/canonical_q.webp',
        optionImages: ['https://storage/optA.webp', '', '', ''],
        explanationImageUrl: 'https://storage/exp.webp',
      );

      final map = q.toMap();

      expect(map['questionImageUrl'], 'https://storage/canonical_q.webp');
      expect(map['question_image_url'], 'https://storage/canonical_q.webp');
      expect(map['optionAImageUrl'], 'https://storage/optA.webp');
      expect(map['option_a_image_url'], 'https://storage/optA.webp');
      expect(map['optionImages'], ['https://storage/optA.webp', '', '', '']);
      expect(map['explanationImageUrl'], 'https://storage/exp.webp');
      expect(map['explanation_image_url'], 'https://storage/exp.webp');
    });

    test('4. Correctly identifies absence of images and returns false for helpers', () {
      const q = Question(
        id: 'q_test_4',
        subjectId: 'sub_1',
        topicId: 'top_1',
        examTags: ['TEST'],
        questionEn: 'Text only question',
        questionHi: '',
        optionsEn: ['A', 'B', 'C', 'D'],
        optionsHi: ['', '', '', ''],
        correctIndex: 0,
        explanationEn: '',
        explanationHi: '',
      );

      expect(q.hasQuestionImage, isFalse);
      expect(q.hasAnyOptionImage, isFalse);
      expect(q.hasOptionImage(0), isFalse);
      expect(q.optionImageAt(0), isNull);
    });
  });

  group('QuestionImageWidget Zero-Footprint Suite', () {
    testWidgets('1. Returns SizedBox.shrink() when imageUrl is null', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: QuestionImageWidget(imageUrl: null),
          ),
        ),
      );

      final sizedBoxFinder = find.byType(SizedBox);
      expect(sizedBoxFinder, findsOneWidget);
      final sizedBox = tester.widget<SizedBox>(sizedBoxFinder);
      expect(sizedBox.width, 0.0);
      expect(sizedBox.height, 0.0);
    });

    testWidgets('2. Returns SizedBox.shrink() when imageUrl is empty or whitespace', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: QuestionImageWidget(imageUrl: '   '),
          ),
        ),
      );

      final sizedBoxFinder = find.byType(SizedBox);
      expect(sizedBoxFinder, findsOneWidget);
      final sizedBox = tester.widget<SizedBox>(sizedBoxFinder);
      expect(sizedBox.width, 0.0);
      expect(sizedBox.height, 0.0);
    });
  });
}
