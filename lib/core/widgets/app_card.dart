import 'package:flutter/material.dart';
import '../constants/app_colors.dart';
import '../constants/app_dimens.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final BorderSide? border;

  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppDimens.space16),
    this.onTap,
    this.backgroundColor,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final defaultBorder = BorderSide(
      color: isDark ? AppColors.cardBorderDark : AppColors.cardBorderLight,
      width: 1,
    );

    return Material(
      color: backgroundColor ?? (isDark ? AppColors.surfaceDark : AppColors.surfaceLight),
      shape: RoundedRectangleBorder(
        borderRadius: AppDimens.cardBorderRadius,
        side: border ?? defaultBorder,
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        splashColor: AppColors.actionBlue.withValues(alpha: 0.08),
        highlightColor: AppColors.actionBlue.withValues(alpha: 0.04),
        child: Padding(
          padding: padding,
          child: child,
        ),
      ),
    );
  }
}
