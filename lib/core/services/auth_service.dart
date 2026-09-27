import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../database/local_database.dart';
import '../models/models.dart';
import 'firestore_service.dart';

class AuthService {
  static final AuthService instance = AuthService._internal();
  AuthService._internal();

  FirebaseAuth? get _auth {
    if (Firebase.apps.isEmpty) return null;
    return FirebaseAuth.instance;
  }

  final GoogleSignIn _googleSignIn = GoogleSignIn();

  Stream<User?> get authStateChanges => _auth?.authStateChanges() ?? const Stream.empty();
  User? get currentUser => _auth?.currentUser;
  bool get isAuthenticated => currentUser != null;

  String _generateReferralCode(String uid) {
    if (uid.length >= 6) {
      return uid.substring(0, 6).toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '7');
    }
    return 'AQ${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
  }

  /// Map Firebase Auth exception codes to clean, human-readable error messages.
  String mapAuthError(dynamic error) {
    if (error is FirebaseAuthException) {
      switch (error.code) {
        case 'user-not-found':
          return 'No student account found with this email.';
        case 'wrong-password':
        case 'invalid-credential':
          return 'Incorrect email or password. Please try again.';
        case 'email-already-in-use':
          return 'An account already exists with this email address.';
        case 'weak-password':
          return 'Password is too weak. Please use at least 6 characters.';
        case 'invalid-email':
          return 'Please enter a valid email address.';
        case 'user-disabled':
          return 'This account has been disabled. Please contact support.';
        case 'too-many-requests':
          return 'Too many attempts. Please try again in a few moments.';
        case 'network-request-failed':
          return 'Network error. Please check your internet connection.';
        default:
          return error.message ?? 'Authentication failed. Please try again.';
      }
    }
    return error.toString();
  }

  /// Sign Up with Email and Password
  Future<StudentUser> signUpWithEmail({
    required String email,
    required String password,
    required String displayName,
    String? selectedExamId,
    int? dailyGoal,
    String? referralCode,
  }) async {
    final auth = _auth;
    if (auth == null) {
      throw Exception('Firebase Authentication is not available.');
    }

    final cred = await auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );

    final user = cred.user;
    if (user == null) {
      throw Exception('Failed to create user account.');
    }

    try {
      await user.updateDisplayName(displayName.trim());
    } catch (_) {}

    final now = DateTime.now();
    final student = StudentUser(
      uid: user.uid,
      displayName: displayName.trim().isNotEmpty ? displayName.trim() : 'Andaman Aspirant',
      email: email.trim().toLowerCase(),
      authProvider: 'password',
      selectedExamId: selectedExamId ?? 'ALL',
      dailyGoal: dailyGoal ?? 20,
      referralCode: _generateReferralCode(user.uid),
      referredBy: referralCode?.trim().toUpperCase(),
      plan: 'FREE',
      accountStatus: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      legacyDataMigrated: false,
    );

    // Save to Firestore and local cache
    await FirestoreService.instance.createUserProfile(student);
    await LocalDatabase.instance.saveCurrentStudent(student);

    // Send email verification silently in background
    try {
      await user.sendEmailVerification();
    } catch (_) {}

    return student;
  }

  /// Sign In with Email and Password
  Future<StudentUser> signInWithEmail({
    required String email,
    required String password,
  }) async {
    final auth = _auth;
    if (auth == null) {
      throw Exception('Firebase Authentication is not available.');
    }

    final cred = await auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );

    final user = cred.user;
    if (user == null) {
      throw Exception('User authentication failed.');
    }

    // Fetch existing profile from Firestore
    StudentUser? student = await FirestoreService.instance.fetchUserProfile(user.uid);

    if (student == null) {
      // Re-create profile if missing in Firestore
      final now = DateTime.now();
      student = StudentUser(
        uid: user.uid,
        displayName: user.displayName ?? 'Andaman Aspirant',
        email: (user.email ?? email).trim().toLowerCase(),
        authProvider: 'password',
        referralCode: _generateReferralCode(user.uid),
        plan: 'FREE',
        accountStatus: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
      );
      await FirestoreService.instance.createUserProfile(student);
    } else {
      // Heartbeat last active
      unawaited(FirestoreService.instance.updateLastActive(user.uid));
    }

    await LocalDatabase.instance.saveCurrentStudent(student);
    return student;
  }

  /// Sign In with Google
  Future<StudentUser?> signInWithGoogle() async {
    final auth = _auth;
    if (auth == null) {
      throw Exception('Firebase Authentication is not available.');
    }

    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        // User cancelled the Google sign-in dialog
        return null;
      }

      final googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final cred = await auth.signInWithCredential(credential);
      final user = cred.user;
      if (user == null) {
        throw Exception('Google Sign-In failed to retrieve user account.');
      }

      // Check if user already exists in Firestore
      StudentUser? student = await FirestoreService.instance.fetchUserProfile(user.uid);

      final now = DateTime.now();
      if (student == null) {
        student = StudentUser(
          uid: user.uid,
          displayName: user.displayName ?? googleUser.displayName ?? 'Andaman Aspirant',
          email: user.email ?? googleUser.email,
          photoUrl: user.photoURL ?? googleUser.photoUrl,
          authProvider: 'google',
          referralCode: _generateReferralCode(user.uid),
          plan: 'FREE',
          accountStatus: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
          lastActiveAt: now,
        );
        await FirestoreService.instance.createUserProfile(student);
      } else {
        unawaited(FirestoreService.instance.updateLastActive(user.uid));
      }

      await LocalDatabase.instance.saveCurrentStudent(student);
      return student;
    } catch (e) {
      debugPrint('Google Sign-In error: $e');
      rethrow;
    }
  }

  /// Send Password Reset Email
  Future<void> sendPasswordReset(String email) async {
    final auth = _auth;
    if (auth == null) return;
    await auth.sendPasswordResetEmail(email: email.trim());
  }

  /// Send Email Verification
  Future<void> sendEmailVerification() async {
    final user = currentUser;
    if (user != null && !user.emailVerified) {
      await user.sendEmailVerification();
    }
  }

  /// Sign Out of Student Account
  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
    } catch (_) {}
    await _auth?.signOut();
    await LocalDatabase.instance.clearCurrentStudent();
  }

  /// Reload Firebase Auth user
  Future<void> reloadUser() async {
    await currentUser?.reload();
  }

  /// Get Current Student Profile (Checks memory, local cache, then Firestore)
  Future<StudentUser?> getCurrentStudentProfile({bool forceRefresh = false}) async {
    final user = currentUser;
    if (user == null) return null;

    if (!forceRefresh) {
      final cached = LocalDatabase.instance.getCurrentStudent();
      if (cached != null && cached.uid == user.uid) {
        return cached;
      }
    }

    final fetched = await FirestoreService.instance.fetchUserProfile(user.uid);
    if (fetched != null) {
      await LocalDatabase.instance.saveCurrentStudent(fetched);
    }
    return fetched;
  }

  /// Update Profile Fields
  Future<void> updateProfile({
    String? displayName,
    String? selectedExamId,
    int? dailyGoal,
    String? photoUrl,
  }) async {
    final user = currentUser;
    if (user == null) return;

    final updates = <String, dynamic>{};
    if (displayName != null && displayName.isNotEmpty) {
      updates['displayName'] = displayName.trim();
      try {
        await user.updateDisplayName(displayName.trim());
      } catch (_) {}
    }
    if (selectedExamId != null && selectedExamId.isNotEmpty) {
      updates['selectedExamId'] = selectedExamId;
      await LocalDatabase.instance.setSelectedExam(selectedExamId);
    }
    if (dailyGoal != null && dailyGoal > 0) {
      updates['dailyGoal'] = dailyGoal;
    }
    if (photoUrl != null) {
      updates['photoUrl'] = photoUrl;
    }

    if (updates.isNotEmpty) {
      await FirestoreService.instance.updateUserProfile(user.uid, updates);
      final current = LocalDatabase.instance.getCurrentStudent();
      if (current != null) {
        final updated = current.copyWith(
          displayName: displayName ?? current.displayName,
          selectedExamId: selectedExamId ?? current.selectedExamId,
          dailyGoal: dailyGoal ?? current.dailyGoal,
          photoUrl: photoUrl ?? current.photoUrl,
          updatedAt: DateTime.now(),
        );
        await LocalDatabase.instance.saveCurrentStudent(updated);
      }
    }
  }

  /// Checks if current account is suspended at application level
  Future<bool> isAccountSuspended(String uid) async {
    final profile = await FirestoreService.instance.fetchUserProfile(uid);
    return profile?.isSuspended ?? false;
  }

  /// In-App Delete Account (Play Store Compliance)
  /// Wipes private data, deletes profile, and removes Firebase Auth record.
  Future<void> deleteAccount({String? password}) async {
    final user = currentUser;
    if (user == null) return;

    // 1. Re-authenticate if password provided
    if (password != null && password.isNotEmpty && user.email != null) {
      final cred = EmailAuthProvider.credential(email: user.email!, password: password);
      await user.reauthenticateWithCredential(cred);
    }

    // 2. Mark profile as deleted and wipe user document
    await FirestoreService.instance.updateUserProfile(user.uid, {
      'accountStatus': 'DELETED',
    });
    await FirestoreService.instance.deleteUserProfile(user.uid);

    // 3. Clear local state
    await LocalDatabase.instance.clearCurrentStudent();

    // 4. Delete Firebase Auth user
    await user.delete();
  }
}
