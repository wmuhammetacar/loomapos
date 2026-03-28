import "dart:async";

import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";
import "package:loomapos_mobile/core/barcode_scan_guard.dart";
import "package:loomapos_mobile/core/read_freshness.dart";
import "package:loomapos_mobile/core/operation_error_mapper.dart";
import "package:loomapos_mobile/data/mobile_api_client.dart";
import "package:loomapos_mobile/data/mobile_api_contracts.dart";
import "package:loomapos_mobile/data/mobile_repository.dart";
import "package:loomapos_mobile/models/mobile_models.dart";
import "package:loomapos_mobile/providers/mobile_providers.dart";
import "package:loomapos_mobile/store/local_store.dart";

void main() {
  group("mobile hardening patch", () {
    test("auth token restore / logout clear", () async {
      final store = await LocalStore.open(inMemory: true);
      await store.init();
      await store.seedDemoData();
      await _seedAuth(store);

      final repository = MobileRepository(
        store: store,
        api: _IdleApiClient(),
      );

      final readyState = await repository.bootstrap();
      expect(readyState.mode, AppRuntimeMode.ready);

      await repository.logout();
      expect(await store.getActiveSession(), isNull);

      final loggedOut = await repository.bootstrap();
      expect(loggedOut.mode, AppRuntimeMode.needsLogin);

      await store.close();
    });

    test("product search success + empty + error state", () async {
      final store = await LocalStore.open(inMemory: true);
      await store.init();
      await store.seedDemoData();

      final repository = MobileRepository(
        store: store,
        api: _IdleApiClient(),
      );

      final success = await repository.searchProducts(query: "su");
      expect(success, isNotEmpty);

      final empty = await repository.searchProducts(query: "olmayan-urun");
      expect(empty, isEmpty);

      final throwingRepository = _ThrowingSearchRepository(
        store: store,
        api: _IdleApiClient(),
      );

      final container = ProviderContainer(
        overrides: [
          repositoryProvider.overrideWith((ref) async => throwingRepository),
        ],
      );
      addTearDown(container.dispose);

      expect(
        () => container.read(productSearchProvider("test").future),
        throwsA(isA<StateError>()),
      );

      await store.close();
    });

    test("barcode duplicate suppression", () {
      final guard = BarcodeScanGuard(
        debounceWindow: const Duration(milliseconds: 300),
        duplicateSuppressionWindow: const Duration(seconds: 2),
      );

      final t0 = DateTime(2026, 3, 24, 12, 0, 0);
      expect(guard.shouldHandle("869000000001", now: t0), isTrue);
      expect(
        guard.shouldHandle(
          "869000000001",
          now: t0.add(const Duration(milliseconds: 120)),
        ),
        isFalse,
      );
      expect(
        guard.shouldHandle(
          "869000000001",
          now: t0.add(const Duration(seconds: 1)),
        ),
        isFalse,
      );
      expect(
        guard.shouldHandle(
          "869000000001",
          now: t0.add(const Duration(seconds: 3)),
        ),
        isTrue,
      );
    });

    test("stale indicator shown when cached fallback is used", () {
      final now = DateTime.utc(2026, 3, 24, 12, 0, 0);
      final cachedRead = CachedRead<DashboardSummary>(
        data: DashboardSummary.empty,
        isStale: true,
        source: "cache",
        cachedAt: now.subtract(const Duration(minutes: 5)),
      );
      final staleRead = CachedRead<DashboardSummary>(
        data: DashboardSummary.empty,
        isStale: true,
        source: "cache",
        cachedAt: now.subtract(const Duration(minutes: 40)),
      );

      final cachedState = resolveReadFreshness(cachedRead, now: now);
      final staleState = resolveReadFreshness(staleRead, now: now);

      expect(cachedState, ReadFreshnessState.cached);
      expect(freshnessLabel(cachedState), "Onbellek");
      expect(staleState, ReadFreshnessState.stale);
      expect(freshnessLabel(staleState), "Eski");
    });

    test("last updated displayed correctly", () {
      final now = DateTime.utc(2026, 3, 24, 12, 0, 0);

      expect(
          lastUpdatedLabel(now.subtract(const Duration(seconds: 20)), now: now),
          "Az once");
      expect(
          lastUpdatedLabel(now.subtract(const Duration(minutes: 12)), now: now),
          "12 dk once");
      expect(lastUpdatedLabel(now.subtract(const Duration(hours: 3)), now: now),
          "3 sa once");
    });


    test("timeout message mapping", () {
      final view = mapOperationalError(
        const ApiException(
          statusCode: null,
          kind: ApiErrorKind.timeout,
          message: "timeout",
        ),
        isMutation: false,
        cachedDataVisible: true,
      );

      expect(view.requiresReauth, isFalse);
      expect(view.message.toLowerCase(), contains("zaman"));
      expect(view.message.toLowerCase(), contains("onbellek"));
    });

    test("no-network message mapping", () {
      final view = mapOperationalError(
        const ApiException(
          statusCode: null,
          kind: ApiErrorKind.network,
          message: "network",
        ),
        isMutation: false,
        cachedDataVisible: true,
      );

      expect(view.requiresReauth, isFalse);
      expect(view.message.toLowerCase(), contains("baglanti"));
      expect(view.message.toLowerCase(), contains("onbellek"));
    });

    test("403 message mapping", () {
      final view = mapOperationalError(
        const ApiException(
          statusCode: 403,
          kind: ApiErrorKind.forbidden,
          message: "forbidden",
        ),
        isMutation: false,
      );

      expect(view.requiresReauth, isFalse);
      expect(view.message, contains("403"));
    });
    test("refresh state toggles correctly", () async {
      final tracker = RefreshStateTracker();
      final completer = Completer<void>();

      final task = tracker.run(() async {
        expect(tracker.refreshing, isTrue);
        await completer.future;
      });

      expect(tracker.refreshing, isTrue);
      completer.complete();
      await task;
      expect(tracker.refreshing, isFalse);
    });

    test("product detail uses cache on network failure", () async {
      final store = await LocalStore.open(inMemory: true);
      await store.init();
      await store.seedDemoData();
      await _seedAuth(store);

      final warmRepository = MobileRepository(
        store: store,
        api: _IdleApiClient(),
      );
      final warm = await warmRepository.getProductDetail(
        productId: _demoProductId,
        refreshFromNetwork: false,
      );
      expect(warm.data, isNotNull);

      final failingRepository = MobileRepository(
        store: store,
        api: _FailingPullApiClient(),
      );
      final cached = await failingRepository.getProductDetail(
        productId: _demoProductId,
        refreshFromNetwork: true,
      );

      expect(cached.data, isNotNull);
      expect(cached.isStale, isTrue);
      expect(cached.source, "cache");

      await store.close();
    });

    test("manual refresh triggers repository refresh path", () async {
      final store = await LocalStore.open(inMemory: true);
      await store.init();
      await store.seedDemoData();
      await _seedAuth(store);

      final api = _CountingPullApiClient();
      final repository = MobileRepository(
        store: store,
        api: api,
      );

      await repository.getReportsSummary(refreshFromNetwork: true);

      expect(api.pullCalls, greaterThan(0));
      await store.close();
    });

    test("5xx safe fallback with cached data", () async {
      final store = await LocalStore.open(inMemory: true);
      await store.init();
      await store.seedDemoData();
      await _seedAuth(store);
      await store.saveDashboardSummary(
        const DashboardSummary(
          todaySales: 9000,
          transactionCount: 20,
          averageBasket: 450,
          refundTotal: 0,
          lowStockAlerts: [],
          topProducts: [],
          paymentMethodSummary: {"cash": 5000, "card": 4000},
          lastUpdatedAt: null,
        ),
      );

      final warmRepository = MobileRepository(
        store: store,
        api: _IdleApiClient(),
      );
      await warmRepository.getReportsSummary(refreshFromNetwork: false);

      final failingRepository = MobileRepository(
        store: store,
        api: _ServerFailureApiClient(),
      );
      final summary = await failingRepository.getReportsSummary(
        refreshFromNetwork: true,
      );

      expect(summary.data.todaySales, 9000);
      expect(summary.isStale, isTrue);
      expect(summary.source, "cache");
      await store.close();
    });
    test("reports summary uses cache on network failure", () async {
      final store = await LocalStore.open(inMemory: true);
      await store.init();
      await store.seedDemoData();
      await _seedAuth(store);
      await store.saveDashboardSummary(
        const DashboardSummary(
          todaySales: 12000,
          transactionCount: 32,
          averageBasket: 375,
          refundTotal: 110,
          lowStockAlerts: [],
          topProducts: [],
          paymentMethodSummary: {"cash": 6000, "card": 6000},
          lastUpdatedAt: null,
        ),
      );

      final warmRepository = MobileRepository(
        store: store,
        api: _IdleApiClient(),
      );
      await warmRepository.getReportsSummary(refreshFromNetwork: false);

      final failingRepository = MobileRepository(
        store: store,
        api: _FailingPullApiClient(),
      );
      final summary = await failingRepository.getReportsSummary(
        refreshFromNetwork: true,
      );

      expect(summary.data.todaySales, 12000);
      expect(summary.isStale, isTrue);
      expect(summary.source, "cache");

      await store.close();
    });


    test("401 on read refresh forces logout/re-auth path", () async {
      final store = await LocalStore.open(inMemory: true);
      await store.init();
      await store.seedDemoData();
      await _seedAuth(store);

      final repository = MobileRepository(
        store: store,
        api: _UnauthorizedPullApiClient(),
      );

      await expectLater(
        repository.getReportsSummary(refreshFromNetwork: true),
        throwsA(isA<AuthExpiredException>()),
      );

      expect(await store.getActiveSession(), isNull);
      expect(await store.getActivation(), isNull);
      await store.close();
    });
    test("401 response forces logout/re-auth path", () async {
      final store = await LocalStore.open(inMemory: true);
      await store.init();
      await store.seedDemoData();
      await _seedAuth(store);
      await store.saveSyncDiagnostics(
        SyncDiagnostics.initial.copyWith(online: true),
      );

      final repository = MobileRepository(
        store: store,
        api: _UnauthorizedApiClient(),
      );

      await expectLater(
        repository.syncNow(),
        throwsA(isA<AuthExpiredException>()),
      );

      expect(await store.getActiveSession(), isNull);
      expect(await store.getActivation(), isNull);

      await store.close();
    });


    test("stock count 422 failure handling", () async {
      final store = await LocalStore.open(inMemory: true);
      await store.init();
      await store.seedDemoData();
      await _seedAuth(store);
      await store.saveSyncDiagnostics(
        SyncDiagnostics.initial.copyWith(online: true),
      );

      final repository = MobileRepository(
        store: store,
        api: _ValidationPushApiClient(),
      );

      final session = await repository.createStockCountSession(
        label: "Sayim",
        countType: "full",
      );
      final product = (await repository.searchProducts(query: "su")).first;
      await repository.addProductToCount(
        sessionId: session.id,
        product: product,
        countedQty: 1,
      );

      await expectLater(
        () => repository.submitStockCount(session.id),
        throwsA(
          isA<ApiException>()
              .having((error) => error.kind, "kind", ApiErrorKind.validation)
              .having((error) => error.userMessage, "message", contains("422")),
        ),
      );

      await store.close();
    });

    test("stock count timeout failure handling", () async {
      final store = await LocalStore.open(inMemory: true);
      await store.init();
      await store.seedDemoData();
      await _seedAuth(store);
      await store.saveSyncDiagnostics(
        SyncDiagnostics.initial.copyWith(online: true),
      );

      final repository = MobileRepository(
        store: store,
        api: _TimeoutPushApiClient(),
      );

      final session = await repository.createStockCountSession(
        label: "Sayim",
        countType: "full",
      );
      final product = (await repository.searchProducts(query: "su")).first;
      await repository.addProductToCount(
        sessionId: session.id,
        product: product,
        countedQty: 1,
      );

      await expectLater(
        () => repository.submitStockCount(session.id),
        throwsA(
          isA<ApiException>()
              .having((error) => error.kind, "kind", ApiErrorKind.timeout)
              .having((error) => error.userMessage, "message", contains("zaman")),
        ),
      );

      await store.close();
    });
    test("stock count submit failure shows safe retryable error", () async {
      final store = await LocalStore.open(inMemory: true);
      await store.init();
      await store.seedDemoData();
      await _seedAuth(store);
      await store.saveSyncDiagnostics(
        SyncDiagnostics.initial.copyWith(online: true),
      );

      final repository = MobileRepository(
        store: store,
        api: _SyncFailureApiClient(),
      );

      final session = await repository.createStockCountSession(
        label: "Sayim",
        countType: "full",
      );
      final product = (await repository.searchProducts(query: "su")).first;
      await repository.addProductToCount(
        sessionId: session.id,
        product: product,
        countedQty: 1,
      );

      await expectLater(
        () => repository.submitStockCount(session.id),
        throwsA(
          isA<ApiException>().having(
            (error) => error.userMessage,
            "message",
            contains("aktarim tamamlanamadi"),
          ),
        ),
      );

      await store.close();
    });

    test("API parsing rejects malformed payload safely", () async {
      final client = MobileApiClient(
        client: MockClient(
          (request) async => http.Response(
            '{"tenantId":"tenant-1"}',
            200,
            headers: {"content-type": "application/json"},
          ),
        ),
      );

      await expectLater(
        () => client.mobileLogin(email: "a@a.com", password: "x"),
        throwsA(
          isA<ApiException>().having(
            (error) => error.kind,
            "kind",
            ApiErrorKind.contract,
          ),
        ),
      );
    });
  });
}

const _demoBranchId = "00000000-0000-0000-0000-000000000001";
const _demoProductId = "30000000-0000-0000-0000-000000000001";

Future<void> _seedAuth(LocalStore store) async {
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
      planCode: "growth",
      status: "active",
      activationToken: "activation-token",
      featureFlags: const ["mobile"],
      permissionActions: const [
        "dashboard.view",
        "reports.summary.view",
        "product.lookup",
        "product.create",
        "stock_count.create",
        "stock_count.submit",
      ],
      allowedBranchIds: const [_demoBranchId],
      lastValidationAt: now,
      offlineGraceUntil: now.add(const Duration(days: 7)),
      selectedBranchId: _demoBranchId,
      companyName: "Demo Tenant",
      licenseExpiresAt: now.add(const Duration(days: 30)),
    ),
  );

  await store.replacePermissions(
    const PermissionSnapshot(
      roleCode: "tenant_owner",
      actions: {
        "dashboard.view",
        "reports.summary.view",
        "product.lookup",
        "product.create",
        "stock_count.create",
        "stock_count.submit",
      },
      allowedBranchIds: {_demoBranchId},
    ),
  );
}

class _CountingPullApiClient extends _IdleApiClient {
  int pullCalls = 0;

  @override
  Future<PullSyncResponse> pullSync({
    required String accessToken,
    required String tenantId,
    required String deviceId,
    String? branchId,
    DateTime? since,
  }) async {
    pullCalls += 1;
    return const PullSyncResponse(payload: {});
  }
}

class _IdleApiClient extends MobileApiClient {
  _IdleApiClient()
      : super(
          client: MockClient(
            (request) async => http.Response("{}", 200),
          ),
        );

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
  Future<PushOutboxResponse> pushOutbox({
    required String accessToken,
    required String tenantId,
    required String branchId,
    required String deviceId,
    required List<LocalOutboxEvent> events,
  }) async {
    return const PushOutboxResponse(results: []);
  }
}

class _ServerFailureApiClient extends _IdleApiClient {
  @override
  Future<PullSyncResponse> pullSync({
    required String accessToken,
    required String tenantId,
    required String deviceId,
    String? branchId,
    DateTime? since,
  }) async {
    throw const ApiException(
      statusCode: 503,
      kind: ApiErrorKind.server,
      message: "Sunucu gecici olarak kullanilamiyor.",
    );
  }
}

class _UnauthorizedPullApiClient extends _IdleApiClient {
  @override
  Future<PullSyncResponse> pullSync({
    required String accessToken,
    required String tenantId,
    required String deviceId,
    String? branchId,
    DateTime? since,
  }) async {
    throw const ApiException(
      statusCode: 401,
      kind: ApiErrorKind.unauthorized,
      message: "Oturum suresi doldu. Lutfen tekrar giris yapin.",
    );
  }
}

class _FailingPullApiClient extends _IdleApiClient {
  @override
  Future<PullSyncResponse> pullSync({
    required String accessToken,
    required String tenantId,
    required String deviceId,
    String? branchId,
    DateTime? since,
  }) async {
    throw const ApiException(
      statusCode: null,
      kind: ApiErrorKind.network,
      message: "Baglanti kurulamadı",
    );
  }
}

class _UnauthorizedApiClient extends _IdleApiClient {
  @override
  Future<HeartbeatResponse> heartbeat({required String deviceId}) async {
    throw const ApiException(
      statusCode: 401,
      kind: ApiErrorKind.unauthorized,
      message: "Oturum suresi doldu. Lutfen tekrar giris yapin.",
    );
  }
}

class _ValidationPushApiClient extends _IdleApiClient {
  @override
  Future<PushOutboxResponse> pushOutbox({
    required String accessToken,
    required String tenantId,
    required String branchId,
    required String deviceId,
    required List<LocalOutboxEvent> events,
  }) async {
    throw const ApiException(
      statusCode: 422,
      kind: ApiErrorKind.validation,
      message: "Validation failed",
    );
  }
}

class _TimeoutPushApiClient extends _IdleApiClient {
  @override
  Future<PushOutboxResponse> pushOutbox({
    required String accessToken,
    required String tenantId,
    required String branchId,
    required String deviceId,
    required List<LocalOutboxEvent> events,
  }) async {
    throw const ApiException(
      statusCode: null,
      kind: ApiErrorKind.timeout,
      message: "Timeout",
    );
  }
}

class _SyncFailureApiClient extends _IdleApiClient {
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
              status: "rejected",
              message: "Reject",
              errorCode: "rejected",
            ),
          )
          .toList(),
    );
  }
}

class _ThrowingSearchRepository extends MobileRepository {
  _ThrowingSearchRepository({
    required super.store,
    required super.api,
  });

  @override
  Future<CachedRead<List<LocalProduct>>> searchProductsRead({
    String? query,
    String? barcode,
    bool refreshFromNetwork = false,
  }) async {
    throw StateError("Arama hatasi");
  }
}
