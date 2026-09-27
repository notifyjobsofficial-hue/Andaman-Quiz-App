import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../database/local_database.dart';
import '../models/models.dart';
import '../services/auth_service.dart';

/// Emits the raw Firebase Auth User on state changes
final authStateStreamProvider = StreamProvider<User?>((ref) {
  return AuthService.instance.authStateChanges;
});

/// Returns whether a student is currently authenticated
final isAuthenticatedProvider = Provider<bool>((ref) {
  final authUser = ref.watch(authStateStreamProvider).value;
  return authUser != null;
});

/// Holds the current StudentUser profile, synced with Firebase and LocalDatabase
class CurrentStudentNotifier extends AsyncNotifier<StudentUser?> {
  @override
  FutureOr<StudentUser?> build() async {
    final authUser = ref.watch(authStateStreamProvider).value;
    if (authUser == null) {
      return null;
    }

    // Try local database first for instant 0ms offline rendering
    final cached = LocalDatabase.instance.getCurrentStudent();
    if (cached != null && cached.uid == authUser.uid) {
      // Background refresh from Firestore
      unawaited(_fetchFresh(authUser.uid));
      return cached;
    }

    // Otherwise fetch from Firestore
    return await AuthService.instance.getCurrentStudentProfile();
  }

  Future<void> _fetchFresh(String uid) async {
    try {
      final fresh = await AuthService.instance.getCurrentStudentProfile(forceRefresh: true);
      if (fresh != null) {
        state = AsyncData(fresh);
      }
    } catch (_) {}
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => AuthService.instance.getCurrentStudentProfile(forceRefresh: true));
  }

  void updateLocal(StudentUser user) {
    state = AsyncData(user);
    LocalDatabase.instance.saveCurrentStudent(user);
  }

  Future<void> signOut() async {
    await AuthService.instance.signOut();
    state = const AsyncData(null);
  }
}

final currentStudentProvider =
    AsyncNotifierProvider<CurrentStudentNotifier, StudentUser?>(CurrentStudentNotifier.new);
