-dontoptimize

# Flutter rules
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Firebase & Google Play Services
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# AndroidX & Multidex
-keep class androidx.multidex.** { *; }
-keep class androidx.annotation.** { *; }

# AndroidX Startup
-keep class androidx.startup.** { *; }
-keepnames class * extends androidx.startup.Initializer

# AndroidX WorkManager & Room (Fixes WorkDatabase reflection crash)
-keep class androidx.work.** { *; }
-keep class androidx.work.impl.** { *; }
-dontwarn androidx.work.**
-dontwarn androidx.work.impl.**

-keep class androidx.room.** { *; }
-keep class * extends androidx.room.RoomDatabase { *; }
-keepclassmembers class * extends androidx.room.RoomDatabase {
    public <init>();
}
-keep class androidx.work.impl.WorkDatabase_Impl {
    public <init>();
}
-dontwarn androidx.room.**

# Android SQLite & Framework
-keep class androidx.sqlite.** { *; }
-dontwarn androidx.sqlite.**

# Google Mobile Ads
-keep class com.google.android.gms.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

# Play Core & SplitCompat (Flutter Deferred Components)
-dontwarn com.google.android.play.core.**
-keep class com.google.android.play.core.** { *; }

# Keep App Activity
-keep class com.notifyjobs.andamanquiz.MainActivity { *; }
