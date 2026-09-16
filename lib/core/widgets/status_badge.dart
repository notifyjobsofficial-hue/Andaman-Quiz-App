import 'package:flutter/material.dart';
import '../constants/app_colors.dart';
import '../constants/app_dimens.dart';
import '../models/models.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final Color backgroundColor;
  final Color textColor;
  final IconData? icon;
  final double fontSize;
  final EdgeInsets padding;

  const StatusBadge({
    super.key,
    required this.label,
    required this.backgroundColor,
    required this.textColor,
    this.icon,
    this.fontSize = 11,
    this.padding = const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
  });

  factory StatusBadge.free() {
    return const StatusBadge(
      label: 'FREE',
      backgroundColor: AppColors.successLight,
      textColor: AppColors.success,
      fontSize: 11,
    );
  }

  factory StatusBadge.live() {
    return const StatusBadge(
      label: 'LIVE NOW',
      backgroundColor: Color(0xFFFFE4E6),
      textColor: AppColors.error,
      icon: Icons.fiber_manual_record,
      fontSize: 10,
    );
  }

  factory StatusBadge.pyq() {
    return const StatusBadge(
      label: 'PYQ',
      backgroundColor: AppColors.actionBlueLight,
      textColor: AppColors.actionBlue,
      fontSize: 11,
    );
  }

  factory StatusBadge.exam(String code) {
    return StatusBadge(
      label: code,
      backgroundColor: AppColors.actionBlueLight,
      textColor: AppColors.actionBlue,
      fontSize: 11,
    );
  }

  factory StatusBadge.cbtState(CbtQuestionState state, {int? count}) {
    String text;
    Color bg;
    Color fg;
    IconData iconData;

    switch (state) {
      case CbtQuestionState.notVisited:
        text = 'Not Visited';
        bg = const Color(0xFFF1F5F9);
        fg = AppColors.cbtNotVisited;
        iconData = Icons.radio_button_unchecked;
        break;
      case CbtQuestionState.notAnswered:
        text = 'Not Answered';
        bg = const Color(0xFFFFEDD5);
        fg = AppColors.cbtNotAnswered;
        iconData = Icons.cancel_outlined;
        break;
      case CbtQuestionState.answered:
        text = 'Answered';
        bg = AppColors.successLight;
        fg = AppColors.cbtAnswered;
        iconData = Icons.check_circle_outline;
        break;
      case CbtQuestionState.markedForReview:
        text = 'Marked for Review';
        bg = AppColors.reviewLight;
        fg = AppColors.cbtMarkedReview;
        iconData = Icons.bookmark_border;
        break;
      case CbtQuestionState.answeredAndMarked:
        text = 'Answered & Marked';
        bg = const Color(0xFFDBEAFE);
        fg = AppColors.cbtAnsweredMarked;
        iconData = Icons.bookmark;
        break;
    }

    final displayText = count != null ? '$count $text' : text;
    return StatusBadge(
      label: displayText,
      backgroundColor: bg,
      textColor: fg,
      icon: iconData,
      fontSize: 11,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppDimens.radiusSmall),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: fontSize + 2, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              color: textColor,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
