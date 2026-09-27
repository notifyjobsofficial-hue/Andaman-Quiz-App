import 'package:cloud_firestore/cloud_firestore.dart';

DateTime _parseDateTime(dynamic val) {
  if (val == null) return DateTime.now();
  if (val is Timestamp) return val.toDate();
  if (val is DateTime) return val;
  if (val is int) return DateTime.fromMillisecondsSinceEpoch(val);
  if (val is String) {
    try {
      return DateTime.parse(val);
    } catch (_) {}
  }
  return DateTime.now();
}

class StudentUser {
  final String uid;
  final String displayName;
  final String email;
  final String? photoUrl;
  final String authProvider; // 'password' | 'google'
  final String selectedExamId;
  final int dailyGoal;
  final int xp;
  final int coins;
  final int currentStreak;
  final int longestStreak;
  final int totalQuestionsSolved;
  final int totalTestsCompleted;
  final int accuracyPercentage;
  final String referralCode;
  final String? referredBy;
  final String plan; // 'FREE' | 'PREMIUM'
  final String accountStatus; // 'ACTIVE' | 'SUSPENDED'
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime lastActiveAt;
  final bool legacyDataMigrated;

  const StudentUser({
    required this.uid,
    required this.displayName,
    required this.email,
    this.photoUrl,
    this.authProvider = 'password',
    this.selectedExamId = 'ALL',
    this.dailyGoal = 20,
    this.xp = 0,
    this.coins = 0,
    this.currentStreak = 0,
    this.longestStreak = 0,
    this.totalQuestionsSolved = 0,
    this.totalTestsCompleted = 0,
    this.accuracyPercentage = 0,
    required this.referralCode,
    this.referredBy,
    this.plan = 'FREE',
    this.accountStatus = 'ACTIVE',
    required this.createdAt,
    required this.updatedAt,
    required this.lastActiveAt,
    this.legacyDataMigrated = false,
  });

  bool get isActive => accountStatus.toUpperCase() == 'ACTIVE';
  bool get isSuspended => accountStatus.toUpperCase() == 'SUSPENDED';
  bool get isPremium => plan.toUpperCase() == 'PREMIUM';

  StudentUser copyWith({
    String? uid,
    String? displayName,
    String? email,
    String? photoUrl,
    String? authProvider,
    String? selectedExamId,
    int? dailyGoal,
    int? xp,
    int? coins,
    int? currentStreak,
    int? longestStreak,
    int? totalQuestionsSolved,
    int? totalTestsCompleted,
    int? accuracyPercentage,
    String? referralCode,
    String? referredBy,
    String? plan,
    String? accountStatus,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? lastActiveAt,
    bool? legacyDataMigrated,
  }) {
    return StudentUser(
      uid: uid ?? this.uid,
      displayName: displayName ?? this.displayName,
      email: email ?? this.email,
      photoUrl: photoUrl ?? this.photoUrl,
      authProvider: authProvider ?? this.authProvider,
      selectedExamId: selectedExamId ?? this.selectedExamId,
      dailyGoal: dailyGoal ?? this.dailyGoal,
      xp: xp ?? this.xp,
      coins: coins ?? this.coins,
      currentStreak: currentStreak ?? this.currentStreak,
      longestStreak: longestStreak ?? this.longestStreak,
      totalQuestionsSolved: totalQuestionsSolved ?? this.totalQuestionsSolved,
      totalTestsCompleted: totalTestsCompleted ?? this.totalTestsCompleted,
      accuracyPercentage: accuracyPercentage ?? this.accuracyPercentage,
      referralCode: referralCode ?? this.referralCode,
      referredBy: referredBy ?? this.referredBy,
      plan: plan ?? this.plan,
      accountStatus: accountStatus ?? this.accountStatus,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      lastActiveAt: lastActiveAt ?? this.lastActiveAt,
      legacyDataMigrated: legacyDataMigrated ?? this.legacyDataMigrated,
    );
  }

  Map<String, dynamic> toMap({bool useServerTimestamps = false}) {
    return {
      'uid': uid,
      'displayName': displayName,
      'email': email,
      if (photoUrl != null) 'photoUrl': photoUrl,
      'authProvider': authProvider,
      'selectedExamId': selectedExamId,
      'dailyGoal': dailyGoal,
      'xp': xp,
      'coins': coins,
      'currentStreak': currentStreak,
      'longestStreak': longestStreak,
      'totalQuestionsSolved': totalQuestionsSolved,
      'totalTestsCompleted': totalTestsCompleted,
      'accuracyPercentage': accuracyPercentage,
      'referralCode': referralCode,
      if (referredBy != null) 'referredBy': referredBy,
      'plan': plan,
      'accountStatus': accountStatus,
      'createdAt': useServerTimestamps ? FieldValue.serverTimestamp() : createdAt.toIso8601String(),
      'updatedAt': useServerTimestamps ? FieldValue.serverTimestamp() : updatedAt.toIso8601String(),
      'lastActiveAt': useServerTimestamps ? FieldValue.serverTimestamp() : lastActiveAt.toIso8601String(),
      'legacyDataMigrated': legacyDataMigrated,
    };
  }

  factory StudentUser.fromMap(Map<String, dynamic> map, {String? uid}) {
    return StudentUser(
      uid: (map['uid'] as String?) ?? uid ?? '',
      displayName: (map['displayName'] as String?) ?? 'Andaman Aspirant',
      email: (map['email'] as String?) ?? '',
      photoUrl: map['photoUrl'] as String?,
      authProvider: (map['authProvider'] as String?) ?? 'password',
      selectedExamId: (map['selectedExamId'] as String?) ?? 'ALL',
      dailyGoal: (map['dailyGoal'] as num?)?.toInt() ?? 20,
      xp: (map['xp'] as num?)?.toInt() ?? 0,
      coins: (map['coins'] as num?)?.toInt() ?? 0,
      currentStreak: (map['currentStreak'] as num?)?.toInt() ?? 0,
      longestStreak: (map['longestStreak'] as num?)?.toInt() ?? 0,
      totalQuestionsSolved: (map['totalQuestionsSolved'] as num?)?.toInt() ?? 0,
      totalTestsCompleted: (map['totalTestsCompleted'] as num?)?.toInt() ?? 0,
      accuracyPercentage: (map['accuracyPercentage'] as num?)?.toInt() ?? 0,
      referralCode: (map['referralCode'] as String?) ?? '',
      referredBy: map['referredBy'] as String?,
      plan: (map['plan'] as String?) ?? 'FREE',
      accountStatus: (map['accountStatus'] as String?) ?? 'ACTIVE',
      createdAt: _parseDateTime(map['createdAt']),
      updatedAt: _parseDateTime(map['updatedAt']),
      lastActiveAt: _parseDateTime(map['lastActiveAt']),
      legacyDataMigrated: (map['legacyDataMigrated'] as bool?) ?? false,
    );
  }
}
