import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:loomapos_mobile/core/mobile_constants.dart";
import "package:loomapos_mobile/models/mobile_models.dart";
import "package:loomapos_mobile/providers/mobile_providers.dart";
import "package:loomapos_mobile/screens/home_shell.dart";

class RootGate extends ConsumerWidget {
  const RootGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appState = ref.watch(appControllerProvider);

    if (appState.mode == AppRuntimeMode.booting || appState.busy) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (appState.mode == AppRuntimeMode.ready) {
      return const HomeShell();
    }

    return AuthActivationScreen(
      title: appState.mode == AppRuntimeMode.locked
          ? "Mobil erisim kilitlendi"
          : "LoomaPOS Mobile",
      message: appState.message,
    );
  }
}

class AuthActivationScreen extends ConsumerStatefulWidget {
  const AuthActivationScreen({
    required this.title,
    required this.message,
    super.key,
  });

  final String title;
  final String? message;

  @override
  ConsumerState<AuthActivationScreen> createState() => _AuthActivationScreenState();
}

class _AuthActivationScreenState extends ConsumerState<AuthActivationScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = ref.watch(appControllerProvider);
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: MobileColors.primary,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "LoomaPOS Mobile",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    "Branch-aware field operations, stock count workflows, barcode lookup ve offline-first cache ayni operational runtime icinde toplanir.",
                    style: TextStyle(color: Colors.white, height: 1.45),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Text(
              widget.title,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              widget.message ??
                  "Tenant lisansi ve cihaz kaydi dogrulandiginda mobile companion operational moda gecer. Offline re-open icin daha once aktive edilmis cihaz gerekir.",
              style: const TextStyle(color: MobileColors.muted),
            ),
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: "E-posta"),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: "Sifre"),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: appState.busy
                            ? null
                            : () => ref.read(appControllerProvider.notifier).signInAndActivate(
                                  email: _emailController.text,
                                  password: _passwordController.text,
                                ),
                        child: Text(appState.busy ? "Baglaniyor..." : "Giris yap ve aktive et"),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Bu mobil istemci neleri yapar?", style: TextStyle(fontWeight: FontWeight.w700)),
                    SizedBox(height: 8),
                    Text("- Barkod tarama ve urun arama"),
                    Text("- Branch-aware stok sayim draft ve submit"),
                    Text("- Rol bazli urun ekleme / duzenleme"),
                    Text("- Dashboard ve recent activity ozetleri"),
                    Text("- Local outbox ve retry-safe mobile sync"),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}