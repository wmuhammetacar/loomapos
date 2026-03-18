import "package:flutter/material.dart";
import "package:loomapos_mobile/core/mobile_constants.dart";
import "package:loomapos_mobile/screens/root_gate.dart";

class MobileApp extends StatelessWidget {
  const MobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    final lightBase = ColorScheme.fromSeed(
      seedColor: MobileColors.primary,
      brightness: Brightness.light,
    );

    final darkBase = ColorScheme.fromSeed(
      seedColor: MobileDarkColors.primary,
      brightness: Brightness.dark,
    );

    return MaterialApp(
      title: "LoomaPOS Mobile",
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.system,
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: "Manrope",
        scaffoldBackgroundColor: MobileColors.background,
        colorScheme: lightBase.copyWith(
          primary: MobileColors.primary,
          secondary: MobileColors.secondary,
          tertiary: MobileColors.accent,
          error: MobileColors.danger,
          surface: MobileColors.surface,
          onSurface: MobileColors.text,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: MobileColors.surface,
          foregroundColor: MobileColors.text,
          centerTitle: false,
          elevation: 0,
        ),
        cardTheme: CardThemeData(
          color: MobileColors.surface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: MobileColors.border),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: MobileColors.surface,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: MobileColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: MobileColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: MobileColors.primary, width: 1.5),
          ),
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        fontFamily: "Manrope",
        scaffoldBackgroundColor: MobileDarkColors.background,
        colorScheme: darkBase.copyWith(
          primary: MobileDarkColors.primary,
          secondary: MobileDarkColors.secondary,
          tertiary: MobileDarkColors.accent,
          error: MobileDarkColors.danger,
          surface: MobileDarkColors.surface,
          onSurface: MobileDarkColors.text,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: MobileDarkColors.surface,
          foregroundColor: MobileDarkColors.text,
          centerTitle: false,
          elevation: 0,
        ),
        cardTheme: CardThemeData(
          color: MobileDarkColors.surface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: MobileDarkColors.border),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: MobileDarkColors.surface,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: MobileDarkColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: MobileDarkColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: MobileDarkColors.primary, width: 1.5),
          ),
        ),
      ),
      home: const RootGate(),
    );
  }
}
