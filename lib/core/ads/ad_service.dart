import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import '../database/local_database.dart';

class AdService {
  static final AdService instance = AdService._internal();
  AdService._internal();

  // Official AdMob test interstitial ad unit ID
  static const String testInterstitialAdUnitId = 'ca-app-pub-3940256099942544/1033173712';

  bool _isInitialized = false;
  InterstitialAd? _interstitialAd;
  bool _isLoadingAd = false;
  int _breakCounter = 0;

  Future<void> init() async {
    if (_isInitialized) return;
    if (kIsWeb || (defaultTargetPlatform != TargetPlatform.android && defaultTargetPlatform != TargetPlatform.iOS)) {
      _isInitialized = true;
      return;
    }

    try {
      await MobileAds.instance.initialize();
      _isInitialized = true;
      _preloadInterstitial();
    } catch (e) {
      debugPrint('AdMob initialization error (gracefully handled): $e');
      _isInitialized = true;
    }
  }

  void _preloadInterstitial() {
    if (kIsWeb || (defaultTargetPlatform != TargetPlatform.android && defaultTargetPlatform != TargetPlatform.iOS)) {
      return;
    }
    if (_isLoadingAd || _interstitialAd != null) return;

    final config = LocalDatabase.instance.getRemoteConfig();
    if (!config.adsEnabled) return;

    final adUnitId = (config.admobInterstitialId != null && config.admobInterstitialId!.isNotEmpty)
        ? config.admobInterstitialId!
        : testInterstitialAdUnitId;

    _isLoadingAd = true;
    InterstitialAd.load(
      adUnitId: adUnitId,
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

  /// Trigger interstitial ad ONLY at natural breaks:
  /// 1. Free mock test submission (before showing results)
  /// 2. Practice quiz completion
  ///
  /// CRITICAL RULES:
  /// - Paid mock tests are ALWAYS 100% ad-free (`isFreeTest == false`).
  /// - Active test timers and questions must NEVER be interrupted.
  /// - Respects remote `adsEnabled`, `freeTestResultAdEnabled`, `quizResultAdEnabled`, and `adFrequency`.
  /// - Fails open immediately (maximum 3s watchdog) so student experience is never blocked.
  Future<void> showResultInterstitial({
    required bool isFreeTest,
    bool isPracticeQuiz = false,
    required VoidCallback onContinue,
  }) async {
    // 1. Paid tests are strictly AD-FREE
    if (!isFreeTest) {
      onContinue();
      return;
    }

    // 2. Web or non-mobile platforms
    if (kIsWeb || (defaultTargetPlatform != TargetPlatform.android && defaultTargetPlatform != TargetPlatform.iOS)) {
      onContinue();
      return;
    }

    // 3. Remote configuration checks
    final config = LocalDatabase.instance.getRemoteConfig();
    if (!config.adsEnabled) {
      onContinue();
      return;
    }

    if (isPracticeQuiz && !config.quizResultAdEnabled) {
      onContinue();
      return;
    }

    if (!isPracticeQuiz && !config.freeTestResultAdEnabled) {
      onContinue();
      return;
    }

    // 4. Frequency cap check
    _breakCounter++;
    final frequency = config.adFrequency > 0 ? config.adFrequency : 1;
    if (_breakCounter % frequency != 0) {
      debugPrint('AdMob skipped due to frequency cap ($breakCounter / $frequency)');
      onContinue();
      return;
    }

    // 5. Present ad with safety watchdog
    bool hasContinued = false;
    void safeContinue() {
      if (!hasContinued) {
        hasContinued = true;
        onContinue();
      }
    }

    // Watchdog: Never freeze student UI if ad fails to render within 3s
    Timer(const Duration(milliseconds: 3000), () {
      safeContinue();
    });

    final ad = _interstitialAd;
    if (ad == null) {
      safeContinue();
      _preloadInterstitial();
      return;
    }

    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (ad) {
        ad.dispose();
        _interstitialAd = null;
        safeContinue();
        _preloadInterstitial();
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        ad.dispose();
        _interstitialAd = null;
        safeContinue();
        _preloadInterstitial();
      },
    );

    try {
      await ad.show();
    } catch (e) {
      debugPrint('Error showing result interstitial: $e');
      safeContinue();
    }
  }

  int get breakCounter => _breakCounter;
}
