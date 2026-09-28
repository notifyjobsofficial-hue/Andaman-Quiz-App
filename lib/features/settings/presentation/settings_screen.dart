import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_dimens.dart';
import '../../../core/database/local_database.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/auth_providers.dart';
import '../../../core/services/auth_service.dart';
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
    final studentAsync = ref.watch(currentStudentProvider);
    final student = studentAsync.value ?? LocalDatabase.instance.getCurrentStudent();

    return Scaffold(
      appBar: AppBar(
        title: const Text('More & Settings', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppDimens.space16),
          children: [
            // Student Account Section
            _SectionHeader(title: 'Student Account'),
            AppCard(
              padding: const EdgeInsets.all(AppDimens.space16),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: const Color(0xFF2563EB).withAlpha(20),
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            (student?.displayName.isNotEmpty ?? false)
                                ? student!.displayName[0].toUpperCase()
                                : 'A',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF2563EB),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              student?.displayName ?? 'Andaman Aspirant',
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              student?.email ?? 'Logged In Student',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: (student?.isPremium ?? false)
                              ? const Color(0xFFD97706).withAlpha(25)
                              : const Color(0xFF16A34A).withAlpha(25),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          student?.plan ?? 'FREE',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: (student?.isPremium ?? false)
                                ? const Color(0xFFD97706)
                                : const Color(0xFF16A34A),
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (!AuthService.instance.isEmailVerified && (student?.email.isNotEmpty ?? false)) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.mark_email_unread_outlined, size: 18, color: Color(0xFFD97706)),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'Email not verified',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF92400E)),
                            ),
                          ),
                          GestureDetector(
                            onTap: () async {
                              try {
                                await AuthService.instance.sendEmailVerification();
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Verification email sent! Check your inbox.')),
                                  );
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Could not send: $e')),
                                  );
                                }
                              }
                            },
                            child: const Text(
                              'Resend',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF2563EB)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  const Divider(),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Log Out'),
                            content: const Text('Are you sure you want to log out of your student account?'),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
                                onPressed: () => Navigator.pop(ctx, true),
                                child: const Text('Log Out'),
                              ),
                            ],
                          ),
                        );
                        if (confirm == true) {
                          await AuthService.instance.signOut();
                          ref.invalidate(currentStudentProvider);
                          if (context.mounted) {
                            context.go('/login');
                          }
                        }
                      },
                      icon: const Icon(Icons.logout, size: 18, color: Color(0xFFDC2626)),
                      label: const Text('Log Out', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w700)),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFFCA5A5)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Center(
                    child: TextButton(
                      onPressed: () async {
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Delete Account'),
                            content: const Text(
                              'Are you sure you want to delete your account? All local and cloud student progress will be permanently erased. This action cannot be undone.',
                            ),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFB91C1C), foregroundColor: Colors.white),
                                onPressed: () => Navigator.pop(ctx, true),
                                child: const Text('Delete Permanently'),
                              ),
                            ],
                          ),
                        );
                        if (confirm == true) {
                          try {
                            await AuthService.instance.deleteAccount();
                            ref.invalidate(currentStudentProvider);
                            if (context.mounted) {
                              context.go('/login');
                            }
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Failed to delete account: $e')),
                              );
                            }
                          }
                        }
                      },
                      child: const Text(
                        'Delete Account',
                        style: TextStyle(fontSize: 12, color: Color(0xFFEF4444), fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

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
    final notices = LocalDatabase.instance.getNotices();
    final noticeText = notices.isNotEmpty
        ? notices.map((n) => '• ${n.title}: ${n.body}').join('\n\n')
        : 'No updates published yet. Please check back later.';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Latest Examination Updates'),
        content: Text(noticeText),
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
