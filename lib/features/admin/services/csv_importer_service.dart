import 'dart:convert';
import 'package:csv/csv.dart';
import 'package:crypto/crypto.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/models.dart';

class CsvImportRowResult {
  final int rowIndex;
  final bool isValid;
  final String? errorMessage;
  final bool isDuplicate;
  final Question? parsedQuestion;

  const CsvImportRowResult({
    required this.rowIndex,
    required this.isValid,
    this.errorMessage,
    this.isDuplicate = false,
    this.parsedQuestion,
  });
}

class CsvImportReport {
  final int totalRows;
  final int validRowsCount;
  final int invalidRowsCount;
  final int duplicateRowsCount;
  final List<CsvImportRowResult> rows;

  const CsvImportReport({
    required this.totalRows,
    required this.validRowsCount,
    required this.invalidRowsCount,
    required this.duplicateRowsCount,
    required this.rows,
  });
}

class CsvImporterService {
  static final CsvImporterService instance = CsvImporterService._internal();
  CsvImporterService._internal();

  String _generateFingerprint(String questionText) {
    final cleaned = questionText.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    return md5.convert(utf8.encode(cleaned)).toString();
  }

  /// Parses CSV string and verifies against strict validation rules
  CsvImportReport parseAndValidateCsv({
    required String csvContent,
    required List<Question> existingQuestions,
  }) {
    final List<List<dynamic>> rows = Csv().decode(csvContent);

    if (rows.isEmpty) {
      return const CsvImportReport(
        totalRows: 0,
        validRowsCount: 0,
        invalidRowsCount: 0,
        duplicateRowsCount: 0,
        rows: [],
      );
    }

    // Build fingerprint set of existing questions
    final existingFingerprints = <String>{};
    for (final q in existingQuestions) {
      existingFingerprints.add(_generateFingerprint(q.questionEn));
    }

    // First row is header
    final results = <CsvImportRowResult>[];
    int validCount = 0;
    int invalidCount = 0;
    int dupCount = 0;

    for (int i = 1; i < rows.length; i++) {
      final row = rows[i];
      if (row.isEmpty || (row.length == 1 && row[0].toString().trim().isEmpty)) {
        continue;
      }

      // Expected columns:
      // 0: questionEn, 1: questionHi, 2: optA, 3: optB, 4: optC, 5: optD, 6: answerKey, 7: subjectId, 8: topicId, 9: examTags, 10: explanationEn
      if (row.length < 7) {
        invalidCount++;
        results.add(CsvImportRowResult(
          rowIndex: i + 1,
          isValid: false,
          errorMessage: 'Missing required columns (Expected at least question, 4 options, and answer key)',
        ));
        continue;
      }

      final questionEn = row[0].toString().trim();
      final questionHi = row.length > 1 ? row[1].toString().trim() : '';
      final optA = row[2].toString().trim();
      final optB = row[3].toString().trim();
      final optC = row[4].toString().trim();
      final optD = row[5].toString().trim();
      final answerKey = row[6].toString().trim().toUpperCase();
      final subjectId = row.length > 7 && row[7].toString().trim().isNotEmpty ? row[7].toString().trim() : 'sub_an_gk';
      final topicId = row.length > 8 && row[8].toString().trim().isNotEmpty ? row[8].toString().trim() : 'top_an_history';
      final examTagsStr = row.length > 9 ? row[9].toString().trim() : 'CGL,CHSL';
      final explanationEn = row.length > 10 ? row[10].toString().trim() : 'Standard exam solution.';

      if (questionEn.isEmpty) {
        invalidCount++;
        results.add(CsvImportRowResult(
          rowIndex: i + 1,
          isValid: false,
          errorMessage: 'Question text in English cannot be empty',
        ));
        continue;
      }

      if (optA.isEmpty || optB.isEmpty || optC.isEmpty || optD.isEmpty) {
        invalidCount++;
        results.add(CsvImportRowResult(
          rowIndex: i + 1,
          isValid: false,
          errorMessage: 'All 4 options (A, B, C, D) must be provided',
        ));
        continue;
      }

      int correctIdx = -1;
      if (answerKey == 'A' || answerKey == '0') {
        correctIdx = 0;
      } else if (answerKey == 'B' || answerKey == '1') {
        correctIdx = 1;
      } else if (answerKey == 'C' || answerKey == '2') {
        correctIdx = 2;
      } else if (answerKey == 'D' || answerKey == '3') {
        correctIdx = 3;
      } else {
        invalidCount++;
        results.add(CsvImportRowResult(
          rowIndex: i + 1,
          isValid: false,
          errorMessage: 'Invalid answer key "$answerKey". Must be A, B, C, or D.',
        ));
        continue;
      }

      // Duplicate detection
      final fp = _generateFingerprint(questionEn);
      final isDup = existingFingerprints.contains(fp);
      if (isDup) {
        dupCount++;
      } else {
        existingFingerprints.add(fp);
      }

      final parsedQ = Question(
        id: const Uuid().v4(),
        subjectId: subjectId,
        topicId: topicId,
        examTags: examTagsStr.split(',').map((e) => e.trim()).toList(),
        questionEn: questionEn,
        questionHi: questionHi,
        optionsEn: [optA, optB, optC, optD],
        optionsHi: [optA, optB, optC, optD],
        correctIndex: correctIdx,
        explanationEn: explanationEn,
        explanationHi: explanationEn,
        difficulty: 'Medium',
        year: 'CSV Import 2026',
      );

      validCount++;
      results.add(CsvImportRowResult(
        rowIndex: i + 1,
        isValid: true,
        isDuplicate: isDup,
        errorMessage: isDup ? 'Likely duplicate of an existing question' : null,
        parsedQuestion: parsedQ,
      ));
    }

    return CsvImportReport(
      totalRows: rows.length - 1,
      validRowsCount: validCount,
      invalidRowsCount: invalidCount,
      duplicateRowsCount: dupCount,
      rows: results,
    );
  }

  static String get sampleCsvTemplate => '''QuestionEn,QuestionHi,OptionA,OptionB,OptionC,OptionD,AnswerKey,SubjectId,TopicId,Exams,Explanation
"What is the capital of Andaman and Nicobar Islands?","अंडमान और निकोबार की राजधानी क्या है?","Port Blair","Mayabunder","Car Nicobar","Diglipur","A","sub_an_gk","top_an_geography","CGL,CHSL,POLICE,MTS","Port Blair is the administrative headquarters and capital."
"Which channel separates Little Andaman from Great Andaman?","लिटिल अंडमान को ग्रेट अंडमान से कौन सा मार्ग अलग करता है?","10 Degree Channel","Duncan Passage","9 Degree Channel","Coco Channel","B","sub_an_gk","top_an_geography","CGL,CHSL,POLICE","Duncan Passage separates South Andaman from Little Andaman."
''';
}
