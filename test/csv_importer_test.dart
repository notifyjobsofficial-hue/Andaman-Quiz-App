import 'package:flutter_test/flutter_test.dart';
import 'package:andaman_quiz/core/models/models.dart';
import 'package:andaman_quiz/features/admin/services/csv_importer_service.dart';

void main() {
  group('CSV Importer & Validation Service Tests', () {
    test('Valid CSV rows parse successfully into Question objects', () {
      final csvData = '''QuestionEn,QuestionHi,OptionA,OptionB,OptionC,OptionD,AnswerKey,SubjectId,TopicId,Exams,Explanation
"What is the capital of Andaman and Nicobar?","राजधानी क्या है?","Port Blair","Mayabunder","Diglipur","Rangat","A","sub_an_gk","top_an_history","CGL,CHSL","Port Blair is capital."
''';

      final report = CsvImporterService.instance.parseAndValidateCsv(
        csvContent: csvData,
        existingQuestions: [],
      );

      expect(report.totalRows, 1);
      expect(report.validRowsCount, 1);
      expect(report.invalidRowsCount, 0);
      expect(report.duplicateRowsCount, 0);

      final question = report.rows.first.parsedQuestion;
      expect(question != null, true);
      expect(question!.questionEn, 'What is the capital of Andaman and Nicobar?');
      expect(question.correctIndex, 0);
      expect(question.optionsEn[0], 'Port Blair');
    });

    test('Detects invalid answer keys and missing fields', () {
      final invalidCsv = '''QuestionEn,QuestionHi,OptionA,OptionB,OptionC,OptionD,AnswerKey,SubjectId,TopicId,Exams,Explanation
"Sample Question without correct key","हिंदी","Opt1","Opt2","Opt3","Opt4","Z","sub_quant","top_quant_percentage","CGL","Exp"
"","हिंदी","Opt1","Opt2","Opt3","Opt4","A","sub_quant","top_quant_percentage","CGL","Exp"
''';

      final report = CsvImporterService.instance.parseAndValidateCsv(
        csvContent: invalidCsv,
        existingQuestions: [],
      );

      expect(report.invalidRowsCount, 2);
      expect(report.validRowsCount, 0);
      expect(report.rows[0].errorMessage?.contains('Invalid answer key'), true);
      expect(report.rows[1].errorMessage?.contains('cannot be empty'), true);
    });

    test('Detects duplicate questions based on text fingerprinting', () {
      const existingQ = Question(
        id: 'existing_1',
        subjectId: 'sub_an_gk',
        topicId: 'top_an_history',
        examTags: ['CGL'],
        questionEn: 'Which water body separates Andaman from Nicobar?',
        questionHi: '',
        optionsEn: ['9 Degree', '10 Degree', 'Duncan', 'Palk'],
        optionsHi: ['9 Degree', '10 Degree', 'Duncan', 'Palk'],
        correctIndex: 1,
        explanationEn: '10 Degree channel',
        explanationHi: '10 Degree channel',
      );

      final duplicateCsv = '''QuestionEn,QuestionHi,OptionA,OptionB,OptionC,OptionD,AnswerKey,SubjectId,TopicId,Exams,Explanation
"Which water body separates Andaman from Nicobar?","","9 Degree","10 Degree","Duncan","Palk","B","sub_an_gk","top_an_history","CGL","Exp"
''';

      final report = CsvImporterService.instance.parseAndValidateCsv(
        csvContent: duplicateCsv,
        existingQuestions: [existingQ],
      );

      expect(report.duplicateRowsCount, 1);
      expect(report.rows.first.isDuplicate, true);
    });
  });
}
