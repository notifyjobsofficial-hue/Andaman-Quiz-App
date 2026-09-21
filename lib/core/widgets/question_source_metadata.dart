import 'package:flutter/material.dart';
import '../constants/app_colors.dart';

class QuestionSourceMetadata extends StatelessWidget {
  final String? sourceInfo;
  final EdgeInsetsGeometry padding;

  const QuestionSourceMetadata({
    super.key,
    required this.sourceInfo,
    this.padding = const EdgeInsets.only(top: 8, bottom: 4),
  });

  @override
  Widget build(BuildContext context) {
    final text = sourceInfo?.trim();
    if (text == null || text.isEmpty) {
      return const SizedBox.shrink();
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.textMutedDark : AppColors.textMutedLight;

    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1.5, right: 5),
            child: Icon(
              Icons.school_outlined,
              size: 13,
              color: mutedColor,
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: mutedColor,
                letterSpacing: 0.1,
                height: 1.3,
              ),
              softWrap: true,
            ),
          ),
        ],
      ),
    );
  }
}
