import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'app/app.dart';
import 'core/ads/ad_service.dart';
import 'core/database/local_database.dart';
import 'core/services/firestore_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Global error safety handlers to prevent fatal application termination
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('Caught Flutter framework error: ${details.exception}');
  };

  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    debugPrint('Caught asynchronous platform error: $error');
    return true; // Mark as handled to prevent OS crash
  };

  // Initialize Firebase with platform-specific options
  try {
    if (kIsWeb) {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.web,
      );
    } else {
      // On Android, google-services.json is processed natively by Gradle plugin
      await Firebase.initializeApp();
    }
  } catch (e) {
    debugPrint('Firebase initialization notice (offline mode active): $e');
  }

  // Set preferred portrait orientation for mobile exams
  try {
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
  } catch (_) {}

  // Set system UI overlay style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );

  // Initialize offline local database
  try {
    await LocalDatabase.instance.init();
  } catch (e) {
    debugPrint('LocalDatabase init notice: $e');
  }

  // Initialize Google Mobile Ads with graceful fallback
  try {
    await AdService.instance.init();
  } catch (e) {
    debugPrint('AdService init notice: $e');
  }

  // Safe non-blocking real-time Cloud Firestore synchronization
  try {
    if (Firebase.apps.isNotEmpty) {
      FirestoreService.instance.initRealtimeSync();
    }
  } catch (e) {
    debugPrint('Firestore real-time sync notice: $e');
  }

  runApp(
    const ProviderScope(
      child: AndamanQuizApp(),
    ),
  );
}
