import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";
import "package:loomapos_mobile/data/mobile_api_client.dart";
import "package:loomapos_mobile/data/mobile_api_contracts.dart";
import "package:loomapos_mobile/data/mobile_repository.dart";
import "package:loomapos_mobile/models/mobile_models.dart";
import "package:loomapos_mobile/screens/home_shell.dart";
import "package:loomapos_mobile/store/local_store.dart";

void main() {
  group("mobile lifecycle matrix proof", () {
    test("canonical states resolve to consistent lifecycle guidance", () {
      final now = DateTime.now().toUtc();
      final diagnostics = SyncDiagnostics.initial.copyWith(online: true);

      final cases = <({
        String status,
        String planCode,
        DateTime? expiresAt,
        TenantLifecycleState expected,
      })>[
        (
          status: "trial_active",
          planCode: "trial",
          expiresAt: now.add(const Duration(days: 10)),
          expected: TenantLifecycleState.trialActive,
        ),
        (
          status: "trial_expiring",
          planCode: "trial",
          expiresAt: now.add(const Duration(days: 2)),
          expected: TenantLifecycleState.trialExpiring,
        ),
        (
          status: "trial_expired",
          planCode: "trial",
          expiresAt: now.subtract(const Duration(days: 1)),
          expected: TenantLifecycleState.trialExpired,
        ),
        (
          status: "subscription_active",
          planCode: "growth",
          expiresAt: now.add(const Duration(days: 30)),
          expected: TenantLifecycleState.subscriptionActive,
        ),
        (
          status: "subscription_past_due",
          planCode: "growth",
          expiresAt: now.add(const Duration(days: 30)),
          expected: TenantLifecycleState.subscriptionPastDue,
        ),
        (
          status: "subscription_canceled",
          planCode: "growth",
          expiresAt: now.add(const Duration(days: 30)),
          expected: TenantLifecycleState.subscriptionCanceled,
        ),
        (
          status: "suspended_blocked",
          planCode: "growth",
          expiresAt: now.add(const Duration(days: 30)),
          expected: TenantLifecycleState.suspendedBlocked,
        ),
      ];

      for (final row in cases) {
        final appState = _buildAppState(
          status: row.status,
          planCode: row.planCode,
          licenseExpiresAt: row.expiresAt,
        );

        final resolved = resolveTenantLifecycle(appState, diagnostics);
        expect(resolved.state, row.expected, reason: "state=${row.status}");
      }
    });

    test("write actions are blocked for trial_expired and suspended_blocked", () async {
      final blockedStates = ["trial_expired", "suspended_blocked"];

      for (final status in blockedStates) {
        final store = await LocalStore.open(inMemory: true);
        await store.init();
        await store.seedDemoData();
        await _seedAuth(
          store,
          status: status,
          planCode: status.startsWith("trial") ? "trial" : "growth",
          licenseExpiresAt: status == "trial_expired"
              ? DateTime.now().toUtc().subtract(const Duration(days: 1))
              : DateTime.now().toUtc().add(const Duration(days: 30)),
        );
        await store.saveSyncDiagnostics(
          SyncDiagnostics.initial.copyWith(online: true),
        );

        final repository = MobileRepository(
          store: store,
          api: _LifecycleProofApiClient(),
        );

        await expectLater(
          () => repository.createStockCountSession(
            label: "Lifecycle proof",
            countType: "full",
          ),
          throwsA(
            isA<ApiException>()
                .having((error) => error.kind, "kind", ApiErrorKind.forbidden)
                .having((error) => error.statusCode, "status", 403),
          ),
        );

        await store.close();
      }
    });

    test("write actions remain allowed for non-blocked lifecycle states", () async {
      final allowedStates = [
        ("trial_active", "trial", DateTime.now().toUtc().add(const Duration(days: 10))),
        ("trial_expiring", "trial", DateTime.now().toUtc().add(const Duration(days: 2))),
        ("subscription_active", "growth", DateTime.now().toUtc().add(const Duration(days: 30))),
        ("subscription_past_due", "growth", DateTime.now().toUtc().add(const Duration(days: 30))),
        ("subscription_canceled", "growth", DateTime.now().toUtc().add(const Duration(days: 30))),
      ];

      for (final row in allowedStates) {
        final store = await LocalStore.open(inMemory: true);
        await store.init();
        await store.seedDemoData();
        await _seedAuth(
          store,
          status: row.$1,
          planCode: row.$2,
          licenseExpiresAt: row.$3,
        );
        await store.saveSyncDiagnostics(
          SyncDiagnostics.initial.copyWith(online: true),
        );

        final repository = MobileRepository(
          store: store,
          api: _LifecycleProofApiClient(),
        );

        final session = await repository.createStockCountSession(
          label: "Lifecycle allowed",
          countType: "full",
        );
        final product = (await repository.searchProducts(query: "su")).first;
        await repository.addProductToCount(
          sessionId: session.id,
          product: product,
          countedQty: 1,
        );

        await repository.submitStockCount(session.id);

        await store.close();
      }
    });
  });
}

AppShellState _buildAppState({
  required String status,
  required String planCode,
  required DateTime? licenseExpiresAt,
}) {
  final now = DateTime.now().toUtc();
  return AppShellState(
    mode: AppRuntimeMode.ready,
    busy: false,
    message: null,
    session: null,
    activation: LocalActivation(
      activationId: "activation-1",
      tenantId: "tenant-1",
      userId: "user-1",
      deviceId: "device-1",
      licenseId: "license-1",
      planCode: planCode,
      status: status,
      activationToken: "activation-token",
      featureFlags: const ["mobile"],
      permissionActions: const ["stock_count.submit"],
      allowedBranchIds: const [_demoBranchId],
      lastValidationAt: now,
      offlineGraceUntil: now.add(const Duration(days: 7)),
      selectedBranchId: _demoBranchId,
      companyName: "Demo Tenant",
      licenseExpiresAt: licenseExpiresAt,
    ),
    permissions: const PermissionSnapshot(
      roleCode: "tenant_owner",
      actions: {"stock_count.submit"},
      allowedBranchIds: {_demoBranchId},
    ),
    branches: const [],
    selectedBranchId: _demoBranchId,
    syncDiagnostics: SyncDiagnostics.initial.copyWith(online: true),
  );
}

class _LifecycleProofApiClient extends MobileApiClient {
  _LifecycleProofApiClient()
      : super(
          client: MockClient(
            (request) async => http.Response("{}", 200),
          ),
        );

  @override
  Future<PushOutboxResponse> pushOutbox({
    required String accessToken,
    required String tenantId,
    required String branchId,
    required String deviceId,
    required List<LocalOutboxEvent> events,
  }) async {
    return PushOutboxResponse(
      results: events
          .map(
            (event) => PushOutboxResult(
              eventId: event.id,
              status: "accepted",
              message: null,
              errorCode: null,
            ),
          )
          .toList(),
    );
  }

  @override
  Future<HeartbeatResponse> heartbeat({required String deviceId}) async {
    return const HeartbeatResponse(
      licenseStatus: "active",
      expiresAt: null,
      lifecycleState: "subscription_active",
      canCheckout: true,
      canWrite: true,
      canSync: true,
      canView: true,
      requiresUpgradeAction: false,
      requiresBlock: false,
      allowedActions: <String>["Desktop satis", "Mobil operasyon"],
      blockedActions: <String>["-"],
    );
  }

  @override
  Future<PullSyncResponse> pullSync({
    required String accessToken,
    required String tenantId,
    required String deviceId,
    String? branchId,
    DateTime? since,
  }) async {
    return const PullSyncResponse(payload: {});
  }
}

const _demoBranchId = "00000000-0000-0000-0000-000000000001";

Future<void> _seedAuth(
  LocalStore store, {
  required String status,
  required String planCode,
  required DateTime? licenseExpiresAt,
}) async {
  final now = DateTime.now().toUtc();
  await store.replaceBranches(
    [
      LocalBranch(
        id: _demoBranchId,
        name: "Merkez Sube",
        isAssigned: true,
        isSelected: true,
        settingsJson: "{}",
        updatedAt: now,
      ),
    ],
    selectedBranchId: _demoBranchId,
  );

  await store.saveSession(
    LocalSession(
      sessionId: "session-1",
      userId: "user-1",
      email: "owner@example.com",
      fullName: "Owner",
      tenantId: "tenant-1",
      roleCode: "tenant_owner",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: now.add(const Duration(hours: 12)),
      lastLoginAt: now,
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
      planCode: planCode,
      status: status,
      activationToken: "activation-token",
      featureFlags: const ["mobile"],
      permissionActions: const [
        "dashboard.view",
        "reports.summary.view",
        "product.lookup",
        "stock_count.create",
        "stock_count.submit",
      ],
      allowedBranchIds: const [_demoBranchId],
      lastValidationAt: now,
      offlineGraceUntil: now.add(const Duration(days: 7)),
      selectedBranchId: _demoBranchId,
      companyName: "Demo Tenant",
      licenseExpiresAt: licenseExpiresAt,
    ),
  );

  await store.replacePermissions(
    const PermissionSnapshot(
      roleCode: "tenant_owner",
      actions: {
        "dashboard.view",
        "reports.summary.view",
        "product.lookup",
        "stock_count.create",
        "stock_count.submit",
      },
      allowedBranchIds: {_demoBranchId},
    ),
  );
}
