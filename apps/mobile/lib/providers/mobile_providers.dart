import "dart:async";

import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:loomapos_mobile/data/mobile_api_client.dart";
import "package:loomapos_mobile/data/mobile_repository.dart";
import "package:loomapos_mobile/models/mobile_models.dart";
import "package:loomapos_mobile/store/local_store.dart";

final localStoreProvider = FutureProvider<LocalStore>((ref) async {
  final store = await LocalStore.open();
  await store.init();
  ref.onDispose(store.close);
  return store;
});

final apiClientProvider = Provider<MobileApiClient>((ref) => MobileApiClient());

final repositoryProvider = FutureProvider<MobileRepository>((ref) async {
  final store = await ref.watch(localStoreProvider.future);
  return MobileRepository(store: store, api: ref.read(apiClientProvider));
});

class AppController extends StateNotifier<AppShellState> {
  AppController(this._ref) : super(AppShellState.initial) {
    unawaited(_bootstrap());
  }

  final Ref _ref;

  Future<void> _bootstrap() async {
    state = state.copyWith(
      mode: AppRuntimeMode.booting,
      busy: true,
      clearMessage: true,
    );
    try {
      final repository = await _ref.read(repositoryProvider.future);
      state = (await repository.bootstrap()).copyWith(busy: false);
    } catch (error) {
      state = AppShellState.initial.copyWith(
        mode: AppRuntimeMode.needsLogin,
        busy: false,
        message: error.toString(),
      );
    }
  }

  Future<void> signInAndActivate({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(busy: true, clearMessage: true);
    try {
      final repository = await _ref.read(repositoryProvider.future);
      state = (await repository.signInAndActivate(
        email: email,
        password: password,
      ))
          .copyWith(busy: false);
      refreshDataProvidersFromRef(_ref);
      _ref.read(syncControllerProvider.notifier).refreshFromStore();
    } catch (error) {
      state = state.copyWith(busy: false, message: error.toString());
    }
  }

  Future<void> logout() async {
    state = state.copyWith(busy: true, clearMessage: true);
    final repository = await _ref.read(repositoryProvider.future);
    state = (await repository.logout()).copyWith(busy: false);
    refreshDataProvidersFromRef(_ref);
    _ref.read(syncControllerProvider.notifier).refreshFromStore();
  }

  Future<void> selectBranch(String branchId) async {
    state = state.copyWith(busy: true, clearMessage: true);
    final repository = await _ref.read(repositoryProvider.future);
    state = (await repository.selectBranch(branchId)).copyWith(busy: false);
    refreshDataProvidersFromRef(_ref);
  }

  Future<void> refreshFromStore() => _bootstrap();
}

final appControllerProvider =
    StateNotifierProvider<AppController, AppShellState>(
  (ref) => AppController(ref),
);

class SyncController extends StateNotifier<SyncDiagnostics> {
  SyncController(this._ref) : super(SyncDiagnostics.initial) {
    unawaited(refreshFromStore());
    _scheduleNext(const Duration(seconds: 15));
  }

  final Ref _ref;
  Timer? _timer;
  static const Duration _healthyInterval = Duration(seconds: 30);
  static const Duration _degradedInterval = Duration(seconds: 90);
  static const Duration _offlineInterval = Duration(minutes: 3);

  Future<void> refreshFromStore() async {
    try {
      final store = await _ref.read(localStoreProvider.future);
      state = await store.getSyncDiagnostics();
    } catch (_) {
      state = state.copyWith(online: false);
    }
  }

  Future<void> run({bool silent = false}) async {
    if (state.running) {
      return;
    }

    final runtimeMode = _ref.read(appControllerProvider).mode;
    if (runtimeMode != AppRuntimeMode.ready) {
      _scheduleNext(_offlineInterval);
      return;
    }

    state = state.copyWith(running: true, clearError: silent);
    try {
      final repository = await _ref.read(repositoryProvider.future);
      state = await repository.syncNow();
      refreshDataProvidersFromRef(_ref);
      _ref.read(appControllerProvider.notifier).refreshFromStore();
      _scheduleNext(_resolveNextInterval(state));
    } on AuthExpiredException catch (error) {
      state = state.copyWith(
        running: false,
        online: false,
        blockedReason: "auth_expired",
        lastError: error.message,
      );
      await _ref.read(appControllerProvider.notifier).refreshFromStore();
      _scheduleNext(_offlineInterval);
    } catch (error) {
      state = state.copyWith(running: false, lastError: error.toString());
      _scheduleNext(_degradedInterval);
    }
  }

  Future<void> retryDeadLetter() async {
    state = state.copyWith(running: true, clearError: true);
    final repository = await _ref.read(repositoryProvider.future);
    state = await repository.retryDeadLetter();
    refreshDataProvidersFromRef(_ref);
    _scheduleNext(_resolveNextInterval(state));
  }

  void _scheduleNext(Duration interval) {
    _timer?.cancel();
    _timer = Timer(interval, () {
      unawaited(run(silent: true));
    });
  }

  Duration _resolveNextInterval(SyncDiagnostics diagnostics) {
    if (!diagnostics.online || diagnostics.blockedReason != null) {
      return _offlineInterval;
    }
    if (diagnostics.failedCount > 0 ||
        diagnostics.deadLetterCount > 0 ||
        diagnostics.lastError != null) {
      return _degradedInterval;
    }
    return _healthyInterval;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

final syncControllerProvider =
    StateNotifierProvider<SyncController, SyncDiagnostics>(
  (ref) => SyncController(ref),
);

final dashboardReadProvider = FutureProvider<CachedRead<DashboardSummary>>(
  (ref) async =>
      (await ref.watch(repositoryProvider.future)).getDashboardSummaryRead(),
);

final reportsSummaryProvider = FutureProvider<CachedRead<DashboardSummary>>(
  (ref) async =>
      (await ref.watch(repositoryProvider.future)).getReportsSummary(),
);

final branchOverviewProvider = FutureProvider<CachedRead<List<LocalBranch>>>(
  (ref) async =>
      (await ref.watch(repositoryProvider.future)).getBranchOverview(),
);

final salesListReadProvider =
    FutureProvider<CachedRead<List<ActivityFeedItem>>>(
  (ref) async =>
      (await ref.watch(repositoryProvider.future)).getSalesListRead(),
);

final dashboardProvider = FutureProvider<DashboardSummary>(
  (ref) async => (await ref.watch(dashboardReadProvider.future)).data,
);

final activityFeedProvider = FutureProvider<List<ActivityFeedItem>>(
  (ref) async => (await ref.watch(salesListReadProvider.future)).data,
);

final notificationsProvider = FutureProvider<List<LocalNotificationRecord>>(
  (ref) async =>
      (await ref.watch(repositoryProvider.future)).getNotifications(),
);

final conflictsProvider = FutureProvider<List<LocalProduct>>(
  (ref) async =>
      (await ref.watch(repositoryProvider.future)).getConflictProducts(),
);

final stockCountSessionsProvider =
    FutureProvider<List<StockCountSessionRecord>>(
  (ref) async =>
      (await ref.watch(repositoryProvider.future)).getStockCountSessions(),
);

final stockCountSessionProvider =
    FutureProvider.family<StockCountSessionRecord?, String>(
  (ref, sessionId) async => (await ref.watch(
    repositoryProvider.future,
  ))
      .getStockCountSession(sessionId),
);

final stockCountLinesProvider =
    FutureProvider.family<List<StockCountLineRecord>, String>(
  (ref, sessionId) async => (await ref.watch(
    repositoryProvider.future,
  ))
      .getStockCountLines(sessionId),
);

final productSearchReadProvider =
    FutureProvider.family<CachedRead<List<LocalProduct>>, String>(
  (ref, query) async =>
      (await ref.watch(repositoryProvider.future)).searchProductsRead(
    query: query,
  ),
);

final productSearchProvider = FutureProvider.family<List<LocalProduct>, String>(
  (ref, query) async =>
      (await ref.watch(productSearchReadProvider(query).future)).data,
);

final productDetailReadProvider =
    FutureProvider.family<CachedRead<LocalProduct?>, String>(
  (ref, productId) async =>
      (await ref.watch(repositoryProvider.future)).getProductDetail(
    productId: productId,
  ),
);

void refreshDataProviders(WidgetRef ref) {
  ref.invalidate(dashboardProvider);
  ref.invalidate(dashboardReadProvider);
  ref.invalidate(reportsSummaryProvider);
  ref.invalidate(branchOverviewProvider);
  ref.invalidate(salesListReadProvider);
  ref.invalidate(activityFeedProvider);
  ref.invalidate(notificationsProvider);
  ref.invalidate(conflictsProvider);
  ref.invalidate(stockCountSessionsProvider);
  ref.invalidate(repositoryProvider);
}

void refreshDataProvidersFromRef(Ref ref) {
  ref.invalidate(dashboardProvider);
  ref.invalidate(dashboardReadProvider);
  ref.invalidate(reportsSummaryProvider);
  ref.invalidate(branchOverviewProvider);
  ref.invalidate(salesListReadProvider);
  ref.invalidate(activityFeedProvider);
  ref.invalidate(notificationsProvider);
  ref.invalidate(conflictsProvider);
  ref.invalidate(stockCountSessionsProvider);
  ref.invalidate(repositoryProvider);
}
