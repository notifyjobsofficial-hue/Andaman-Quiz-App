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

  /// Flexible exam matcher: handles exact match, substring match, case-insensitivity,
  /// alphanumeric normalization (e.g. "CGL" matches "AN CGL"), and global subjects.
  bool matchesExam(String targetExam) {
    if (targetExam.toUpperCase() == 'ALL') return true;
    if (examCodes.isEmpty) return true; // Global subject if not restricted
    final normTarget = targetExam.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').toUpperCase();
    return examCodes.any((code) {
      final normCode = code.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').toUpperCase();
      return normCode == normTarget ||
          normTarget.contains(normCode) ||
          normCode.contains(normTarget);
    });
  }
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
  final String usageType; // 'PRACTICE', 'MOCK', 'BOTH'
  final String status; // 'published', 'draft', 'archived'

  bool get isPublished => status.toLowerCase() == 'published';
  bool get isDraft => status.toLowerCase() == 'draft';
  bool get isArchived => status.toLowerCase() == 'archived';

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
    this.usageType = 'BOTH',
    this.status = 'published',
  });

  Question copyWith({
    bool? isBookmarked,
    String? questionImageUrl,
    List<String>? optionImages,
    String? explanationImageUrl,
    double? positiveMarks,
    double? negativeMarks,
    String? usageType,
    String? status,
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
      usageType: usageType ?? this.usageType,
      status: status ?? this.status,
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
    'usageType': usageType,
    'usage_type': usageType,
    'status': status,
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
      usageType: () {
        final raw = (map['usageType'] ?? map['usage_type'])?.toString().toUpperCase();
        if (raw == 'PRACTICE' || raw == 'MOCK' || raw == 'BOTH') return raw!;
        return 'BOTH';
      }(),
      status: () {
        final rawStatus = map['status']?.toString().toLowerCase().trim();
        final bool isDraftExplicit = map['is_draft'] == true || map['isDraft'] == true || rawStatus == 'draft';
        final bool isArchivedExplicit = map['is_archived'] == true || map['isArchived'] == true || rawStatus == 'archived';

        if (isArchivedExplicit) return 'archived';
        if (isDraftExplicit) return 'draft';
        if (rawStatus == 'published') return 'published';
        if (rawStatus != null && rawStatus.isNotEmpty) return rawStatus;
        return 'published'; // Safe default for verified live records
      }(),
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
  final double? positiveMarks;
  final double negativeMarks;
  final int attemptsCount;
  final bool isFree;
  final double? price;
  final double? originalPrice;
  final double? offerPrice;
  final String? productId; // Google Play In-App Product ID / SKU
  final String? categoryId;
  final String? description;
  final String? instructions;
  final String status; // published, draft, archived
  final String language; // en, hi, both
  final int displayOrder;
  final bool isLive;
  final bool isPreviousYear;
  final String? startDate;
  final String? endDate;
  final bool shuffleQuestions;
  final bool shuffleOptions;
  final bool showResultImmediately;
  final bool showExplanation;
  final List<TestSection> sections;

  const MockTest({
    required this.id,
    required this.title,
    required this.examCode,
    required this.durationMinutes,
    required this.totalQuestions,
    required this.totalMarks,
    this.positiveMarks,
    required this.negativeMarks,
    this.attemptsCount = 0,
    this.isFree = true,
    this.price,
    this.originalPrice,
    this.offerPrice,
    this.productId,
    this.categoryId,
    this.description,
    this.instructions,
    this.status = 'published',
    this.language = 'both',
    this.displayOrder = 0,
    this.isLive = false,
    this.isPreviousYear = false,
    this.startDate,
    this.endDate,
    this.shuffleQuestions = true,
    this.shuffleOptions = true,
    this.showResultImmediately = true,
    this.showExplanation = true,
    required this.sections,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'examCode': examCode,
    'durationMinutes': durationMinutes,
    'totalQuestions': totalQuestions,
    'totalMarks': totalMarks,
    if (positiveMarks != null) 'positiveMarks': positiveMarks,
    'negativeMarks': negativeMarks,
    'attemptsCount': attemptsCount,
    'isFree': isFree,
    if (price != null) 'price': price,
    if (originalPrice != null) 'originalPrice': originalPrice,
    if (offerPrice != null) 'offerPrice': offerPrice,
    if (productId != null && productId!.isNotEmpty) 'productId': productId,
    if (categoryId != null) 'categoryId': categoryId,
    if (description != null) 'description': description,
    if (instructions != null) 'instructions': instructions,
    'status': status,
    'language': language,
    'displayOrder': displayOrder,
    'isLive': isLive,
    'isPreviousYear': isPreviousYear,
    if (startDate != null) 'startDate': startDate,
    if (endDate != null) 'endDate': endDate,
    'shuffleQuestions': shuffleQuestions,
    'shuffleOptions': shuffleOptions,
    'showResultImmediately': showResultImmediately,
    'showExplanation': showExplanation,
    'sections': sections.map((s) => s.toMap()).toList(),
  };

  factory MockTest.fromMap(Map<String, dynamic> map) => MockTest(
    id: map['id'] ?? '',
    title: map['title'] ?? '',
    examCode: map['examCode'] ?? '',
    durationMinutes: (map['durationMinutes'] as num?)?.toInt() ?? 60,
    totalQuestions: (map['totalQuestions'] as num?)?.toInt() ?? 0,
    totalMarks: (map['totalMarks'] as num?)?.toDouble() ?? 0.0,
    positiveMarks: (map['positiveMarks'] as num?)?.toDouble(),
    negativeMarks: (map['negativeMarks'] as num?)?.toDouble() ?? 0.5,
    attemptsCount: (map['attemptsCount'] as num?)?.toInt() ?? 0,
    isFree: map['isFree'] ?? true,
    price: (map['price'] as num?)?.toDouble(),
    originalPrice: (map['originalPrice'] as num?)?.toDouble(),
    offerPrice: (map['offerPrice'] as num?)?.toDouble(),
    productId: map['productId']?.toString(),
    categoryId: map['categoryId'],
    description: map['description'],
    instructions: map['instructions'],
    status: map['status'] ?? 'published',
    language: map['language'] ?? 'both',
    displayOrder: (map['displayOrder'] as num?)?.toInt() ?? 0,
    isLive: map['isLive'] ?? false,
    isPreviousYear: map['isPreviousYear'] ?? false,
    startDate: map['startDate'],
    endDate: map['endDate'],
    shuffleQuestions: map['shuffleQuestions'] ?? true,
    shuffleOptions: map['shuffleOptions'] ?? true,
    showResultImmediately: map['showResultImmediately'] ?? true,
    showExplanation: map['showExplanation'] ?? true,
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

class HomeBanner {
  final String id;
  final String title;
  final String imageUrl;
  final String targetRoute;
  final bool active;
  final int order;

  const HomeBanner({
    required this.id,
    required this.title,
    required this.imageUrl,
    required this.targetRoute,
    this.active = true,
    this.order = 0,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'imageUrl': imageUrl,
    'targetRoute': targetRoute,
    'active': active,
    'order': order,
  };

  factory HomeBanner.fromMap(Map<String, dynamic> map) => HomeBanner(
    id: map['id'] ?? '',
    title: map['title'] ?? '',
    imageUrl: map['imageUrl'] ?? '',
    targetRoute: map['targetRoute'] ?? '',
    active: map['active'] ?? true,
    order: (map['order'] as num?)?.toInt() ?? 0,
  );
}

class AppNotice {
  final String id;
  final String title;
  final String body;
  final String date;
  final bool active;
  final bool isPinned;
  final String type; // JOB, ADMIT_CARD, RESULT, ANSWER_KEY, EXAM_DATE, NOTICE
  final String? shortDescription;
  final String? content;
  final String? organization;
  final String? exam;
  final String? imageUrl;
  final String? pdfUrl;
  final String? officialUrl;
  final String? applyUrl;
  final String? primaryUrl;
  final String? externalUrl;
  final DateTime? publishAt;
  final DateTime? expiresAt;
  final String status; // published, draft, scheduled
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const AppNotice({
    required this.id,
    required this.title,
    required this.body,
    required this.date,
    this.active = true,
    this.isPinned = false,
    this.type = 'NOTICE',
    this.shortDescription,
    this.content,
    this.organization,
    this.exam,
    this.imageUrl,
    this.pdfUrl,
    this.officialUrl,
    this.applyUrl,
    this.primaryUrl,
    this.externalUrl,
    this.publishAt,
    this.expiresAt,
    this.status = 'published',
    this.createdAt,
    this.updatedAt,
  });

  bool get isNew {
    final pub = publishAt ?? DateTime.tryParse(date);
    if (pub == null) return false;
    final diff = DateTime.now().difference(pub);
    return !diff.isNegative && diff.inHours <= 48;
  }

  String get typeDisplayName {
    switch (type.toUpperCase().replaceAll(' ', '_')) {
      case 'JOB':
        return 'JOB';
      case 'ADMIT_CARD':
        return 'ADMIT CARD';
      case 'RESULT':
        return 'RESULT';
      case 'ANSWER_KEY':
        return 'ANSWER KEY';
      case 'EXAM_DATE':
        return 'EXAM DATE';
      case 'NOTICE':
      default:
        return 'NOTICE';
    }
  }

  bool get isCurrentlyActive {
    final s = status.toLowerCase();
    if (!active || s == 'draft' || s == 'expired' || s == 'archived') return false;
    final now = DateTime.now();
    if (publishAt != null && now.isBefore(publishAt!)) return false;
    if (expiresAt != null && now.isAfter(expiresAt!)) return false;
    return true;
  }

  String get displayDescription =>
      (shortDescription != null && shortDescription!.trim().isNotEmpty)
          ? shortDescription!.trim()
          : (body.trim().isNotEmpty ? body.trim() : (content ?? ''));

  Map<String, dynamic> toMap() => {
    'id': id,
    'title': title,
    'body': body,
    'date': date,
    'active': active,
    'isPinned': isPinned,
    'pinned': isPinned,
    'type': type,
    if (shortDescription != null) 'shortDescription': shortDescription,
    if (content != null) 'content': content,
    if (organization != null) 'organization': organization,
    if (exam != null) 'exam': exam,
    if (imageUrl != null && imageUrl!.isNotEmpty) 'imageUrl': imageUrl,
    if (pdfUrl != null && pdfUrl!.isNotEmpty) 'pdfUrl': pdfUrl,
    if (primaryUrl != null && primaryUrl!.isNotEmpty) 'primaryUrl': primaryUrl,
    if (officialUrl != null && officialUrl!.isNotEmpty) 'officialUrl': officialUrl,
    if (applyUrl != null && applyUrl!.isNotEmpty) 'applyUrl': applyUrl,
    if (externalUrl != null && externalUrl!.isNotEmpty) 'externalUrl': externalUrl,
    if (publishAt != null) 'publishAt': publishAt!.toIso8601String(),
    if (expiresAt != null) 'expiresAt': expiresAt!.toIso8601String(),
    'status': status,
    if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
    if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
  };

  factory AppNotice.fromMap(Map<String, dynamic> map) {
    DateTime? parseDate(dynamic val) {
      if (val == null) return null;
      if (val is DateTime) return val;
      if (val is num) return DateTime.fromMillisecondsSinceEpoch(val.toInt());
      if (val is String) return DateTime.tryParse(val);
      try {
        final toDate = (val as dynamic).toDate();
        if (toDate is DateTime) return toDate;
      } catch (_) {}
      return null;
    }

    final pAt = parseDate(map['publishAt']);
    final dateStr = map['date'] ?? (pAt != null ? pAt.toIso8601String().split('T').first : '');
    final b = map['body'] ?? map['shortDescription'] ?? map['content'] ?? '';

    return AppNotice(
      id: map['id'] ?? '',
      title: map['title'] ?? '',
      body: b,
      date: dateStr,
      active: map['active'] ?? true,
      isPinned: map['isPinned'] ?? map['pinned'] ?? false,
      type: map['type'] ?? 'NOTICE',
      shortDescription: map['shortDescription'] ?? b,
      content: map['content'] ?? map['body'],
      organization: map['organization'],
      exam: map['exam'],
      imageUrl: map['imageUrl'],
      pdfUrl: map['pdfUrl'],
      primaryUrl: map['primaryUrl'],
      officialUrl: map['officialUrl'],
      applyUrl: map['applyUrl'],
      externalUrl: map['externalUrl'],
      publishAt: pAt ?? DateTime.tryParse(dateStr),
      expiresAt: parseDate(map['expiresAt']),
      status: map['status'] ?? 'published',
      createdAt: parseDate(map['createdAt']),
      updatedAt: parseDate(map['updatedAt']),
    );
  }
}

class QuestionOfTheDay {
  final String id;
  final String date; // YYYY-MM-DD
  final String questionId;
  final String? questionText;
  final String? questionImageUrl;
  final List<String>? options;
  final List<String>? optionImages;
  final String? correctAnswer;
  final int correctIndex;
  final String? explanation;
  final String? explanationImageUrl;
  final String? exam;
  final String? examName;
  final String? source;
  final String? year;
  final String? shift;
  final String? examDate;
  final String? topic;
  final String difficulty;
  final int durationSeconds;
  final String? publishedDate;
  final bool active;

  const QuestionOfTheDay({
    required this.id,
    required this.date,
    required this.questionId,
    this.questionText,
    this.questionImageUrl,
    this.options,
    this.optionImages,
    this.correctAnswer,
    this.correctIndex = 0,
    this.explanation,
    this.explanationImageUrl,
    this.exam,
    this.examName,
    this.source,
    this.year,
    this.shift,
    this.examDate,
    this.topic,
    this.difficulty = 'Medium',
    this.durationSeconds = 60,
    this.publishedDate,
    this.active = true,
  });

  String get formattedSourceInfo {
    final parts = <String>[];
    if (examName != null && examName!.trim().isNotEmpty) {
      parts.add(examName!.trim());
    } else if (exam != null && exam!.trim().isNotEmpty) {
      parts.add(exam!.trim());
    } else if (source != null && source!.trim().isNotEmpty) {
      parts.add(source!.trim());
    }
    if (examDate != null && examDate!.trim().isNotEmpty) {
      parts.add(examDate!.trim());
    } else if (year != null && year!.trim().isNotEmpty) {
      parts.add(year!.trim());
    }
    if (shift != null && shift!.trim().isNotEmpty) {
      parts.add(shift!.trim());
    }
    if (parts.isEmpty) {
      return 'Previous Year Question';
    }
    return parts.join(' • ');
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'date': date,
    'questionId': questionId,
    if (questionText != null) 'questionText': questionText,
    if (questionImageUrl != null && questionImageUrl!.isNotEmpty) 'questionImageUrl': questionImageUrl,
    if (options != null) 'options': options,
    if (optionImages != null && optionImages!.isNotEmpty) 'optionImages': optionImages,
    if (correctAnswer != null) 'correctAnswer': correctAnswer,
    'correctIndex': correctIndex,
    if (explanation != null) 'explanation': explanation,
    if (explanationImageUrl != null && explanationImageUrl!.isNotEmpty) 'explanationImageUrl': explanationImageUrl,
    if (exam != null) 'exam': exam,
    if (examName != null) 'examName': examName,
    if (source != null) 'source': source,
    if (year != null) 'year': year,
    if (shift != null) 'shift': shift,
    if (examDate != null) 'examDate': examDate,
    if (topic != null) 'topic': topic,
    'difficulty': difficulty,
    'durationSeconds': durationSeconds,
    if (publishedDate != null) 'publishedDate': publishedDate,
    'active': active,
  };

  factory QuestionOfTheDay.fromMap(Map<String, dynamic> map) {
    int cIdx = 0;
    if (map['correctIndex'] != null) {
      cIdx = (map['correctIndex'] as num).toInt();
    } else if (map['correctAnswer'] != null) {
      final ans = map['correctAnswer'].toString().trim().toUpperCase();
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

    return QuestionOfTheDay(
      id: map['id'] ?? '',
      date: map['date'] ?? '',
      questionId: map['questionId'] ?? '',
      questionText: map['questionText'] ?? map['question_text'],
      questionImageUrl: map['questionImageUrl'] ?? map['question_image_url'],
      options: map['options'] != null ? List<String>.from(map['options']) : null,
      optionImages: map['optionImages'] != null
          ? List<String>.from(map['optionImages'])
          : (map['option_images'] != null ? List<String>.from(map['option_images']) : null),
      correctAnswer: map['correctAnswer'] ?? map['correct_answer'],
      correctIndex: cIdx,
      explanation: map['explanation'] ?? map['explanation_text'],
      explanationImageUrl: map['explanationImageUrl'] ?? map['explanation_image_url'],
      exam: map['exam'],
      examName: map['examName'],
      source: map['source'],
      year: map['year']?.toString(),
      shift: map['shift']?.toString(),
      examDate: map['examDate']?.toString(),
      topic: map['topic'],
      difficulty: map['difficulty'] ?? 'Medium',
      durationSeconds: (map['durationSeconds'] as num?)?.toInt() ?? 60,
      publishedDate: map['publishedDate'],
      active: map['active'] ?? true,
    );
  }
}

enum LiveTestStatus {
  upcoming,
  live,
  ended,
}

class LiveTestItem {
  final String id;
  final String testId; // Canonical linked mock test ID
  String get mockTestId => testId; // Backward-compatible alias
  final String title;
  final DateTime startAt;
  final DateTime endAt;
  final String? instructions;
  final bool featured;
  final bool isPublished;
  final bool allowEarlyJoin;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const LiveTestItem({
    required this.id,
    String? testId,
    String? mockTestId,
    required this.title,
    required this.startAt,
    required this.endAt,
    this.instructions,
    this.featured = false,
    this.isPublished = true,
    this.allowEarlyJoin = false,
    this.createdAt,
    this.updatedAt,
  }) : testId = testId ?? mockTestId ?? '';

  LiveTestStatus get status {
    final now = DateTime.now();
    if (endAt.isBefore(startAt) || endAt.isAtSameMomentAs(startAt)) {
      return LiveTestStatus.ended;
    }
    if (now.isBefore(startAt)) {
      return LiveTestStatus.upcoming;
    } else if (now.isBefore(endAt)) {
      return LiveTestStatus.live;
    } else {
      return LiveTestStatus.ended;
    }
  }

  Duration get remainingDuration {
    final now = DateTime.now();
    if (now.isBefore(startAt)) {
      return startAt.difference(now);
    } else if (now.isBefore(endAt)) {
      return endAt.difference(now);
    }
    return Duration.zero;
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'testId': testId,
    'mockTestId': testId, // Dual-write for backward compatibility
    'title': title,
    'startAt': startAt.toIso8601String(),
    'endAt': endAt.toIso8601String(),
    if (instructions != null) 'instructions': instructions,
    'featured': featured,
    'isPublished': isPublished,
    'allowEarlyJoin': allowEarlyJoin,
    if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
    if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
  };

  factory LiveTestItem.fromMap(Map<String, dynamic> map) {
    DateTime parseDate(dynamic val) {
      if (val is DateTime) return val;
      if (val is num) return DateTime.fromMillisecondsSinceEpoch(val.toInt());
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      try {
        final toDate = (val as dynamic).toDate();
        if (toDate is DateTime) return toDate;
      } catch (_) {}
      return DateTime.now();
    }

    final linkedTestId = (map['testId'] ?? map['mockTestId'] ?? map['mockId'] ?? '').toString();

    return LiveTestItem(
      id: map['id'] ?? '',
      testId: linkedTestId,
      mockTestId: linkedTestId,
      title: map['title'] ?? '',
      startAt: parseDate(map['startAt'] ?? map['startDate']),
      endAt: parseDate(map['endAt'] ?? map['endDate']),
      instructions: map['instructions'],
      featured: map['featured'] ?? false,
      isPublished: map['isPublished'] ?? true,
      allowEarlyJoin: map['allowEarlyJoin'] ?? false,
      createdAt: map['createdAt'] != null ? parseDate(map['createdAt']) : null,
      updatedAt: map['updatedAt'] != null ? parseDate(map['updatedAt']) : null,
    );
  }
}

class RemoteAppConfig {
  final String id;
  final bool maintenanceMode;
  final String? maintenanceMessage;
  final String supportEmail;
  final String? whatsappUrl;
  final String? telegramUrl;
  final String? officialWebsiteUrl;
  final bool adsEnabled;
  final bool freeTestResultAdEnabled;
  final bool quizResultAdEnabled;
  final int adFrequency;
  final String? admobBannerId;
  final String? admobInterstitialId;

  const RemoteAppConfig({
    this.id = 'main',
    this.maintenanceMode = false,
    this.maintenanceMessage,
    this.supportEmail = 'support@andamanquiz.com',
    this.whatsappUrl,
    this.telegramUrl,
    this.officialWebsiteUrl,
    this.adsEnabled = true,
    this.freeTestResultAdEnabled = true,
    this.quizResultAdEnabled = true,
    this.adFrequency = 1,
    this.admobBannerId,
    this.admobInterstitialId,
  });

  Map<String, dynamic> toMap() => {
    'id': id,
    'maintenanceMode': maintenanceMode,
    if (maintenanceMessage != null) 'maintenanceMessage': maintenanceMessage,
    'supportEmail': supportEmail,
    if (whatsappUrl != null) 'whatsappUrl': whatsappUrl,
    if (telegramUrl != null) 'telegramUrl': telegramUrl,
    if (officialWebsiteUrl != null) 'officialWebsiteUrl': officialWebsiteUrl,
    'adsEnabled': adsEnabled,
    'freeTestResultAdEnabled': freeTestResultAdEnabled,
    'quizResultAdEnabled': quizResultAdEnabled,
    'adFrequency': adFrequency,
    if (admobBannerId != null) 'admobBannerId': admobBannerId,
    if (admobInterstitialId != null) 'admobInterstitialId': admobInterstitialId,
  };

  factory RemoteAppConfig.fromMap(Map<String, dynamic> map) => RemoteAppConfig(
    id: map['id'] ?? 'main',
    maintenanceMode: map['maintenanceMode'] ?? false,
    maintenanceMessage: map['maintenanceMessage'],
    supportEmail: map['supportEmail'] ?? 'support@andamanquiz.com',
    whatsappUrl: map['whatsappUrl'],
    telegramUrl: map['telegramUrl'],
    officialWebsiteUrl: map['officialWebsiteUrl'],
    adsEnabled: map['adsEnabled'] ?? true,
    freeTestResultAdEnabled: map['freeTestResultAdEnabled'] ?? true,
    quizResultAdEnabled: map['quizResultAdEnabled'] ?? true,
    adFrequency: (map['adFrequency'] as num?)?.toInt() ?? 1,
    admobBannerId: map['admobBannerId'],
    admobInterstitialId: map['admobInterstitialId'],
  );
}

