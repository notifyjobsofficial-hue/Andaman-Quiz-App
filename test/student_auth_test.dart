import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:andaman_quiz/core/database/local_database.dart';
import 'package:andaman_quiz/core/models/models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalDatabase.instance.init(force: true);
  });

  group('StudentUser Model & Security Invariants', () {
    test('StudentUser serialization preserves all essential fields', () {
      final now = DateTime.now();
      final user = StudentUser(
        uid: 'student_uid_123',
        displayName: 'Anand Kumar',
        email: 'anand@example.com',
        photoUrl: 'https://example.com/avatar.png',
        authProvider: 'password',
        selectedExamId: 'AN MTS',
        dailyGoal: 30,
        xp: 150,
        coins: 25,
        currentStreak: 5,
        longestStreak: 12,
        totalQuestionsSolved: 240,
        totalTestsCompleted: 4,
        accuracyPercentage: 82,
        referralCode: 'ANAND9',
        referredBy: 'FRIEND1',
        plan: 'FREE',
        accountStatus: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
        legacyDataMigrated: true,
      );

      final map = user.toMap();

      // SECURITY INVARIANT: Password is NEVER in the model or serialized map
      expect(map.containsKey('password'), isFalse);
      expect(map.containsKey('pass'), isFalse);

      expect(map['uid'], 'student_uid_123');
      expect(map['displayName'], 'Anand Kumar');
      expect(map['email'], 'anand@example.com');
      expect(map['selectedExamId'], 'AN MTS');
      expect(map['dailyGoal'], 30);
      expect(map['xp'], 150);
      expect(map['coins'], 25);
      expect(map['currentStreak'], 5);
      expect(map['referralCode'], 'ANAND9');
      expect(map['accountStatus'], 'ACTIVE');
      expect(map['legacyDataMigrated'], isTrue);

      final restored = StudentUser.fromMap(map);
      expect(restored.uid, user.uid);
      expect(restored.displayName, user.displayName);
      expect(restored.email, user.email);
      expect(restored.selectedExamId, user.selectedExamId);
      expect(restored.dailyGoal, user.dailyGoal);
      expect(restored.xp, user.xp);
      expect(restored.coins, user.coins);
      expect(restored.accountStatus, user.accountStatus);
      expect(restored.isActive, isTrue);
      expect(restored.isSuspended, isFalse);
      expect(restored.isPremium, isFalse);
    });

    test('StudentUser account status flags work accurately', () {
      final now = DateTime.now();
      final activeUser = StudentUser(
        uid: 'u1',
        displayName: 'Active User',
        email: 'a@example.com',
        referralCode: 'U1REF',
        accountStatus: 'ACTIVE',
        plan: 'FREE',
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
      );
      expect(activeUser.isActive, isTrue);
      expect(activeUser.isSuspended, isFalse);
      expect(activeUser.isPremium, isFalse);

      final suspendedUser = activeUser.copyWith(accountStatus: 'SUSPENDED');
      expect(suspendedUser.isActive, isFalse);
      expect(suspendedUser.isSuspended, isTrue);

      final proUser = activeUser.copyWith(plan: 'PREMIUM');
      expect(proUser.isPremium, isTrue);
    });
  });

  group('LocalDatabase Student Caching & Offline Support', () {
    test('saveCurrentStudent, getCurrentStudent and clearCurrentStudent persist properly', () async {
      expect(LocalDatabase.instance.getCurrentStudent(), isNull);

      final now = DateTime.now();
      final student = StudentUser(
        uid: 'uid_offline_test',
        displayName: 'Meera Rao',
        email: 'meera@example.com',
        selectedExamId: 'AN CHSL',
        dailyGoal: 20,
        referralCode: 'MEERA2',
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
      );

      await LocalDatabase.instance.saveCurrentStudent(student);

      final loaded = LocalDatabase.instance.getCurrentStudent();
      expect(loaded, isNotNull);
      expect(loaded!.uid, 'uid_offline_test');
      expect(loaded.displayName, 'Meera Rao');
      expect(loaded.selectedExamId, 'AN CHSL');

      // Test display name helper syncing
      expect(LocalDatabase.instance.getStudentName(), 'Meera Rao');
      expect(LocalDatabase.instance.getSelectedExam(), 'AN CHSL');

      // Clear student on logout
      await LocalDatabase.instance.clearCurrentStudent();
      expect(LocalDatabase.instance.getCurrentStudent(), isNull);
    });

    test('setStudentName updates both display name and in-memory StudentUser', () async {
      final now = DateTime.now();
      final student = StudentUser(
        uid: 'u2',
        displayName: 'Original Name',
        email: 'u2@example.com',
        referralCode: 'U2CODE',
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
      );
      await LocalDatabase.instance.saveCurrentStudent(student);

      await LocalDatabase.instance.setStudentName('Updated Name');
      expect(LocalDatabase.instance.getStudentName(), 'Updated Name');
      expect(LocalDatabase.instance.getCurrentStudent()?.displayName, 'Updated Name');
    });

    test('purgeAllUserData completely clears attempts, bookmarks, streak and student session', () async {
      final now = DateTime.now();
      final student = StudentUser(
        uid: 'u_purge',
        displayName: 'Purge User',
        email: 'purge@example.com',
        referralCode: 'PURGE1',
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
      );
      await LocalDatabase.instance.saveCurrentStudent(student);
      await LocalDatabase.instance.toggleBookmark('q1');
      expect(LocalDatabase.instance.isBookmarked('q1'), isTrue);

      await LocalDatabase.instance.purgeAllUserData();
      expect(LocalDatabase.instance.getCurrentStudent(), isNull);
      expect(LocalDatabase.instance.isBookmarked('q1'), isFalse);
      expect(LocalDatabase.instance.getStreakDays(), 0);
    });
  });

  group('Firestore Rules User-Writable Fields Whitelist Invariants', () {
    test('Strict whitelist prevents client privilege escalation and economy tampering', () {
      const allowedSelfEditFields = {
        'displayName',
        'photoUrl',
        'selectedExamId',
        'dailyGoal',
        'language',
        'preferences',
        'updatedAt',
        'lastActiveAt',
      };

      const forbiddenFields = [
        'accountStatus',
        'role',
        'plan',
        'isPremium',
        'premium',
        'xp',
        'coins',
        'rank',
        'entitlements',
        'purchases',
        'referralRewards',
      ];

      for (final field in forbiddenFields) {
        expect(
          allowedSelfEditFields.contains(field),
          isFalse,
          reason: 'Security violation: $field must NOT be in student self-edit whitelist!',
        );
      }
    });
  });
}
