import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/widgets/app_card.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currentTheme = ref.watch(themeModeProvider);
    final currentLang = ref.watch(selectedLanguageProvider);
    final soundHaptics = ref.watch(soundHapticsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('More & Settings', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppDimens.space16),
          children: [
            // Appearance Section
            _SectionHeader(title: 'Appearance'),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.brightness_6_outlined, color: AppColors.actionBlue),
                    title: const Text('Theme Mode', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(_getThemeName(currentTheme)),
                    trailing: DropdownButton<ThemeMode>(
                      value: currentTheme,
                      underline: const SizedBox(),
                      items: const [
                        DropdownMenuItem(value: ThemeMode.system, child: Text('System')),
                        DropdownMenuItem(value: ThemeMode.light, child: Text('Light')),
                        DropdownMenuItem(value: ThemeMode.dark, child: Text('Dark')),
                      ],
                      onChanged: (mode) {
                        if (mode != null) {
                          ref.read(themeModeProvider.notifier).setThemeMode(mode);
                        }
                      },
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Preferences Section
            _SectionHeader(title: 'Preferences'),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.language_outlined, color: AppColors.actionBlue),
                    title: const Text('Study Language', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(currentLang == 'hi' ? 'हिन्दी (Hindi)' : 'English'),
                    trailing: DropdownButton<String>(
                      value: currentLang,
                      underline: const SizedBox(),
                      items: const [
                        DropdownMenuItem(value: 'en', child: Text('English')),
                        DropdownMenuItem(value: 'hi', child: Text('हिन्दी')),
                      ],
                      onChanged: (lang) {
                        if (lang != null) {
                          ref.read(selectedLanguageProvider.notifier).setLanguage(lang);
                        }
                      },
                    ),
                  ),
                  const Divider(),
                  SwitchListTile(
                    secondary: const Icon(Icons.volume_up_outlined, color: AppColors.actionBlue),
                    title: const Text('Sound & Haptic Feedback', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: const Text('Audio cues and vibration on answer selection'),
                    value: soundHaptics,
                    activeThumbColor: AppColors.actionBlue,
                    onChanged: (val) {
                      ref.read(soundHapticsProvider.notifier).toggle(val);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Support Section
            _SectionHeader(title: 'Support & Community'),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.share_outlined, color: AppColors.actionBlue),
                    title: const Text('Share App with Aspirants', style: TextStyle(fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Sharing Andaman Quiz: Practice. Prepare. Crack A&N Exams!')),
                      );
                    },
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.star_outline, color: AppColors.actionBlue),
                    title: const Text('Rate on Google Play', style: TextStyle(fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Thank you for rating 5 stars!')),
                      );
                    },
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.feedback_outlined, color: AppColors.actionBlue),
                    title: const Text('Send Feedback & Question Report', style: TextStyle(fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () {
                      _showFeedbackDialog(context);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Information Section
            _SectionHeader(title: 'Information & Legal'),
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.update_outlined, color: AppColors.actionBlue),
                    title: const Text('Latest Examination Updates', style: TextStyle(fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () => _showUpdateDialog(context),
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.privacy_tip_outlined, color: AppColors.actionBlue),
                    title: const Text('Privacy Policy', style: TextStyle(fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () => _showLegalDialog(context, 'Privacy Policy', 'Andaman Quiz collects zero personal information, requires no login or signup, and stores your learning progress directly on your local device storage.'),
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.description_outlined, color: AppColors.actionBlue),
                    title: const Text('Terms of Service', style: TextStyle(fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () => _showLegalDialog(context, 'Terms of Service', 'All mock tests and questions are prepared for educational and competitive examination practice purposes across Andaman & Nicobar recruitment exams.'),
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.info_outline, color: AppColors.actionBlue),
                    title: const Text('About Andaman Quiz', style: TextStyle(fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () => _showAboutDialog(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Version Footer
            Center(
              child: Column(
                children: [
                  const Text(
                    'Andaman Quiz',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Practice. Prepare. Crack A&N Exams.',
                    style: TextStyle(fontSize: 12, color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Version 1.0.0 (2026 Production Build)',
                    style: TextStyle(fontSize: 11, color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  String _getThemeName(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.system:
        return 'Match system appearance';
      case ThemeMode.light:
        return 'Light appearance';
      case ThemeMode.dark:
        return 'Dark appearance';
    }
  }

  void _showFeedbackDialog(BuildContext context) {
    final textCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Send Feedback'),
        content: TextField(
          controller: textCtrl,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Enter your suggestions or report question errors...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Feedback submitted. Thank you!')),
              );
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  void _showUpdateDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Latest Examination Updates'),
        content: const Text(
          '• A&N Police Constable Recruitment Notification 2026 expected shortly.\n\n• SSC CGL 2026 Tier-I calendar released.\n\n• New Andaman & Nicobar GK questions on 10 Degree Channel and Island Wildlife added.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }

  void _showLegalDialog(BuildContext context, String title, String body) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('About Andaman Quiz'),
        content: const Text(
          'Andaman Quiz is an EdTech platform engineered specifically for students and aspirants preparing for Andaman & Nicobar Administration, Police, SSC CGL, CHSL, and MTS examinations.\n\nBuilt with an offline-first architecture, authentic island GK, and realistic SSC CBT exam simulation.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.actionBlue),
      ),
    );
  }
}
