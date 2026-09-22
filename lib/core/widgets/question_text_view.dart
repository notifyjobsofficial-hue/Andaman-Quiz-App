import 'package:flutter/material.dart';

/// A shared typography widget for displaying question text across the student app.
///
/// Implements justified text alignment for normal multi-line question paragraphs
/// while automatically falling back to natural left alignment for single-line
/// or very short questions to prevent unnatural word gaps.
class QuestionTextView extends StatelessWidget {
  final String text;
  final String? prefix;
  final double fontSize;
  final FontWeight fontWeight;
  final double height;
  final Color? color;
  final TextStyle? style;
  final TextAlign? forceAlignment;

  const QuestionTextView({
    super.key,
    required this.text,
    this.prefix,
    this.fontSize = 16.0,
    this.fontWeight = FontWeight.w600,
    this.height = 1.42,
    this.color,
    this.style,
    this.forceAlignment,
  });

  @override
  Widget build(BuildContext context) {
    final effectivePrefix = prefix ?? '';
    final fullText = effectivePrefix.isNotEmpty ? '$effectivePrefix$text' : text;
    if (fullText.trim().isEmpty) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final defaultColor = isDark ? Colors.white : const Color(0xFF0F172A);

    final baseStyle = style ??
        TextStyle(
          fontSize: fontSize,
          fontWeight: fontWeight,
          height: height.clamp(1.35, 1.45),
          color: color ?? theme.textTheme.bodyLarge?.color ?? defaultColor,
        );

    final effectiveStyle = baseStyle.copyWith(
      fontSize: style?.fontSize ?? fontSize,
      fontWeight: style?.fontWeight ?? fontWeight,
      height: style?.height ?? height.clamp(1.35, 1.45),
      color: style?.color ?? color ?? theme.textTheme.bodyLarge?.color ?? defaultColor,
    );

    if (forceAlignment != null) {
      return Text(
        fullText,
        style: effectiveStyle,
        textAlign: forceAlignment,
        softWrap: true,
        textWidthBasis: TextWidthBasis.parent,
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final shouldJustify = shouldJustifyText(
          text: fullText,
          maxWidth: constraints.maxWidth,
          style: effectiveStyle,
          direction: Directionality.maybeOf(context) ?? TextDirection.ltr,
        );

        return Text(
          fullText,
          style: effectiveStyle,
          textAlign: shouldJustify ? TextAlign.justify : TextAlign.left,
          softWrap: true,
          textWidthBasis: TextWidthBasis.parent,
        );
      },
    );
  }

  /// Evaluates whether the given text should use [TextAlign.justify] or [TextAlign.left].
  ///
  /// Rule:
  /// - Single-line or very short text (< 8 words or < 45 chars) -> [TextAlign.left]
  /// - Normal multi-line paragraph (>= 8 words, >= 45 chars, lineCount > 1) -> [TextAlign.justify]
  static bool shouldJustifyText({
    required String text,
    required double maxWidth,
    TextStyle? style,
    TextDirection? direction,
  }) {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return false;

    // Check word count and character length
    final words = trimmed.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.length < 8 || trimmed.length < 45) {
      return false;
    }

    // If width constraint is not finite, fallback to content-based estimation
    if (!maxWidth.isFinite || maxWidth <= 0) {
      return words.length >= 8 && trimmed.length >= 50;
    }

    // Measure line count on the actual available width
    final textPainter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: direction ?? TextDirection.ltr,
      maxLines: null,
    )..layout(maxWidth: maxWidth);

    final lineMetrics = textPainter.computeLineMetrics();
    final lineCount = lineMetrics.length;

    // Only justify when text actually wraps to multiple lines
    return lineCount > 1;
  }
}
