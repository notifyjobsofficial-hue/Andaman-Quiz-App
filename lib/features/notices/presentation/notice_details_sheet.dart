import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/models/models.dart';

class NoticeDetailsSheet extends StatelessWidget {
  final AppNotice notice;

  const NoticeDetailsSheet({super.key, required this.notice});

  static void show(BuildContext context, AppNotice notice) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => NoticeDetailsSheet(notice: notice),
    );
  }

  Future<void> _openUrl(BuildContext context, String? urlString) async {
    if (urlString == null || urlString.trim().isEmpty) return;
    try {
      final uri = Uri.parse(urlString.trim());
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not open link.')),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error opening link: $e')),
        );
      }
    }
  }

  Color _getTypeColor(String type) {
    switch (type.toUpperCase().replaceAll(' ', '_')) {
      case 'JOB':
        return const Color(0xFF2563EB); // Royal Blue
      case 'ADMIT_CARD':
        return const Color(0xFFD97706); // Amber
      case 'RESULT':
        return const Color(0xFF16A34A); // Emerald Green
      case 'ANSWER_KEY':
        return const Color(0xFF9333EA); // Purple
      case 'EXAM_DATE':
        return const Color(0xFFEA580C); // Orange
      case 'NOTICE':
      default:
        return const Color(0xFF475569); // Slate
    }
  }

  String _formatDate(AppNotice n) {
    final d = n.publishAt ?? DateTime.tryParse(n.date);
    if (d != null) {
      return DateFormat('dd MMM yyyy, hh:mm a').format(d);
    }
    return n.date;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final typeColor = _getTypeColor(notice.type);
    final hasImage = notice.imageUrl != null && notice.imageUrl!.trim().isNotEmpty;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppDimens.radiusLarge)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: isDark ? Colors.white24 : Colors.black12,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header with close button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppDimens.space16, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: typeColor.withAlpha(25),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: typeColor.withAlpha(80), width: 0.8),
                      ),
                      child: Text(
                        notice.typeDisplayName,
                        style: TextStyle(
                          color: typeColor,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    if (notice.isNew) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.error,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'NEW',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Scrollable Content
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppDimens.space16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    notice.title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Metadata: Organization, Exam, Date
                  Row(
                    children: [
                      Icon(Icons.calendar_today_outlined,
                          size: 13,
                          color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                      const SizedBox(width: 4),
                      Text(
                        _formatDate(notice),
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                        ),
                      ),
                      if (notice.organization != null && notice.organization!.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Text('•', style: TextStyle(color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight)),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            notice.organization!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isDark ? const Color(0xFF93C5FD) : AppColors.actionBlue,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Image preview if present
                  if (hasImage) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
                      child: Image.network(
                        notice.imageUrl!.trim(),
                        fit: BoxFit.cover,
                        width: double.infinity,
                        loadingBuilder: (context, child, progress) {
                          if (progress == null) return child;
                          return Container(
                            height: 160,
                            color: Colors.black12,
                            child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                          );
                        },
                        errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Description / Content
                  Text(
                    notice.content != null && notice.content!.trim().isNotEmpty
                        ? notice.content!.trim()
                        : (notice.body.trim().isNotEmpty ? notice.body.trim() : notice.displayDescription),
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.55,
                      color: isDark ? AppColors.textDark : AppColors.textLight,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Action Buttons (Only render if valid non-empty URL exists)
                  if (_hasAnyActionUrls(notice)) ...[
                    const Text(
                      'Official Links & Actions',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 10),
                    _buildDynamicActionButtons(context, notice, typeColor),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDynamicActionButtons(BuildContext context, AppNotice n, Color typeColor) {
    final t = (n.type.isEmpty ? 'NOTICE' : n.type).toUpperCase().replaceAll(' ', '_');
    final buttons = <Widget>[];

    bool hasUrl(String? u) => u != null && u.trim().isNotEmpty;

    if (t == 'JOB') {
      if (hasUrl(n.applyUrl ?? n.primaryUrl)) {
        buttons.add(FilledButton.icon(
          onPressed: () => _openUrl(context, n.applyUrl ?? n.primaryUrl),
          icon: const Icon(Icons.open_in_browser, size: 16),
          label: const Text('Apply Online', style: TextStyle(fontWeight: FontWeight.w700)),
          style: FilledButton.styleFrom(backgroundColor: AppColors.actionBlue),
        ));
      }
      if (hasUrl(n.pdfUrl)) {
        buttons.add(OutlinedButton.icon(
          onPressed: () => _openUrl(context, n.pdfUrl),
          icon: const Icon(Icons.description_outlined, size: 16),
          label: const Text('View Notification', style: TextStyle(fontWeight: FontWeight.w600)),
        ));
      }
      if (hasUrl(n.officialUrl)) {
        buttons.add(OutlinedButton.icon(
          onPressed: () => _openUrl(context, n.officialUrl),
          icon: const Icon(Icons.language, size: 16),
          label: const Text('Official Website', style: TextStyle(fontWeight: FontWeight.w600)),
        ));
      }
      if (hasUrl(n.externalUrl)) {
        buttons.add(OutlinedButton.icon(
          onPressed: () => _openUrl(context, n.externalUrl),
          icon: const Icon(Icons.link, size: 16),
          label: const Text('External Link', style: TextStyle(fontWeight: FontWeight.w600)),
        ));
      }
    } else if (t == 'ADMIT_CARD') {
      final admitUrl = hasUrl(n.primaryUrl) ? n.primaryUrl : (hasUrl(n.applyUrl) ? n.applyUrl : n.pdfUrl);
      if (hasUrl(admitUrl)) {
        buttons.add(FilledButton.icon(
          onPressed: () => _openUrl(context, admitUrl),
          icon: const Icon(Icons.assignment_ind_outlined, size: 16),
          label: const Text('Download Admit Card', style: TextStyle(fontWeight: FontWeight.w700)),
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFD97706)),
        ));
      }
      if (hasUrl(n.officialUrl)) {
        buttons.add(OutlinedButton.icon(
          onPressed: () => _openUrl(context, n.officialUrl),
          icon: const Icon(Icons.language, size: 16),
          label: const Text('Official Website', style: TextStyle(fontWeight: FontWeight.w600)),
        ));
      }
      if (hasUrl(n.pdfUrl) && n.pdfUrl != admitUrl) {
        buttons.add(OutlinedButton.icon(
          onPressed: () => _openUrl(context, n.pdfUrl),
          icon: const Icon(Icons.description_outlined, size: 16),
          label: const Text('View Instructions', style: TextStyle(fontWeight: FontWeight.w600)),
        ));
      }
    } else if (t == 'RESULT') {
      final resultUrl = hasUrl(n.primaryUrl) ? n.primaryUrl : (hasUrl(n.pdfUrl) ? n.pdfUrl : n.applyUrl);
      if (hasUrl(resultUrl)) {
        buttons.add(FilledButton.icon(
          onPressed: () => _openUrl(context, resultUrl),
          icon: const Icon(Icons.military_tech_outlined, size: 16),
          label: const Text('View Result / Scorecard', style: TextStyle(fontWeight: FontWeight.w700)),
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFF16A34A)),
        ));
      }
      if (hasUrl(n.officialUrl)) {
        buttons.add(OutlinedButton.icon(
          onPressed: () => _openUrl(context, n.officialUrl),
          icon: const Icon(Icons.language, size: 16),
          label: const Text('Official Website', style: TextStyle(fontWeight: FontWeight.w600)),
        ));
      }
    } else if (t == 'ANSWER_KEY') {
      final keyUrl = hasUrl(n.primaryUrl) ? n.primaryUrl : (hasUrl(n.pdfUrl) ? n.pdfUrl : n.applyUrl);
      if (hasUrl(keyUrl)) {
        buttons.add(FilledButton.icon(
          onPressed: () => _openUrl(context, keyUrl),
          icon: const Icon(Icons.fact_check_outlined, size: 16),
          label: const Text('View Answer Key', style: TextStyle(fontWeight: FontWeight.w700)),
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFF9333EA)),
        ));
      }
      if (hasUrl(n.officialUrl)) {
        buttons.add(OutlinedButton.icon(
          onPressed: () => _openUrl(context, n.officialUrl),
          icon: const Icon(Icons.language, size: 16),
          label: const Text('Official Website', style: TextStyle(fontWeight: FontWeight.w600)),
        ));
      }
    } else if (t == 'EXAM_DATE') {
      final noticeUrl = hasUrl(n.pdfUrl) ? n.pdfUrl : (hasUrl(n.primaryUrl) ? n.primaryUrl : n.officialUrl);
      if (hasUrl(noticeUrl)) {
        buttons.add(FilledButton.icon(
          onPressed: () => _openUrl(context, noticeUrl),
          icon: const Icon(Icons.event_note, size: 16),
          label: const Text('View Official Notice', style: TextStyle(fontWeight: FontWeight.w700)),
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFEA580C)),
        ));
      }
      if (hasUrl(n.officialUrl) && n.officialUrl != noticeUrl) {
        buttons.add(OutlinedButton.icon(
          onPressed: () => _openUrl(context, n.officialUrl),
          icon: const Icon(Icons.language, size: 16),
          label: const Text('Official Website', style: TextStyle(fontWeight: FontWeight.w600)),
        ));
      }
    } else {
      // NOTICE / DEFAULT
      if (hasUrl(n.pdfUrl)) {
        buttons.add(FilledButton.icon(
          onPressed: () => _openUrl(context, n.pdfUrl),
          icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
          label: const Text('View PDF', style: TextStyle(fontWeight: FontWeight.w700)),
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFF475569)),
        ));
      }
      final openUrl = hasUrl(n.externalUrl) ? n.externalUrl : (hasUrl(n.primaryUrl) ? n.primaryUrl : n.officialUrl);
      if (hasUrl(openUrl)) {
        buttons.add(OutlinedButton.icon(
          onPressed: () => _openUrl(context, openUrl),
          icon: const Icon(Icons.open_in_browser, size: 16),
          label: const Text('Open Link', style: TextStyle(fontWeight: FontWeight.w600)),
        ));
      }
      if (hasUrl(n.officialUrl) && n.officialUrl != openUrl) {
        buttons.add(OutlinedButton.icon(
          onPressed: () => _openUrl(context, n.officialUrl),
          icon: const Icon(Icons.language, size: 16),
          label: const Text('Official Website', style: TextStyle(fontWeight: FontWeight.w600)),
        ));
      }
    }

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: buttons,
    );
  }

  bool _hasAnyActionUrls(AppNotice n) {
    bool has(String? u) => u != null && u.trim().isNotEmpty;
    return has(n.applyUrl) ||
        has(n.primaryUrl) ||
        has(n.officialUrl) ||
        has(n.pdfUrl) ||
        has(n.externalUrl);
  }
}
