import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:loomapos_mobile/app/mobile_app.dart";

void main() {
  runApp(const ProviderScope(child: MobileApp()));
}
