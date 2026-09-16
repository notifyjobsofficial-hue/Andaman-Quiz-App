import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

class AdService {
  static final AdService instance = AdService._internal();
  AdService._internal();

  static const String testInterstitialAdUnitId = 'ca-app-pub-3940256099942544/1033173712';

  bool _isInitialized = false;
  InterstitialAd? _interstitialAd;
  bool _isLoadingAd = false;

  Future<void> init() async {
    if (_isInitialized) return;
    if (kIsWeb || (defaultTargetPlatform != TargetPlatform.android && defaultTargetPlatform != TargetPlatform.iOS)) {
      _isInitialized = true;
      return;
    }

    try {
      await MobileAds.instance.initialize();
      _isInitialized = true;
    } catch (e) {
      debugPrint('AdMob initialization error (handled gracefully): $e');
      _isInitialized = true;
    }
  }

  void _loadInterstitialAd() {
    if (kIsWeb || (defaultTargetPlatform != TargetPlatform.android && defaultTargetPlatform != TargetPlatform.iOS)) {
      return;
    }
    if (_isLoadingAd || _interstitialAd != null) return;

    _isLoadingAd = true;
    InterstitialAd.load(
      adUnitId: testInterstitialAdUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _interstitialAd = ad;
          _isLoadingAd = false;
        },
        onAdFailedToLoad: (error) {
          debugPrint('Interstitial ad failed to load: ${error.message}');
          _interstitialAd = null;
          _isLoadingAd = false;
        },
      ),
    );
  }

  /// CRITICAL: Shows interstitial before starting an exam.
  /// Must NEVER block exam start.
  /// If no ad, no internet, timeout, or dismissal -> immediately continues.
  Future<void> showExamInterstitial({required VoidCallback onContinue}) async {
    // If not mobile platform, continue immediately
    if (kIsWeb || (defaultTargetPlatform != TargetPlatform.android && defaultTargetPlatform != TargetPlatform.iOS)) {
      onContinue();
      return;
    }

    // Completer to ensure callback runs strictly once
    bool hasContinued = false;
    void safeContinue() {
      if (!hasContinued) {
        hasContinued = true;
        onContinue();
      }
    }

    // Safety watchdog: If anything stalls for more than 3 seconds, fail-open immediately
    Timer(const Duration(milliseconds: 3000), () {
      safeContinue();
    });

    final ad = _interstitialAd;
    if (ad == null) {
      // No ad available, do not wait - start exam immediately
      safeContinue();
      _loadInterstitialAd(); // queue next
      return;
    }

    // Setup presentation callbacks
    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        _interstitialAd = null;
        safeContinue();
        _loadInterstitialAd();
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        ad.dispose();
        _interstitialAd = null;
        safeContinue();
        _loadInterstitialAd();
      },
    );

    try {
      await ad.show();
    } catch (e) {
      debugPrint('Error showing ad: $e');
      safeContinue();
    }
  }
}
