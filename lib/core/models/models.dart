import 'dart:convert';

enum CbtQuestionState {
  notVisited,
  notAnswered,
  answered,
  markedForReview,
  answeredAndMarked,
}

class ExamCategory {
  final String id;
  final String name;
  final String code;
  final int order;
  final bool isActive;

  const ExamCategory({
    required this.id,
    required this.name,
    required this.code,
    this.order = 0,
    this.isActive = true,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'code': code,
    'order': order,
    'isActive': isActive,
  };

  factory ExamCategory.fromMap(Map<String, dynamic> map) => ExamCategory(
    id: map['id'] ?? '',
    name: map['name'] ?? '',
    code: map['code'] ?? '',
    order: (map['order'] as num?)?.toInt() ?? 0,
    isActive: map['isActive'] ?? true,
  );
}

class Exam {
  final String id;
  final String name;
  final String code; // CGL, CHSL, POLICE, MTS
  final String description;
  final int totalQuestions;
  final String iconName;
  final String? categoryId;
  final int order;
  final bool isEnabled;

  const Exam({
    required this.id,
    required this.name,
    required this.code,
    required this.description,
    required this.totalQuestions,
    required this.iconName,
    this.categoryId,
    this.order = 0,
    this.isEnabled = true,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'code': code,
    'description': description,
    'totalQuestions': totalQuestions,
    'iconName': iconName,
    'categoryId': categoryId,
    'order': order,
    'isEnabled': isEnabled,
  };

  factory Exam.fromMap(Map<String, dynamic> map) => Exam(
    id: map['id'] ?? '',
    name: map['name'] ?? '',
    code: map['code'] ?? '',
    description: map['description'] ?? '',
    totalQuestions: map['totalQuestions'] ?? 0,
    iconName: map['iconName'] ?? '',
    categoryId: map['categoryId'],
    order: (map['order'] as num?)?.toInt() ?? 0,
    isEnabled: map['isEnabled'] ?? true,
  );
}

class Subject {
  final String id;
  final String name;
  final String hindiName;
  final String iconName;
  final int questionCount;
  final List<String> examCodes;
  final bool isAndamanSpecial;

  const Subject({
    required this.id,
    required this.name,
    required this.hindiName,
    required this.iconName,
    required this.questionCount,
    required this.examCodes,
    this.isAndamanSpecial = false,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'hindiName': hindiName,
    'iconName': iconName,
    'questionCount': questionCount,
    'examCodes': examCodes,
    'isAndamanSpecial': isAndamanSpecial,
  };

  factory Subject.fromMap(Map<String, dynamic> map) => Subject(
    id: map['id'] ?? '',
    name: map['name'] ?? '',
    hindiName: map['hindiName'] ?? '',
    iconName: map['iconName'] ?? '',
    questionCount: map['questionCount'] ?? 0,
    examCodes: List<String>.from(map['examCodes'] ?? []),
    isAndamanSpecial: map['isAndamanSpecial'] ?? false,
  );
}

class Topic {
  final String id;
  final String subjectId;
  final String name;
  final String hindiName;
  final int questionCount;
  final int completedCount;
  final double accuracy;

  const Topic({
    required this.id,
    required this.subjectId,
    required this.name,
    required this.hindiName,
    required this.questionCount,
    this.completedCount = 0,
    this.accuracy = 0.0,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'subjectId': subjectId,
    'name': name,
    'hindiName': hindiName,
    'questionCount': questionCount,
    'completedCount': completedCount,
    'accuracy': accuracy,
  };

  factory Topic.fromMap(Map<String, dynamic> map) => Topic(
    id: map['id'] ?? '',
    subjectId: map['subjectId'] ?? '',
    name: map['name'] ?? '',
    hindiName: map['hindiName'] ?? '',
    questionCount: map['questionCount'] ?? 0,
    completedCount: map['completedCount'] ?? 0,
    accuracy: (map['accuracy'] as num?)?.toDouble() ?? 0.0,
  );
}

class Question {
  final String id;
  final String subjectId;
  final String topicId;
  final List<String> examTags;
  final String questionEn;
  final String questionHi;
  final List<String> optionsEn;
  final List<String> optionsHi;
  final int correctIndex; // 0 for A, 1 for B, 2 for C, 3 for D
  final String explanationEn;
  final String explanationHi;
  final String? year;
  final String difficulty; // Easy, Medium, Hard
  final bool isBookmarked;
  final String? questionImageUrl;
  final List<String>? optionImages;
  final String? explanationImageUrl;
  final double positiveMarks;
  final double negativeMarks;

  const Question({
    required this.id,
    required this.subjectId,
    required this.topicId,
    required this.examTags,
    required this.questionEn,
    required this.questionHi,
    required this.optionsEn,
    required this.optionsHi,
    required this.correctIndex,
    required this.explanationEn,
    required this.explanationHi,
    this.year,
    this.difficulty = 'Medium',
    this.isBookmarked = false,
    this.questionImageUrl,
    this.optionImages,
    this.explanationImageUrl,
    this.positiveMarks = 2.0,
    this.negativeMarks = 0.5,
  });

  Question copyWith({
    bool? isBookmarked,
    String? questionImageUrl,
    List<String>? optionImages,
    String? explanationImageUrl,
    double? positiveMarks,
    double? negativeMarks,
  }) {
    return Question(
      id: id,
      subjectId: subjectId,
      topicId: topicId,
      examTags: examTags,
      questionEn: questionEn,
      questionHi: questionHi,
      optionsEn: optionsEn,
      optionsHi: optionsHi,
      correctIndex: correctIndex,
      explanationEn: explanationEn,
      explanationHi: explanationHi,
      year: year,
      difficulty: difficulty,
      isBookmarked: isBookmarked ?? this.isBookmarked,
      questionImageUrl: questionImageUrl ?? this.questionImageUrl,
      optionImages: optionImages ?? this.optionImages,
      explanationImageUrl: explanationImageUrl ?? this.explanationImageUrl,
      positiveMarks: positiveMarks ?? this.positiveMarks,
      negativeMarks: negativeMarks ?? this.negativeMarks,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'subjectId': subjectId,
    'topicId': topicId,
    'examTags': examTags,
    'questionEn': questionEn,
    'questionHi': questionHi,
    'optionsEn': optionsEn,
    'optionsHi': optionsHi,
    'correctIndex': correctIndex,
    'explanationEn': explanationEn,
    'explanationHi': explanationHi,
    'year': year,
    'difficulty': difficulty,
    'isBookmarked': isBookmarked ? 1 : 0,
    if (questionImageUrl != null && questionImageUrl!.isNotEmpty) 'question_image_url': questionImageUrl,
    if (optionImages != null && optionImages!.isNotEmpty) 'option_images': optionImages,
    if (explanationImageUrl != null && explanationImageUrl!.isNotEmpty) 'explanation_image_url': explanationImageUrl,
    'positive_marks': positiveMarks,
    'negative_marks': negativeMarks,
  };

  factory Question.fromMap(Map<String, dynamic> map) {
    final qEn = map['questionEn'] ?? map['question_text'] ?? '';
    final qHi = map['questionHi'] ?? '';

    List<String> optEn = [];
    if (map['optionsEn'] != null) {
      optEn = List<String>.from(map['optionsEn']);
    } else if (map['option_a_text'] != null || map['option_b_text'] != null) {
      optEn = [
        map['option_a_text']?.toString() ?? '',
        map['option_b_text']?.toString() ?? '',
        map['option_c_text']?.toString() ?? '',
        map['option_d_text']?.toString() ?? '',
      ];
    }

    List<String>? optImgs;
    if (map['option_images'] != null) {
      optImgs = List<String>.from(map['option_images']);
    } else if (map['optionImages'] != null) {
      optImgs = List<String>.from(map['optionImages']);
    } else if (map['option_a_image_url'] != null ||
        map['option_b_image_url'] != null ||
        map['option_c_image_url'] != null ||
        map['option_d_image_url'] != null) {
      optImgs = [
        map['option_a_image_url']?.toString() ?? '',
        map['option_b_image_url']?.toString() ?? '',
        map['option_c_image_url']?.toString() ?? '',
        map['option_d_image_url']?.toString() ?? '',
      ];
    }

    int cIdx = 0;
    if (map['correctIndex'] != null) {
      cIdx = (map['correctIndex'] as num).toInt();
    } else if (map['correct_answer'] != null) {
      final ans = map['correct_answer'].toString().trim().toUpperCase();
      if (ans == 'A' || ans == '1') {
        cIdx = 0;
      } else if (ans == 'B' || ans == '2') {
        cIdx = 1;
      } else if (ans == 'C' || ans == '3') {
        cIdx = 2;
      } else if (ans == 'D' || ans == '4') {
        cIdx = 3;
      }
    }

    List<String> tags = [];
    if (map['examTags'] != null) {
      tags = List<String>.from(map['examTags']);
    } else if (map['exam'] != null) {
      tags = [map['exam'].toString()];
    }

    return Question(
      id: map['id'] ?? '',
      subjectId: map['subjectId'] ?? map['subject'] ?? '',
      topicId: map['topicId'] ?? map['topic'] ?? '',
      examTags: tags,
      questionEn: qEn,
      questionHi: qHi,
      optionsEn: optEn,
      optionsHi: List<String>.from(map['optionsHi'] ?? []),
      correctIndex: cIdx,
      explanationEn: map['explanationEn'] ?? map['explanation_text'] ?? '',
      explanationHi: map['explanationHi'] ?? '',
      year: map['year'],
      difficulty: map['difficulty'] ?? 'Medium',
      isBookmarked: map['isBookmarked'] == 1 || map['isBookmarked'] == true,
      questionImageUrl: map['question_image_url'] ?? map['questionImageUrl'],
      optionImages: optImgs,
      explanationImageUrl: map['explanation_image_url'] ?? map['explanationImageUrl'],
      positiveMarks: (map['positive_marks'] as num?)?.toDouble() ?? 2.0,
      negativeMarks: (map['negative_marks'] as num?)?.toDouble() ?? 0.5,
    );
  }
}

class TestSection {
  final String id;
  final String name;
  final String hindiName;
  final List<String> questionIds;

  const TestSection({
    required this.id,
    required this.name,
    required this.hindiName,
    required this.questionIds,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'hindiName': hindiName,
    'questionIds': questionIds,
  };

  factory TestSection.fromMap(Map<String, dynamic> map) => TestSection(
    id: map['id'] ?? '',
    name: map['name'] ?? '',
    hindiName: map['hindiName'] ?? '',
    questionIds: List<String>.from(map['questionIds'] ?? []),
  );
}

class MockTest {
  final String id;
  final String title;
  final String examCode; // CGL, CHSL, POLICE, MTS
  final int durationMinutes;
  final int totalQuestions;
  final double totalMarks;
  final double negativeMarks;
  final int attemptsCount;
  final bool isFree;
  final double? price;
  final double? originalPrice;
  final double? offerPrice;
  final String? categoryId;
  final String? description;
  final String? instructions;
  final String status; // published, draft, archived
  final String language; // en, hi, both
  final int displayOrder;
  final bool isLive;
  final bool isPreviousYear;
  final List<TestSection> sections;

  const MockTest({
    required this.id,
    required this.title,
    required this.examCode,
    required this.durationMinutes,
    required this.totalQuestions,
    required this.totalMarks,
    required this.negativeMarks,
    this.attemptsCount = 0,
    this.isFree = true,
    this.price,
    this.originalPrice,
    this.offerPrice,
    this.categoryId,
    this.description,
    this.instructions,
    this.status = 'published',
    this.language = 'both',
    this.displayOrder = 0,
    this.isLive = false,
    this.isPreviousYear = false,
    required this.sections,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'examCode': examCode,
    'durationMinutes': durationMinutes,
    'totalQuestions': totalQuestions,
    'totalMarks': totalMarks,
    'negativeMarks': negativeMarks,
    'attemptsCount': attemptsCount,
    'isFree': isFree,
    if (price != null) 'price': price,
    if (originalPrice != null) 'originalPrice': originalPrice,
    if (offerPrice != null) 'offerPrice': offerPrice,
    if (categoryId != null) 'categoryId': categoryId,
    if (description != null) 'description': description,
    if (instructions != null) 'instructions': instructions,
    'status': status,
    'language': language,
    'displayOrder': displayOrder,
    'isLive': isLive,
    'isPreviousYear': isPreviousYear,
    'sections': sections.map((s) => s.toMap()).toList(),
  };

  factory MockTest.fromMap(Map<String, dynamic> map) => MockTest(
    id: map['id'] ?? '',
    title: map['title'] ?? '',
    examCode: map['examCode'] ?? '',
    durationMinutes: (map['durationMinutes'] as num?)?.toInt() ?? 60,
    totalQuestions: (map['totalQuestions'] as num?)?.toInt() ?? 0,
    totalMarks: (map['totalMarks'] as num?)?.toDouble() ?? 0.0,
    negativeMarks: (map['negativeMarks'] as num?)?.toDouble() ?? 0.5,
    attemptsCount: (map['attemptsCount'] as num?)?.toInt() ?? 0,
    isFree: map['isFree'] ?? true,
    price: (map['price'] as num?)?.toDouble(),
    originalPrice: (map['originalPrice'] as num?)?.toDouble(),
    offerPrice: (map['offerPrice'] as num?)?.toDouble(),
    categoryId: map['categoryId'],
    description: map['description'],
    instructions: map['instructions'],
    status: map['status'] ?? 'published',
    language: map['language'] ?? 'both',
    displayOrder: (map['displayOrder'] as num?)?.toInt() ?? 0,
    isLive: map['isLive'] ?? false,
    isPreviousYear: map['isPreviousYear'] ?? false,
    sections: (map['sections'] as List? ?? [])
        .map((s) => TestSection.fromMap(Map<String, dynamic>.from(s)))
        .toList(),
  );
}

class StudentAttempt {
  final String id;
  final String testId;
  final String testTitle;
  final String examCode;
  final DateTime timestamp;
  final double score;
  final double maxScore;
  final double accuracy;
  final int correctCount;
  final int wrongCount;
  final int unattemptedCount;
  final Map<String, double> sectionScores; // sectionName -> score
  final Map<String, int> selectedAnswers; // questionId -> selectedIndex
  final int timeTakenSeconds;

  const StudentAttempt({
    required this.id,
    required this.testId,
    required this.testTitle,
    required this.examCode,
    required this.timestamp,
    required this.score,
    required this.maxScore,
    required this.accuracy,
    required this.correctCount,
    required this.wrongCount,
    required this.unattemptedCount,
    required this.sectionScores,
    required this.selectedAnswers,
    required this.timeTakenSeconds,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'testId': testId,
    'testTitle': testTitle,
    'examCode': examCode,
    'timestamp': timestamp.toIso8601String(),
    'score': score,
    'maxScore': maxScore,
    'accuracy': accuracy,
    'correctCount': correctCount,
    'wrongCount': wrongCount,
    'unattemptedCount': unattemptedCount,
    'sectionScores': jsonEncode(sectionScores),
    'selectedAnswers': jsonEncode(selectedAnswers),
    'timeTakenSeconds': timeTakenSeconds,
  };

  factory StudentAttempt.fromMap(Map<String, dynamic> map) {
    Map<String, double> parsedSectionScores = {};
    if (map['sectionScores'] != null) {
      if (map['sectionScores'] is String) {
        final decoded = jsonDecode(map['sectionScores']);
        parsedSectionScores = Map<String, double>.from(
          decoded.map((k, v) => MapEntry(k.toString(), (v as num).toDouble())),
        );
      } else if (map['sectionScores'] is Map) {
        parsedSectionScores = Map<String, double>.from(
          (map['sectionScores'] as Map).map((k, v) => MapEntry(k.toString(), (v as num).toDouble())),
        );
      }
    }

    Map<String, int> parsedAnswers = {};
    if (map['selectedAnswers'] != null) {
      if (map['selectedAnswers'] is String) {
        final decoded = jsonDecode(map['selectedAnswers']);
        parsedAnswers = Map<String, int>.from(
          decoded.map((k, v) => MapEntry(k.toString(), v as int)),
        );
      } else if (map['selectedAnswers'] is Map) {
        parsedAnswers = Map<String, int>.from(
          (map['selectedAnswers'] as Map).map((k, v) => MapEntry(k.toString(), v as int)),
        );
      }
    }

    return StudentAttempt(
      id: map['id'] ?? '',
      testId: map['testId'] ?? '',
      testTitle: map['testTitle'] ?? '',
      examCode: map['examCode'] ?? '',
      timestamp: DateTime.tryParse(map['timestamp'] ?? '') ?? DateTime.now(),
      score: (map['score'] as num?)?.toDouble() ?? 0.0,
      maxScore: (map['maxScore'] as num?)?.toDouble() ?? 0.0,
      accuracy: (map['accuracy'] as num?)?.toDouble() ?? 0.0,
      correctCount: map['correctCount'] ?? 0,
      wrongCount: map['wrongCount'] ?? 0,
      unattemptedCount: map['unattemptedCount'] ?? 0,
      sectionScores: parsedSectionScores,
      selectedAnswers: parsedAnswers,
      timeTakenSeconds: map['timeTakenSeconds'] ?? 0,
    );
  }
}
