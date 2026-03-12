import "package:flutter/material.dart";
import "package:loomapos_mobile/core/mobile_constants.dart";
import "package:loomapos_mobile/screens/root_gate.dart";

class MobileApp extends StatelessWidget {
  const MobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    final base = ColorScheme.fromSeed(
      seedColor: MobileColors.primary,
      brightness: Brightness.light,
    );

    return MaterialApp(
      title: "LoomaPOS Mobile",
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: MobileColors.background,
        colorScheme: base.copyWith(
          primary: MobileColors.primary,
          secondary: MobileColors.success,
          tertiary: MobileColors.warning,
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
      home: const RootGate(),
    );
  }
}
