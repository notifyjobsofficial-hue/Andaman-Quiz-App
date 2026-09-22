import 'package:flutter/material.dart';

/// A robust, reusable image container for question diagrams, option illustrations,
/// and answer explanations.
///
/// Features:
/// - Zero container footprint when [imageUrl] is null or empty.
/// - Aspect-ratio containment with rounded borders.
/// - Graceful loading indicator and error fallback (never broken icons or crash).
/// - Tap-to-zoom interactive viewer modal for high-detail diagrams.
class QuestionImageWidget extends StatelessWidget {
  final String? imageUrl;
  final double maxHeight;
  final double borderRadius;
  final bool enableZoom;
  final bool isOption;
  final String? semanticLabel;

  const QuestionImageWidget({
    super.key,
    required this.imageUrl,
    this.maxHeight = 240,
    this.borderRadius = 8,
    this.enableZoom = true,
    this.isOption = false,
    this.semanticLabel,
  });

  @override
  Widget build(BuildContext context) {
    final cleanUrl = imageUrl?.trim();
    if (cleanUrl == null || cleanUrl.isEmpty) {
      return const SizedBox.shrink();
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    Widget imageContent = ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: Container(
        constraints: BoxConstraints(maxHeight: maxHeight),
        color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
        alignment: Alignment.center,
        child: Image.network(
          cleanUrl,
          fit: BoxFit.contain,
          semanticLabel: semanticLabel ?? (isOption ? 'Option Diagram' : 'Question Diagram'),
          loadingBuilder: (context, child, loadingProgress) {
            if (loadingProgress == null) return child;
            final expected = loadingProgress.expectedTotalBytes;
            final loaded = loadingProgress.cumulativeBytesLoaded;
            final value = expected != null && expected > 0 ? (loaded / expected) : null;

            return Container(
              height: isOption ? 60 : 120,
              alignment: Alignment.center,
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  value: value,
                  strokeWidth: 2,
                  color: const Color(0xFF2563EB),
                ),
              ),
            );
          },
          errorBuilder: (context, error, stackTrace) {
            return Container(
              padding: EdgeInsets.symmetric(
                horizontal: isOption ? 8 : 12,
                vertical: isOption ? 6 : 10,
              ),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(borderRadius),
                border: Border.all(
                  color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.broken_image_outlined,
                    size: isOption ? 16 : 18,
                    color: isDark ? Colors.white54 : const Color(0xFF64748B),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    isOption ? 'Option image unavailable' : 'Diagram unavailable',
                    style: TextStyle(
                      fontSize: isOption ? 11 : 12,
                      color: isDark ? Colors.white54 : const Color(0xFF64748B),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );

    if (enableZoom) {
      return Stack(
        alignment: Alignment.bottomRight,
        children: [
          GestureDetector(
            onTap: () => _openFullscreenZoom(context, cleanUrl),
            child: imageContent,
          ),
          Positioned(
            right: 6,
            bottom: 6,
            child: GestureDetector(
              onTap: () => _openFullscreenZoom(context, cleanUrl),
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.black.withAlpha(160),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Icon(
                  Icons.zoom_in,
                  size: 16,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      );
    }

    return imageContent;
  }

  void _openFullscreenZoom(BuildContext context, String url) {
    showDialog(
      context: context,
      barrierColor: Colors.black87,
      builder: (ctx) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.all(12),
          child: Stack(
            children: [
              InteractiveViewer(
                minScale: 1.0,
                maxScale: 4.5,
                child: Center(
                  child: Image.network(
                    url,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) => const Center(
                      child: Text(
                        'Failed to load high-resolution diagram',
                        style: TextStyle(color: Colors.white70),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 8,
                right: 8,
                child: IconButton(
                  icon: const Icon(Icons.close, color: Colors.white, size: 28),
                  onPressed: () => Navigator.of(ctx).pop(),
                  tooltip: 'Close',
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
