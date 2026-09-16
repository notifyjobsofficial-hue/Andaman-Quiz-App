import 'package:flutter/material.dart';

class AppDimens {
  // Border Radii
  static const double radiusSmall = 8.0;
  static const double radiusMedium = 12.0;
  static const double radiusCard = 18.0; // 16-20px cards
  static const double radiusLarge = 24.0;
  static const double radiusPill = 999.0;

  static BorderRadius get cardBorderRadius => BorderRadius.circular(radiusCard);
  static BorderRadius get pillBorderRadius => BorderRadius.circular(radiusPill);
  static BorderRadius get smallBorderRadius => BorderRadius.circular(radiusSmall);
  static BorderRadius get mediumBorderRadius => BorderRadius.circular(radiusMedium);

  // Spacing
  static const double space4 = 4.0;
  static const double space8 = 8.0;
  static const double space12 = 12.0;
  static const double space16 = 16.0;
  static const double space20 = 20.0;
  static const double space24 = 24.0;
  static const double space32 = 32.0;
  static const double space40 = 40.0;

  // Minimum Touch Targets (at least 48dp)
  static const double minTouchTarget = 48.0;
  static const double minButtonHeight = 52.0;
  static const double mcqOptionMinHeight = 56.0;

  // Elevation
  static const double elevationSubtle = 1.0;
  static const double elevationCard = 0.0; // Flat modern with border
}
