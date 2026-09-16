import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for Andaman Quiz project.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not configured for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDdkNWXdjhR1tdIdpBz7LXf13bMGr16KDM',
    appId: '1:974859873844:web:andamanquizweb',
    messagingSenderId: '974859873844',
    projectId: 'andaman-quiz',
    storageBucket: 'andaman-quiz.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDdkNWXdjhR1tdIdpBz7LXf13bMGr16KDM',
    appId: '1:974859873844:android:a47d9856623e566b3b2461',
    messagingSenderId: '974859873844',
    projectId: 'andaman-quiz',
    storageBucket: 'andaman-quiz.firebasestorage.app',
  );
}
