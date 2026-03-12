import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:loomapos_mobile/models/mobile_models.dart";
import "package:loomapos_mobile/providers/mobile_providers.dart";
import "package:loomapos_mobile/screens/home_shell.dart";
import "package:loomapos_mobile/store/local_store.dart";

void main() {
  testWidgets("renders LoomaPOS mobile operational shell", (tester) async {
    final store = await LocalStore.open(inMemory: true);
    await store.init();
    await store.seedDemoData();
    await store.saveDashboardSummary(
      const DashboardSummary(
        todaySales: 12500,
        transactionCount: 42,
        averageBasket: 297.5,
        refundTotal: 320,
        lowStockAlerts: [
          LowStockAlert(
            productId: "p1",
            productName: "Su 0.5L",
            qty: 2,
            minStock: 6,
            branchName: "Merkez Sube",
          ),
        ],
        topProducts: [
          TopProductSummary(
            productId: "p1",
            productName: "Su 0.5L",
            quantity: 18,
            revenue: 180,
          ),
        ],
        paymentMethodSummary: {"cash": 6000, "card": 6500},
        lastUpdatedAt: null,
      ),
    );

    await store.saveSession(
      LocalSession(
        sessionId: "session-1",
        userId: "user-1",
        email: "owner@example.com",
        fullName: "Demo Owner",
        tenantId: "tenant-1",
        roleCode: "tenant_owner",
        accessToken: "access",
        refreshToken: "refresh",
        expiresAt: DateTime.now().toUtc().add(const Duration(hours: 8)),
        lastLoginAt: DateTime.now().toUtc(),
        status: "active",
      ),
    );
    await store.saveActivation(
      LocalActivation(
        activationId: "activation-1",
        tenantId: "tenant-1",
        userId: "user-1",
        deviceId: "device-1",
        licenseId: "license-1",
        planCode: "pro",
        status: "active",
        activationToken: "token",
        featureFlags: const ["mobile"],
        permissionActions: const [
          "dashboard.view",
          "product.lookup",
          "product.create",
          "stock_count.create",
          "stock_count.submit",
        ],
        allowedBranchIds: const ["00000000-0000-0000-0000-000000000001"],
        lastValidationAt: DateTime.now().toUtc(),
        offlineGraceUntil: DateTime.now().toUtc().add(const Duration(days: 7)),
        selectedBranchId: "00000000-0000-0000-0000-000000000001",
        companyName: "Demo Tenant",
        licenseExpiresAt: DateTime.now().toUtc().add(const Duration(days: 30)),
      ),
    );
    await store.replacePermissions(
      const PermissionSnapshot(
        roleCode: "tenant_owner",
        actions: {
          "dashboard.view",
          "product.lookup",
          "product.create",
          "stock_count.create",
          "stock_count.submit",
        },
        allowedBranchIds: {"00000000-0000-0000-0000-000000000001"},
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          localStoreProvider.overrideWith((ref) async => store),
        ],
        child: const MaterialApp(home: HomeShell()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Dashboard"), findsWidgets);
    expect(find.text("Urunler"), findsOneWidget);
    expect(find.text("Stok Sayim"), findsOneWidget);
    expect(find.text("Aktivite"), findsOneWidget);
    expect(find.text("Ayarlar"), findsOneWidget);
  });
}
