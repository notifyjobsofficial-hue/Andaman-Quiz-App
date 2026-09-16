import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../database/local_database.dart';
import '../services/firestore_service.dart';

class BillingService with WidgetsBindingObserver {
  static final BillingService instance = BillingService._internal();
  BillingService._internal();

  final InAppPurchase _iap = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _subscription;

  bool _isAvailable = false;
  bool get isAvailable => _isAvailable;

  // Reactive notifier for UI components to listen to unlocked product IDs
  final ValueNotifier<Set<String>> unlockedNotifier = ValueNotifier<Set<String>>({});

  // Track pending purchase context to record proper test metadata
  String? _pendingTestId;
  String? _pendingTestTitle;
  double? _pendingAmount;

  // Event callbacks for UI
  void Function(String productId)? onPurchaseSuccess;
  void Function(String error)? onPurchaseError;
  ValueNotifier<bool> isPurchasing = ValueNotifier<bool>(false);

  Future<void> init() async {
    // Seed initial cached entitlements for instant offline startup
    unlockedNotifier.value = LocalDatabase.instance.getPurchasedProductIds();

    if (kIsWeb) return;

    WidgetsBinding.instance.addObserver(this);

    try {
      _isAvailable = await _iap.isAvailable();
      if (!_isAvailable) {
        debugPrint('Google Play Store Billing is not available on this device.');
        return;
      }

      _subscription = _iap.purchaseStream.listen(
        _handlePurchaseUpdates,
        onDone: () => _subscription?.cancel(),
        onError: (error) {
          debugPrint('Billing purchase stream error: $error');
          isPurchasing.value = false;
          onPurchaseError?.call('Billing connection error: $error');
        },
      );

      // Auto-query / restore purchases silently on startup to sync current entitlements
      restorePurchases(silent: true);
    } catch (e) {
      debugPrint('Error initializing InAppPurchase: $e');
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _isAvailable) {
      // Silently refresh entitlements whenever student resumes the app
      restorePurchases(silent: true);
    }
  }

  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _subscription?.cancel();
    _subscription = null;
  }

  Future<void> _handlePurchaseUpdates(List<PurchaseDetails> purchaseDetailsList) async {
    for (final purchaseDetails in purchaseDetailsList) {
      if (purchaseDetails.status == PurchaseStatus.pending) {
        isPurchasing.value = true;
      } else if (purchaseDetails.status == PurchaseStatus.error) {
        isPurchasing.value = false;
        final errMsg = purchaseDetails.error?.message ?? 'Payment failed or was cancelled.';
        debugPrint('Purchase error: $errMsg');
        onPurchaseError?.call(errMsg);

        if (purchaseDetails.pendingCompletePurchase) {
          await _iap.completePurchase(purchaseDetails);
        }
      } else if (purchaseDetails.status == PurchaseStatus.purchased ||
          purchaseDetails.status == PurchaseStatus.restored) {
        // Unlock locally in LocalDatabase
        final productId = purchaseDetails.productID;
        final targetTestId = _pendingTestId ?? productId;

        await LocalDatabase.instance.unlockTest(targetTestId);
        if (productId != targetTestId) {
          await LocalDatabase.instance.unlockTest(productId);
        }

        // Update reactive notifier immediately
        unlockedNotifier.value = LocalDatabase.instance.getPurchasedProductIds();

        // Record to Cloud Firestore
        await FirestoreService.instance.recordPurchase(
          testId: targetTestId,
          testTitle: _pendingTestTitle ?? 'Mock Test Purchase',
          productId: productId,
          amount: _pendingAmount ?? 0.0,
          orderId: purchaseDetails.purchaseID ?? 'order_${DateTime.now().millisecondsSinceEpoch}',
          purchaseToken: purchaseDetails.verificationData.serverVerificationData,
        );

        if (purchaseDetails.pendingCompletePurchase) {
          await _iap.completePurchase(purchaseDetails);
        }

        isPurchasing.value = false;
        _pendingTestId = null;
        _pendingTestTitle = null;
        _pendingAmount = null;

        debugPrint('Purchase successful for product: $productId. Test unlocked!');
        onPurchaseSuccess?.call(productId);
      }
    }
  }

  /// Launch Google Play In-App Purchase flow for a paid mock test
  Future<bool> buyMockTest({
    required String testId,
    required String testTitle,
    String? productId,
    required double amount,
  }) async {
    final effectiveProductId = (productId != null && productId.isNotEmpty) ? productId : testId;

    _pendingTestId = testId;
    _pendingTestTitle = testTitle;
    _pendingAmount = amount;

    if (kIsWeb || !_isAvailable) {
      // In non-supported environment or emulator without Google Play, fallback to direct unlock for testing
      debugPrint('Google Play Billing not active. Unlocking test directly in local offline mode.');
      await LocalDatabase.instance.unlockTest(testId);
      if (productId != null) {
        await LocalDatabase.instance.unlockTest(productId);
      }
      unlockedNotifier.value = LocalDatabase.instance.getPurchasedProductIds();
      onPurchaseSuccess?.call(effectiveProductId);
      return true;
    }

    try {
      isPurchasing.value = true;
      final ProductDetailsResponse response = await _iap.queryProductDetails({effectiveProductId});

      if (response.notFoundIDs.contains(effectiveProductId) || response.productDetails.isEmpty) {
        debugPrint('Product SKU "$effectiveProductId" not found on Google Play Console.');
        isPurchasing.value = false;

        // If product is not yet approved or live on Google Play Console, fallback to graceful local unlock with notice
        onPurchaseError?.call(
          'Product "$effectiveProductId" is pending Google Play Store approval. Please ensure the SKU is created in Google Play Console.',
        );
        return false;
      }

      final ProductDetails productDetails = response.productDetails.first;
      final PurchaseParam purchaseParam = PurchaseParam(productDetails: productDetails);

      return await _iap.buyNonConsumable(purchaseParam: purchaseParam);
    } catch (e) {
      debugPrint('Error initiating purchase: $e');
      isPurchasing.value = false;
      onPurchaseError?.call('Unable to initiate purchase: $e');
      return false;
    }
  }

  /// Restore previous purchases for returning users or new device setup
  Future<void> restorePurchases({bool silent = false}) async {
    if (!_isAvailable) return;
    try {
      if (!silent) {
        isPurchasing.value = true;
      }
      await _iap.restorePurchases();
      unlockedNotifier.value = LocalDatabase.instance.getPurchasedProductIds();
      if (!silent) {
        isPurchasing.value = false;
      }
    } catch (e) {
      debugPrint('Error restoring purchases: $e');
      if (!silent) {
        isPurchasing.value = false;
        onPurchaseError?.call('Failed to restore purchases: $e');
      }
    }
  }
}
