import "dart:convert";
import "dart:math";

import "package:loomapos_mobile/core/mobile_constants.dart";
import "package:loomapos_mobile/data/mobile_api_client.dart";
import "package:loomapos_mobile/models/mobile_models.dart";
import "package:loomapos_mobile/store/local_store.dart";

class MobileRepository {
  MobileRepository({required LocalStore store, required MobileApiClient api})
      : _store = store,
        _api = api;

  final LocalStore _store;
  final MobileApiClient _api;

  static const _cacheDashboardKey = "read_cache_dashboard_summary";
  static const _cacheReportsKey = "read_cache_reports_summary";
  static const _cacheBranchesKey = "read_cache_branch_overview";
  static const _cacheSalesListKey = "read_cache_sales_list";
  static const _cacheProductDetailPrefix = "read_cache_product_detail";
  static const _cacheProductSearchPrefix = "read_cache_product_search";

  Future<AppShellState> bootstrap() async {
    await _store.seedDemoData();
    final session = await _store.getActiveSession();
    final activation = await _store.getActivation();
    final permissions = await _store.getPermissions();
    final branches = await _store.listBranches();
    final selectedBranchId = await _store.getSelectedBranchId();
    final sync = await _store.getSyncDiagnostics();

    if (session == null || activation == null) {
      return AppShellState.initial.copyWith(
        mode: AppRuntimeMode.needsLogin,
        session: session,
        activation: activation,
        permissions: permissions,
        branches: branches,
        selectedBranchId: selectedBranchId,
        syncDiagnostics: sync,
      );
    }

    if (!activation.canOperateOffline &&
        session.expiresAt.isBefore(DateTime.now().toUtc())) {
      return AppShellState.initial.copyWith(
        mode: AppRuntimeMode.locked,
        message:
            "Offline grace suresi doldu. Yeniden baglanip lisansi dogrulayin.",
        session: session,
        activation: activation,
        permissions: permissions,
        branches: branches,
        selectedBranchId: selectedBranchId,
        syncDiagnostics: sync,
      );
    }

    return AppShellState.initial.copyWith(
      mode: AppRuntimeMode.ready,
      session: session,
      activation: activation,
      permissions: permissions,
      branches: branches,
      selectedBranchId: selectedBranchId,
      syncDiagnostics: sync,
    );
  }

  Future<AppShellState> signInAndActivate({
    required String email,
    required String password,
  }) async {
    final auth = await _api.mobileLogin(email: email, password: password);
    final accessToken = auth.accessToken;
    final refreshToken = auth.refreshToken;
    final tenantId = auth.tenantId;
    final roleCode = auth.roles.isEmpty ? "tenant_owner" : auth.roles.first;

    final identity = await _api.me(accessToken);
    final license =
        await _api.getActiveLicense(accessToken, tenantId: tenantId);
    final deviceId = (await _store.getActivation())?.deviceId ?? _uuid();
    final activationResponse = await _api.activateMobileDevice(
      licenseKey: license.licenseKey,
      deviceId: deviceId,
      deviceName: "mobile-${deviceId.substring(0, 8)}",
      tenantId: tenantId,
    );

    final session = LocalSession(
      sessionId: _uuid(),
      userId: identity.customerAccountId ?? identity.email,
      email: identity.email,
      fullName: identity.displayName,
      tenantId: tenantId,
      roleCode: identity.role.isEmpty ? roleCode : identity.role,
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: auth.expiresAt,
      lastLoginAt: DateTime.now().toUtc(),
      status: "active",
    );
    await _store.saveSession(session);
    await _store.saveUser(
      userId: session.userId,
      fullName: session.fullName,
      email: session.email,
      roleCode: session.roleCode,
      status: "active",
    );

    final pull = await _api.pullSync(
      accessToken: accessToken,
      tenantId: tenantId,
      deviceId: deviceId,
      since: null,
    );
    final selectedBranchId = await _applyPullSnapshot(
      pull.payload,
      tenantId: tenantId,
      defaultBranchId: null,
    );
    await _persistReadCaches();

    final licenseExpiresAt = license.expiresAt;
    final offlineGraceUntil = _calculateOfflineGrace(licenseExpiresAt);
    final activation = LocalActivation(
      activationId: activationResponse.id,
      tenantId: tenantId,
      userId: session.userId,
      deviceId: deviceId,
      licenseId: activationResponse.licenseId,
      planCode: license.planCode,
      status: "subscription_active",
      activationToken: license.licenseKey,
      featureFlags: _toStringList(pull.payload["featureFlags"]),
      permissionActions: _toStringList(
        (pull.payload["permissions"] as Map<String, dynamic>? ?? {})["actions"],
      ),
      allowedBranchIds: _extractAllowedBranchIds(pull.payload["branches"]),
      lastValidationAt: DateTime.now().toUtc(),
      offlineGraceUntil: offlineGraceUntil,
      selectedBranchId: selectedBranchId,
      companyName: identity.companyName,
      licenseExpiresAt: licenseExpiresAt,
    );
    await _store.saveActivation(activation);
    await _store.appendAuditLog(
      actionType: "MOBILE_LOGIN",
      entityType: "session",
      entityId: session.sessionId,
      metadata: {"email": session.email, "tenantId": tenantId},
    );
    await _store.appendOutboxEvent(
      eventType: "MOBILE_SESSION_STARTED",
      aggregateType: "mobile_session",
      aggregateId: session.sessionId,
      payload: {
        "userId": session.userId,
        "email": session.email,
        "roleCode": session.roleCode,
        "startedAt": session.lastLoginAt.toIso8601String(),
      },
    );
    await _store.refreshSyncDiagnosticsFromOutbox(
      online: true,
      lastPullAt: DateTime.now().toUtc(),
      clearError: true,
    );

    return bootstrap();
  }

  Future<AppShellState> logout() async {
    final session = await _store.getActiveSession();
    final activation = await _store.getActivation();
    if (session != null) {
      await _store.appendOutboxEvent(
        eventType: "MOBILE_SESSION_ENDED",
        aggregateType: "mobile_session",
        aggregateId: session.sessionId,
        payload: {
          "userId": session.userId,
          "endedAt": DateTime.now().toUtc().toIso8601String(),
        },
      );
    }
    await _store.clearSession();
    await _store.refreshSyncDiagnosticsFromOutbox(
      online: false,
      lastError: null,
      blockedReason: activation == null ? null : "Session kapatildi.",
      clearError: true,
    );
    return bootstrap();
  }

  Future<AppShellState> selectBranch(String branchId) async {
    await _store.selectBranch(branchId);
    return bootstrap();
  }

  Future<SyncDiagnostics> syncNow({bool rethrowOnError = false}) async {
    final session = await _store.getActiveSession();
    final activation = await _store.getActivation();
    if (session == null ||
        activation == null ||
        activation.selectedBranchId == null) {
      await _store.refreshSyncDiagnosticsFromOutbox(
        online: false,
        lastError: "Activation veya session eksik.",
        blockedReason: "login_required",
      );
      return _store.getSyncDiagnostics();
    }

    await _store.refreshSyncDiagnosticsFromOutbox(
      running: true,
      online: true,
      clearError: true,
    );
    try {
      final events = await _store.getDispatchableOutboxEvents(
        limit: kSyncBatchSize,
      );
      if (events.isNotEmpty) {
        final pushResponse = await _api.pushOutbox(
          accessToken: session.accessToken,
          tenantId: activation.tenantId,
          branchId: activation.selectedBranchId!,
          deviceId: activation.deviceId,
          events: events,
        );
        final byId = {for (final event in events) event.id: event};
        for (final result in pushResponse.results) {
          final eventId = result.eventId;
          final event = byId[eventId];
          final status = result.status;
          final message = (result.message ?? status).toString();
          switch (status) {
            case "accepted":
            case "duplicate":
              await _store.markOutboxSent(eventId);
              if (event != null && event.aggregateType == "product") {
                await _store.markProductSyncStatus(
                  event.aggregateId,
                  syncStatus: "synced",
                  conflictState: "none",
                  pendingVerification: false,
                );
              }
              if (event != null &&
                  event.aggregateType == "stock_count_session") {
                await _store.markStockCountSynced(event.aggregateId);
              }
              break;
            case "conflict":
              await _store.markOutboxConflict(eventId, errorMessage: message);
              if (event != null && event.aggregateType == "product") {
                await _store.markProductSyncStatus(
                  event.aggregateId,
                  syncStatus: "needs_review",
                  conflictState: "needs_review",
                  conflictReason: message,
                  pendingVerification: false,
                );
              }
              break;
            case "rejected":
              await _store.markOutboxFailed(
                eventId,
                errorCode: result.errorCode ?? "rejected",
                errorMessage: message,
                deadLetter: true,
              );
              if (event != null &&
                  event.aggregateType == "stock_count_session") {
                await _store.markStockCountFailed(event.aggregateId, message);
              }
              break;
            case "device_invalid":
            case "license_invalid":
            case "subscription_state_blocked":
              await _store.markOutboxFailed(
                eventId,
                errorCode: status,
                errorMessage: message,
                deadLetter: true,
              );
              final lifecycleMatch = RegExp(r"state\s+([a-z_]+)", caseSensitive: false).firstMatch(message);
              final lifecycleState = lifecycleMatch?.group(1)?.trim().toLowerCase();
              await _store.updateActivation(
                status: lifecycleState?.isNotEmpty == true ? lifecycleState! : "suspended_blocked",
              );
              await _store.refreshSyncDiagnosticsFromOutbox(
                blockedReason: lifecycleState?.isNotEmpty == true ? lifecycleState : status,
                lastError: message,
              );
              break;
            default:
              await _store.markOutboxFailed(
                eventId,
                errorCode: result.errorCode ?? status,
                errorMessage: message,
                deadLetter: false,
              );
              break;
          }
        }
      }

      final heartbeat = await _api.heartbeat(deviceId: activation.deviceId);
      final lifecycleState = heartbeat.lifecycleState?.trim().toLowerCase();
      final normalizedLifecycleState =
          lifecycleState == null || lifecycleState.isEmpty ? null : lifecycleState;
      await _store.updateActivation(
        status:
            normalizedLifecycleState ??
            (heartbeat.licenseStatus == "active"
                ? "subscription_active"
                : activation.status),
        lastValidationAt: DateTime.now().toUtc(),
        offlineGraceUntil: _calculateOfflineGrace(heartbeat.expiresAt),
      );
      final pull = await _api.pullSync(
        accessToken: session.accessToken,
        tenantId: activation.tenantId,
        deviceId: activation.deviceId,
        branchId: activation.selectedBranchId,
        since: (await _store.getSyncDiagnostics()).lastPullAt,
      );
      await _applyPullSnapshot(
        pull.payload,
        tenantId: activation.tenantId,
        defaultBranchId: activation.selectedBranchId,
      );
      await _persistReadCaches();
      await _store.refreshSyncDiagnosticsFromOutbox(
        running: false,
        online: true,
        lastSuccessfulSyncAt: DateTime.now().toUtc(),
        lastPullAt: DateTime.now().toUtc(),
        lastHeartbeatAt: DateTime.now().toUtc(),
        clearError: true,
        blockedReason: null,
      );
    } catch (error) {
      if (error is ApiException && error.kind == ApiErrorKind.unauthorized) {
        await _clearAuthStateForExpiredSession(error.userMessage);
        throw const AuthExpiredException(
          "Oturum suresi doldu. Lutfen tekrar giris yapin.",
        );
      }
      await _store.refreshSyncDiagnosticsFromOutbox(
        running: false,
        online: false,
        lastError: error is ApiException ? error.userMessage : error.toString(),
      );
      if (rethrowOnError) {
        if (error is ApiException) {
          rethrow;
        }
        throw const ApiException(
          statusCode: null,
          kind: ApiErrorKind.unknown,
          message: "Senkronizasyon su an tamamlanamadi.",
        );
      }
    }

    return _store.getSyncDiagnostics();
  }

  Future<SyncDiagnostics> retryDeadLetter() async {
    await _store.retryDeadLetterEvents();
    return syncNow();
  }

  Future<DashboardSummary> getDashboardSummary() async {
    final summary = await _store.getDashboardSummary();
    await _store.saveReadCache(_cacheDashboardKey, _dashboardToJson(summary));
    return summary;
  }

  Future<CachedRead<DashboardSummary>> getDashboardSummaryRead({
    bool refreshFromNetwork = false,
  }) async {
    var usedFallback = false;
    if (refreshFromNetwork) {
      try {
        await _refreshReadModelsWithPolicy();
      } on AuthExpiredException {
        rethrow;
      } catch (error) {
        if (_shouldUseReadFallback(error)) {
          usedFallback = true;
        } else {
          rethrow;
        }
      }
    }

    final local = await _store.getDashboardSummary();
    await _store.saveReadCache(_cacheDashboardKey, _dashboardToJson(local));

    final diagnostics = await _store.getSyncDiagnostics();
    if (!usedFallback && diagnostics.online) {
      return CachedRead<DashboardSummary>(
        data: local,
        isStale: false,
        source: "live",
        cachedAt: local.lastUpdatedAt,
      );
    }

    final cached = await _store.getReadCache(_cacheDashboardKey);
    if (cached != null) {
      return CachedRead<DashboardSummary>(
        data: _dashboardFromJson(cached),
        isStale: true,
        source: "cache",
        cachedAt: _parseDateTime(cached["_cachedAt"]),
      );
    }

    return CachedRead<DashboardSummary>(
      data: local,
      isStale: true,
      source: "local",
      cachedAt: local.lastUpdatedAt,
    );
  }

  Future<CachedRead<DashboardSummary>> getReportsSummary({
    bool refreshFromNetwork = false,
  }) async {
    var usedFallback = false;
    if (refreshFromNetwork) {
      try {
        await _refreshReadModelsWithPolicy();
      } on AuthExpiredException {
        rethrow;
      } catch (error) {
        if (_shouldUseReadFallback(error)) {
          usedFallback = true;
        } else {
          rethrow;
        }
      }
    }

    final local = await _store.getDashboardSummary();
    await _store.saveReadCache(_cacheReportsKey, _dashboardToJson(local));

    final diagnostics = await _store.getSyncDiagnostics();
    if (!usedFallback && diagnostics.online) {
      return CachedRead<DashboardSummary>(
        data: local,
        isStale: false,
        source: "live",
        cachedAt: local.lastUpdatedAt,
      );
    }

    final cached = await _store.getReadCache(_cacheReportsKey);
    if (cached != null) {
      return CachedRead<DashboardSummary>(
        data: _dashboardFromJson(cached),
        isStale: true,
        source: "cache",
        cachedAt: _parseDateTime(cached["_cachedAt"]),
      );
    }

    return CachedRead<DashboardSummary>(
      data: local,
      isStale: true,
      source: "local",
      cachedAt: local.lastUpdatedAt,
    );
  }

  Future<CachedRead<List<LocalBranch>>> getBranchOverview({
    bool refreshFromNetwork = false,
  }) async {
    var usedFallback = false;
    if (refreshFromNetwork) {
      try {
        await _refreshReadModelsWithPolicy();
      } on AuthExpiredException {
        rethrow;
      } catch (error) {
        if (_shouldUseReadFallback(error)) {
          usedFallback = true;
        } else {
          rethrow;
        }
      }
    }

    final branches = await _store.listBranches();
    await _store.saveReadCache(_cacheBranchesKey, {
      "branches": branches.map(_branchToJson).toList(),
    });

    final diagnostics = await _store.getSyncDiagnostics();
    if (!usedFallback && diagnostics.online) {
      return CachedRead<List<LocalBranch>>(
        data: branches,
        isStale: false,
        source: "live",
        cachedAt: DateTime.now().toUtc(),
      );
    }

    final cached = await _store.getReadCache(_cacheBranchesKey);
    if (cached != null) {
      return CachedRead<List<LocalBranch>>(
        data: _branchesFromCache(cached),
        isStale: true,
        source: "cache",
        cachedAt: _parseDateTime(cached["_cachedAt"]),
      );
    }

    return CachedRead<List<LocalBranch>>(
      data: branches,
      isStale: true,
      source: "local",
      cachedAt: DateTime.now().toUtc(),
    );
  }

  Future<CachedRead<LocalProduct?>> getProductDetail({
    required String productId,
    bool refreshFromNetwork = false,
  }) async {
    var usedFallback = false;
    if (refreshFromNetwork) {
      try {
        await _refreshReadModelsWithPolicy();
      } on AuthExpiredException {
        rethrow;
      } catch (error) {
        if (_shouldUseReadFallback(error)) {
          usedFallback = true;
        } else {
          rethrow;
        }
      }
    }

    final local = await _store.getProductById(productId);
    if (local != null) {
      await _store.saveReadCache(
        "$_cacheProductDetailPrefix:$productId",
        _productToJson(local),
      );
    }

    final diagnostics = await _store.getSyncDiagnostics();
    if (!usedFallback && diagnostics.online) {
      return CachedRead<LocalProduct?>(
        data: local,
        isStale: false,
        source: "live",
        cachedAt: local?.updatedAt,
      );
    }

    final cached = await _store.getReadCache(
      "$_cacheProductDetailPrefix:$productId",
    );
    if (cached != null) {
      return CachedRead<LocalProduct?>(
        data: _productFromJson(cached),
        isStale: true,
        source: "cache",
        cachedAt: _parseDateTime(cached["_cachedAt"]),
      );
    }

    return CachedRead<LocalProduct?>(
      data: local,
      isStale: true,
      source: "local",
      cachedAt: local?.updatedAt,
    );
  }

  Future<CachedRead<List<ActivityFeedItem>>> getSalesListRead({
    bool refreshFromNetwork = false,
  }) async {
    var usedFallback = false;
    if (refreshFromNetwork) {
      try {
        await _refreshReadModelsWithPolicy();
      } on AuthExpiredException {
        rethrow;
      } catch (error) {
        if (_shouldUseReadFallback(error)) {
          usedFallback = true;
        } else {
          rethrow;
        }
      }
    }

    final local = await _store.listRecentActivity();
    await _store.saveReadCache(_cacheSalesListKey, {
      "items": local.map(_activityToJson).toList(),
    });

    final diagnostics = await _store.getSyncDiagnostics();
    if (!usedFallback && diagnostics.online) {
      return CachedRead<List<ActivityFeedItem>>(
        data: local,
        isStale: false,
        source: "live",
        cachedAt:
            local.isEmpty ? DateTime.now().toUtc() : local.first.createdAt,
      );
    }

    final cached = await _store.getReadCache(_cacheSalesListKey);
    if (cached != null) {
      return CachedRead<List<ActivityFeedItem>>(
        data: _activitiesFromCache(cached),
        isStale: true,
        source: "cache",
        cachedAt: _parseDateTime(cached["_cachedAt"]),
      );
    }

    return CachedRead<List<ActivityFeedItem>>(
      data: local,
      isStale: true,
      source: "local",
      cachedAt: local.isEmpty ? DateTime.now().toUtc() : local.first.createdAt,
    );
  }

  Future<List<ActivityFeedItem>> getActivityFeed() =>
      _store.listRecentActivity();
  Future<List<LocalNotificationRecord>> getNotifications() =>
      _store.listNotifications();
  Future<void> markNotificationRead(String id) =>
      _store.markNotificationRead(id);

  Future<CachedRead<List<LocalProduct>>> searchProductsRead({
    String? query,
    String? barcode,
    bool refreshFromNetwork = false,
  }) async {
    var usedFallback = false;
    if (refreshFromNetwork) {
      try {
        await _refreshReadModelsWithPolicy();
      } on AuthExpiredException {
        rethrow;
      } catch (error) {
        if (_shouldUseReadFallback(error)) {
          usedFallback = true;
        } else {
          rethrow;
        }
      }
    }

    final normalizedQuery = query?.trim() ?? "";
    final cacheKey = _productSearchCacheKey(
      query: normalizedQuery,
      barcode: barcode,
    );
    try {
      final result = await _store.searchProducts(
        query: query,
        barcode: barcode,
      );
      await _store.saveReadCache(cacheKey, {
        "products": result.map(_productToJson).toList(),
      });

      final diagnostics = await _store.getSyncDiagnostics();
      if (!usedFallback && diagnostics.online) {
        return CachedRead<List<LocalProduct>>(
          data: result,
          isStale: false,
          source: "live",
          cachedAt: DateTime.now().toUtc(),
        );
      }

      final cached = await _store.getReadCache(cacheKey);
      if (cached != null) {
        return CachedRead<List<LocalProduct>>(
          data: _productsFromCache(cached),
          isStale: true,
          source: "cache",
          cachedAt: _parseDateTime(cached["_cachedAt"]),
        );
      }

      return CachedRead<List<LocalProduct>>(
        data: result,
        isStale: true,
        source: "local",
        cachedAt: DateTime.now().toUtc(),
      );
    } catch (_) {
      final cached = await _store.getReadCache(cacheKey);
      if (cached == null) {
        rethrow;
      }
      return CachedRead<List<LocalProduct>>(
        data: _productsFromCache(cached),
        isStale: true,
        source: "cache",
        cachedAt: _parseDateTime(cached["_cachedAt"]),
      );
    }
  }

  Future<List<LocalProduct>> searchProducts({
    String? query,
    String? barcode,
  }) async {
    final read = await searchProductsRead(query: query, barcode: barcode);
    return read.data;
  }

  Future<List<LocalProduct>> getConflictProducts() =>
      _store.listConflictProducts();
  Future<List<StockCountSessionRecord>> getStockCountSessions() =>
      _store.listStockCountSessions();
  Future<StockCountSessionRecord?> getStockCountSession(String id) =>
      _store.getStockCountSession(id);
  Future<List<StockCountLineRecord>> getStockCountLines(String id) =>
      _store.listStockCountLines(id);

  Future<StockCountSessionRecord> createStockCountSession({
    required String label,
    required String countType,
    String? notes,
  }) async {
    final session = await _store.getActiveSession();
    final activation = await _store.getActivation();
    final branchId = await _store.getSelectedBranchId();
    final diagnostics = await _store.getSyncDiagnostics();
    if (session == null || activation == null || branchId == null) {
      throw StateError("Aktif session veya branch bulunamadi.");
    }
    _ensureTrialWriteAllowed(activation, diagnostics);
    await _store.appendAuditLog(
      actionType: "STOCK_COUNT_SESSION_CREATED",
      entityType: "stock_count_session",
      entityId: label,
      metadata: {"branchId": branchId, "countType": countType},
    );
    return _store.createStockCountSession(
      tenantId: activation.tenantId,
      branchId: branchId,
      label: label,
      countType: countType,
      startedBy: session.fullName,
      notes: notes,
    );
  }

  Future<void> addProductToCount({
    required String sessionId,
    required LocalProduct product,
    required double countedQty,
    String? note,
  }) async {
    final activation = await _store.getActivation();
    final diagnostics = await _store.getSyncDiagnostics();
    if (activation == null) {
      throw StateError("Aktif lisans baglami bulunamadi.");
    }
    _ensureTrialWriteAllowed(activation, diagnostics);

    await _store.upsertStockCountLine(
      sessionId: sessionId,
      productId: product.id,
      barcodeSnapshot: product.barcode,
      productNameSnapshot: product.name,
      expectedQtySnapshot: product.stockQty,
      countedQty: countedQty,
      note: note,
    );
  }

  Future<LocalProduct?> findProductByBarcode(String barcode) =>
      _store.getProductByBarcode(barcode);

  Future<void> submitStockCount(String sessionId) async {
    final activation = await _store.getActivation();
    final diagnostics = await _store.getSyncDiagnostics();
    if (activation == null) {
      throw StateError("Aktif lisans baglami bulunamadi.");
    }
    _ensureTrialWriteAllowed(activation, diagnostics);
    if (!diagnostics.online) {
      throw const ApiException(
        statusCode: null,
        kind: ApiErrorKind.network,
        message:
            "Stok sayimi gondermek icin internet baglantisi gerekli. Baglanti saglandiginda tekrar deneyin.",
      );
    }

    await _store.submitStockCountSession(sessionId);
    await _store.appendAuditLog(
      actionType: "STOCK_COUNT_SUBMITTED",
      entityType: "stock_count_session",
      entityId: sessionId,
      metadata: {"submittedAt": DateTime.now().toUtc().toIso8601String()},
    );

    late final SyncDiagnostics syncResult;
    try {
      syncResult = await syncNow(rethrowOnError: true);
    } on ApiException catch (error) {
      throw ApiException(
        statusCode: error.statusCode,
        kind: error.kind,
        message: _stockCountSubmitMessage(error.kind),
        details: error.details,
      );
    }

    if (syncResult.lastError != null ||
        syncResult.failedCount > 0 ||
        syncResult.deadLetterCount > 0) {
      throw const ApiException(
        statusCode: null,
        kind: ApiErrorKind.network,
        message:
            "Sayim kaydi alindi ancak aktarim tamamlanamadi. Lutfen tekrar deneyin.",
      );
    }
  }


  void _ensureTrialWriteAllowed(LocalActivation activation, SyncDiagnostics diagnostics) {
    final status = activation.status.toLowerCase().trim();
    final blockedReason = (diagnostics.blockedReason ?? "").toLowerCase().trim();

    String lifecycleState = status;
    if (lifecycleState.isEmpty || lifecycleState == "active") {
      lifecycleState = "subscription_active";
    }
    if (lifecycleState == "trial_expiring_soon") {
      lifecycleState = "trial_expiring";
    }
    if (lifecycleState == "trial_expired_read_only") {
      lifecycleState = "trial_expired";
    }
    if (lifecycleState == "past_due" || lifecycleState == "past-due") {
      lifecycleState = "subscription_past_due";
    }
    if (lifecycleState == "canceled" || lifecycleState == "cancelled") {
      lifecycleState = "subscription_canceled";
    }
    if (lifecycleState == "suspended" || lifecycleState == "blocked" || lifecycleState == "revoked") {
      lifecycleState = "suspended_blocked";
    }

    if (blockedReason.contains("suspended_blocked") ||
        blockedReason.contains("license_invalid") ||
        blockedReason.contains("device_invalid") ||
        blockedReason.contains("suspend") ||
        blockedReason.contains("blocked")) {
      lifecycleState = "suspended_blocked";
    }
    if (blockedReason.contains("trial_expired") ||
        blockedReason.contains("read_only") ||
        blockedReason.contains("readonly")) {
      lifecycleState = "trial_expired";
    }

    if (lifecycleState == "suspended_blocked") {
      throw const ApiException(
        statusCode: 403,
        kind: ApiErrorKind.forbidden,
        message: "Hesap askida/bloklu. Bu islem su anda kapali.",
      );
    }

    if (lifecycleState == "trial_expired") {
      throw const ApiException(
        statusCode: 403,
        kind: ApiErrorKind.forbidden,
        message: "Deneme suresi doldu. Sistem salt-okunur modda; yazma islemleri kapali.",
      );
    }
  }

  Future<LocalProduct> saveProduct({
    String? existingId,
    required String name,
    required String? barcode,
    required String? sku,
    required String? categoryName,
    required double salePrice,
    required double purchasePrice,
    required double taxRate,
    required bool stockTracked,
    required double minStock,
    required bool isActive,
    required double stockQty,
  }) async {
    final session = await _store.getActiveSession();
    final activation = await _store.getActivation();
    if (session == null || activation == null) {
      throw StateError("Aktif session bulunamadi.");
    }

    final normalizedBarcode = barcode?.trim();
    if (normalizedBarcode != null && normalizedBarcode.isNotEmpty) {
      final sameBarcode = await _store.getProductByBarcode(normalizedBarcode);
      if (sameBarcode != null && sameBarcode.id != existingId) {
        return _store.saveLocalProduct(
          existingId: existingId,
          name: name,
          barcode: normalizedBarcode,
          sku: sku,
          categoryName: categoryName,
          salePrice: salePrice,
          purchasePrice: purchasePrice,
          taxRate: taxRate,
          stockTracked: stockTracked,
          minStock: minStock,
          isActive: isActive,
          stockQty: stockQty,
          syncStatus: "needs_review",
          conflictState: "needs_review",
          conflictReason: "Ayni barkod yerelde baska urunde mevcut.",
          pendingVerification: false,
        );
      }
    }

    final eventType =
        existingId == null ? "PRODUCT_CREATED" : "PRODUCT_UPDATED";
    final product = await _store.saveLocalProduct(
      existingId: existingId,
      name: name,
      barcode: normalizedBarcode,
      sku: sku,
      categoryName: categoryName,
      salePrice: salePrice,
      purchasePrice: purchasePrice,
      taxRate: taxRate,
      stockTracked: stockTracked,
      minStock: minStock,
      isActive: isActive,
      stockQty: stockQty,
      syncStatus: "pending_sync",
      conflictState: "none",
      conflictReason: null,
      pendingVerification: true,
      outboxEventType: eventType,
      outboxPayload: {
        "productId": existingId,
        "name": name,
        "barcode": normalizedBarcode,
        "sku": sku,
        "categoryName": categoryName,
        "salePrice": salePrice,
        "purchasePrice": purchasePrice,
        "taxRate": taxRate,
        "stockTracked": stockTracked,
        "minStock": minStock,
        "isActive": isActive,
        "stockQty": stockQty,
        "tenantId": activation.tenantId,
        "branchId": await _store.getSelectedBranchId(),
      },
    );
    await _store.appendAuditLog(
      actionType: eventType,
      entityType: "product",
      entityId: product.id,
      metadata: {"name": product.name, "barcode": product.barcode},
    );
    return product;
  }

  Future<String?> _applyPullSnapshot(
    Map<String, dynamic> payload, {
    required String tenantId,
    required String? defaultBranchId,
  }) async {
    final branchesPayload = (payload["branches"] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final branches = branchesPayload
        .map(
          (item) => LocalBranch(
            id: item["id"]?.toString() ?? "",
            name: item["name"]?.toString() ?? "-",
            isAssigned: true,
            isSelected: item["id"]?.toString() == defaultBranchId,
            settingsJson: jsonEncode(item["settingsJson"] ?? {}),
            updatedAt:
                _parseDateTime(item["updatedAt"]) ?? DateTime.now().toUtc(),
          ),
        )
        .where((branch) => branch.id.isNotEmpty)
        .toList();
    if (branches.isNotEmpty) {
      await _store.replaceBranches(
        branches,
        selectedBranchId: defaultBranchId ?? branches.first.id,
      );
    }

    final permissionsPayload =
        payload["permissions"] as Map<String, dynamic>? ?? {};
    await _store.replacePermissions(
      PermissionSnapshot(
        roleCode: permissionsPayload["roleCode"]?.toString() ?? "tenant_owner",
        actions: _toStringList(permissionsPayload["actions"]).toSet(),
        allowedBranchIds: _extractAllowedBranchIds(payload["branches"]).toSet(),
      ),
    );

    final productsPayload = (payload["products"] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(
          (item) => LocalProduct(
            id: item["id"]?.toString() ?? "",
            name: item["name"]?.toString() ?? "-",
            barcode: item["barcode"]?.toString(),
            sku: item["sku"]?.toString(),
            categoryName: item["categoryName"]?.toString(),
            salePrice: _toDouble(item["price"]),
            purchasePrice: _toDouble(item["purchasePrice"]),
            taxRate: _toDouble(item["taxRate"]),
            stockTracked: item["stockTracked"] == true,
            minStock: _toDouble(item["minStock"]),
            isActive: item["isActive"] != false,
            stockQty: _toDouble(item["stockQty"]),
            syncStatus: "synced",
            conflictState: "none",
            conflictReason: null,
            pendingVerification: false,
            updatedAt:
                _parseDateTime(item["updatedAt"]) ?? DateTime.now().toUtc(),
          ),
        )
        .where((item) => item.id.isNotEmpty)
        .toList();
    if (productsPayload.isNotEmpty) {
      await _store.replaceProducts(productsPayload);
    }

    final dashboardPayload =
        payload["dashboardSummary"] as Map<String, dynamic>? ?? {};
    await _store.saveDashboardSummary(
      DashboardSummary(
        todaySales: _toDouble(dashboardPayload["todaySales"]),
        transactionCount: _toInt(dashboardPayload["transactionCount"]),
        averageBasket: _toDouble(dashboardPayload["averageBasket"]),
        refundTotal: _toDouble(dashboardPayload["refundTotal"]),
        lowStockAlerts:
            (dashboardPayload["lowStockAlerts"] as List<dynamic>? ?? [])
                .whereType<Map<String, dynamic>>()
                .map(
                  (item) => LowStockAlert(
                    productId: item["productId"]?.toString() ?? "",
                    productName: item["productName"]?.toString() ?? "-",
                    qty: _toDouble(item["qty"]),
                    minStock: _toDouble(item["minStock"]),
                    branchName: item["branchName"]?.toString(),
                  ),
                )
                .toList(),
        topProducts: (dashboardPayload["topProducts"] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(
              (item) => TopProductSummary(
                productId: item["productId"]?.toString() ?? "",
                productName: item["productName"]?.toString() ?? "-",
                quantity: _toDouble(item["quantity"]),
                revenue: _toDouble(item["revenue"]),
              ),
            )
            .toList(),
        paymentMethodSummary: (dashboardPayload["paymentMethodSummary"]
                    as Map<String, dynamic>? ??
                {})
            .map((key, value) => MapEntry(key, _toDouble(value))),
        lastUpdatedAt: _parseDateTime(payload["serverTime"]),
      ),
    );

    final activity = (payload["recentActivity"] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(
          (item) => ActivityFeedItem(
            id: item["id"]?.toString() ?? _uuid(),
            type: item["type"]?.toString() ?? "info",
            title: item["title"]?.toString() ?? "-",
            subtitle: item["subtitle"]?.toString() ?? "",
            branchName: item["branchName"]?.toString(),
            actorName: item["actorName"]?.toString(),
            amount: _nullableDouble(item["amount"]),
            qtyImpact: _nullableDouble(item["qtyImpact"]),
            createdAt:
                _parseDateTime(item["createdAt"]) ?? DateTime.now().toUtc(),
            syncState: item["syncState"]?.toString() ?? "synced",
          ),
        )
        .toList();
    if (activity.isNotEmpty) {
      await _store.replaceRecentActivity(activity);
    }

    final notifications = (payload["notifications"] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(
          (item) => LocalNotificationRecord(
            id: item["id"]?.toString() ?? _uuid(),
            category: item["category"]?.toString() ?? "info",
            title: item["title"]?.toString() ?? "-",
            body: item["body"]?.toString() ?? "",
            targetRoute: item["targetRoute"]?.toString(),
            isRead: item["isRead"] == true,
            createdAt:
                _parseDateTime(item["createdAt"]) ?? DateTime.now().toUtc(),
          ),
        )
        .toList();
    if (notifications.isNotEmpty) {
      await _store.replaceNotifications(notifications);
    }

    return branches.isEmpty
        ? defaultBranchId
        : (defaultBranchId ?? branches.first.id);
  }

  Future<void> _refreshReadModelsFromServer() async {
    final session = await _store.getActiveSession();
    final activation = await _store.getActivation();
    if (session == null || activation == null) {
      return;
    }

    final pull = await _api.pullSync(
      accessToken: session.accessToken,
      tenantId: activation.tenantId,
      deviceId: activation.deviceId,
      branchId: activation.selectedBranchId,
      since: null,
    );
    await _applyPullSnapshot(
      pull.payload,
      tenantId: activation.tenantId,
      defaultBranchId: activation.selectedBranchId,
    );
    await _persistReadCaches();
  }

  Future<void> _refreshReadModelsWithPolicy() async {
    try {
      await _refreshReadModelsFromServer();
    } on ApiException catch (error) {
      if (error.kind == ApiErrorKind.unauthorized) {
        await _clearAuthStateForExpiredSession(error.userMessage);
        throw const AuthExpiredException(
          "Oturum suresi doldu. Lutfen tekrar giris yapin.",
        );
      }
      rethrow;
    }
  }

  bool _shouldUseReadFallback(Object error) {
    if (error is! ApiException) {
      return false;
    }
    return error.kind == ApiErrorKind.timeout ||
        error.kind == ApiErrorKind.network ||
        error.kind == ApiErrorKind.server;
  }

  Future<void> _clearAuthStateForExpiredSession(String? reason) async {
    await _store.clearSession();
    await _store.clearActivation();
    await _store.refreshSyncDiagnosticsFromOutbox(
      running: false,
      online: false,
      lastError: reason ?? "Oturum suresi doldu.",
      blockedReason: "auth_expired",
    );
  }

  Future<void> _persistReadCaches() async {
    final dashboard = await _store.getDashboardSummary();
    await _store.saveReadCache(_cacheDashboardKey, _dashboardToJson(dashboard));
    await _store.saveReadCache(_cacheReportsKey, _dashboardToJson(dashboard));

    final branches = await _store.listBranches();
    await _store.saveReadCache(_cacheBranchesKey, {
      "branches": branches.map(_branchToJson).toList(),
    });

    final activity = await _store.listRecentActivity();
    await _store.saveReadCache(_cacheSalesListKey, {
      "items": activity.map(_activityToJson).toList(),
    });
  }

  String _productSearchCacheKey({
    required String query,
    required String? barcode,
  }) {
    if (barcode != null && barcode.trim().isNotEmpty) {
      return "$_cacheProductSearchPrefix:barcode:${barcode.trim()}";
    }
    return "$_cacheProductSearchPrefix:${query.toLowerCase()}";
  }

  Map<String, dynamic> _dashboardToJson(DashboardSummary summary) {
    return {
      "todaySales": summary.todaySales,
      "transactionCount": summary.transactionCount,
      "averageBasket": summary.averageBasket,
      "refundTotal": summary.refundTotal,
      "lastUpdatedAt": summary.lastUpdatedAt?.toIso8601String(),
      "paymentMethodSummary": summary.paymentMethodSummary,
      "topProducts": summary.topProducts
          .map(
            (item) => {
              "productId": item.productId,
              "productName": item.productName,
              "quantity": item.quantity,
              "revenue": item.revenue,
            },
          )
          .toList(),
      "lowStockAlerts": summary.lowStockAlerts
          .map(
            (item) => {
              "productId": item.productId,
              "productName": item.productName,
              "qty": item.qty,
              "minStock": item.minStock,
              "branchName": item.branchName,
            },
          )
          .toList(),
    };
  }

  DashboardSummary _dashboardFromJson(Map<String, dynamic> payload) {
    return DashboardSummary(
      todaySales: _toDouble(payload["todaySales"]),
      transactionCount: _toInt(payload["transactionCount"]),
      averageBasket: _toDouble(payload["averageBasket"]),
      refundTotal: _toDouble(payload["refundTotal"]),
      lowStockAlerts: (payload["lowStockAlerts"] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => LowStockAlert(
              productId: item["productId"]?.toString() ?? "",
              productName: item["productName"]?.toString() ?? "-",
              qty: _toDouble(item["qty"]),
              minStock: _toDouble(item["minStock"]),
              branchName: item["branchName"]?.toString(),
            ),
          )
          .toList(),
      topProducts: (payload["topProducts"] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => TopProductSummary(
              productId: item["productId"]?.toString() ?? "",
              productName: item["productName"]?.toString() ?? "-",
              quantity: _toDouble(item["quantity"]),
              revenue: _toDouble(item["revenue"]),
            ),
          )
          .toList(),
      paymentMethodSummary:
          (payload["paymentMethodSummary"] as Map<String, dynamic>? ?? {}).map(
        (key, value) => MapEntry(key, _toDouble(value)),
      ),
      lastUpdatedAt: _parseDateTime(payload["lastUpdatedAt"]),
    );
  }

  Map<String, dynamic> _productToJson(LocalProduct product) {
    return {
      "id": product.id,
      "name": product.name,
      "barcode": product.barcode,
      "sku": product.sku,
      "categoryName": product.categoryName,
      "salePrice": product.salePrice,
      "purchasePrice": product.purchasePrice,
      "taxRate": product.taxRate,
      "stockTracked": product.stockTracked,
      "minStock": product.minStock,
      "isActive": product.isActive,
      "stockQty": product.stockQty,
      "syncStatus": product.syncStatus,
      "conflictState": product.conflictState,
      "conflictReason": product.conflictReason,
      "pendingVerification": product.pendingVerification,
      "updatedAt": product.updatedAt.toIso8601String(),
    };
  }

  LocalProduct _productFromJson(Map<String, dynamic> payload) {
    return LocalProduct(
      id: payload["id"]?.toString() ?? "",
      name: payload["name"]?.toString() ?? "-",
      barcode: payload["barcode"]?.toString(),
      sku: payload["sku"]?.toString(),
      categoryName: payload["categoryName"]?.toString(),
      salePrice: _toDouble(payload["salePrice"]),
      purchasePrice: _toDouble(payload["purchasePrice"]),
      taxRate: _toDouble(payload["taxRate"]),
      stockTracked: payload["stockTracked"] == true,
      minStock: _toDouble(payload["minStock"]),
      isActive: payload["isActive"] != false,
      stockQty: _toDouble(payload["stockQty"]),
      syncStatus: payload["syncStatus"]?.toString() ?? "synced",
      conflictState: payload["conflictState"]?.toString() ?? "none",
      conflictReason: payload["conflictReason"]?.toString(),
      pendingVerification: payload["pendingVerification"] == true,
      updatedAt: _parseDateTime(payload["updatedAt"]) ?? DateTime.now().toUtc(),
    );
  }

  List<LocalProduct> _productsFromCache(Map<String, dynamic> payload) {
    final items = payload["products"] as List<dynamic>? ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(_productFromJson)
        .toList();
  }

  Map<String, dynamic> _activityToJson(ActivityFeedItem item) {
    return {
      "id": item.id,
      "type": item.type,
      "title": item.title,
      "subtitle": item.subtitle,
      "branchName": item.branchName,
      "actorName": item.actorName,
      "amount": item.amount,
      "qtyImpact": item.qtyImpact,
      "createdAt": item.createdAt.toIso8601String(),
      "syncState": item.syncState,
    };
  }

  List<ActivityFeedItem> _activitiesFromCache(Map<String, dynamic> payload) {
    final items = payload["items"] as List<dynamic>? ?? [];
    return items.whereType<Map<String, dynamic>>().map((item) {
      return ActivityFeedItem(
        id: item["id"]?.toString() ?? _uuid(),
        type: item["type"]?.toString() ?? "info",
        title: item["title"]?.toString() ?? "-",
        subtitle: item["subtitle"]?.toString() ?? "",
        branchName: item["branchName"]?.toString(),
        actorName: item["actorName"]?.toString(),
        amount: _nullableDouble(item["amount"]),
        qtyImpact: _nullableDouble(item["qtyImpact"]),
        createdAt: _parseDateTime(item["createdAt"]) ?? DateTime.now().toUtc(),
        syncState: item["syncState"]?.toString() ?? "synced",
      );
    }).toList();
  }

  Map<String, dynamic> _branchToJson(LocalBranch branch) {
    return {
      "id": branch.id,
      "name": branch.name,
      "isAssigned": branch.isAssigned,
      "isSelected": branch.isSelected,
      "settingsJson": branch.settingsJson,
      "updatedAt": branch.updatedAt.toIso8601String(),
    };
  }

  List<LocalBranch> _branchesFromCache(Map<String, dynamic> payload) {
    final rows = payload["branches"] as List<dynamic>? ?? [];
    return rows.whereType<Map<String, dynamic>>().map((item) {
      return LocalBranch(
        id: item["id"]?.toString() ?? "",
        name: item["name"]?.toString() ?? "-",
        isAssigned: item["isAssigned"] != false,
        isSelected: item["isSelected"] == true,
        settingsJson: item["settingsJson"]?.toString() ?? "{}",
        updatedAt: _parseDateTime(item["updatedAt"]) ?? DateTime.now().toUtc(),
      );
    }).toList();
  }

  DateTime _calculateOfflineGrace(DateTime? licenseExpiresAt) {
    final now = DateTime.now().toUtc();
    final defaultGrace = now.add(const Duration(days: kOfflineGraceDays));
    if (licenseExpiresAt == null) {
      return defaultGrace;
    }
    return licenseExpiresAt.isBefore(defaultGrace)
        ? licenseExpiresAt
        : defaultGrace;
  }
}

String _stockCountSubmitMessage(ApiErrorKind kind) {
  switch (kind) {
    case ApiErrorKind.validation:
      return "Sayim verisi dogrulanamadi (422). Alanlari kontrol edip tekrar deneyin.";
    case ApiErrorKind.timeout:
      return "Sayim aktarimi zaman asimina ugradi. Islem tamamlanmadi, tekrar deneyin.";
    case ApiErrorKind.network:
      return "Baglanti kurulamadigi icin sayim aktarimi tamamlanmadi. Tekrar deneyin.";
    case ApiErrorKind.server:
      return "Sunucu su an sayim aktarimini tamamlayamiyor. Biraz sonra tekrar deneyin.";
    case ApiErrorKind.forbidden:
      return "Bu sayim islemi icin yetkiniz bulunmuyor (403).";
    case ApiErrorKind.unauthorized:
      return "Oturum suresi doldu. Lutfen tekrar giris yapin.";
    case ApiErrorKind.notFound:
      return "Sayim kaydi veya hedef kaynak bulunamadi.";
    case ApiErrorKind.contract:
      return "Sunucudan beklenmeyen cevap alindi. Lutfen tekrar deneyin.";
    case ApiErrorKind.unknown:
      return "Sayim aktarimi tamamlanamadi. Lutfen tekrar deneyin.";
  }
}

class AuthExpiredException implements Exception {
  const AuthExpiredException(this.message);

  final String message;

  @override
  String toString() => message;
}

double _toDouble(Object? value) {
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value) ?? 0;
  }
  return 0;
}

double? _nullableDouble(Object? value) {
  if (value == null) {
    return null;
  }
  return _toDouble(value);
}

int _toInt(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value) ?? 0;
  }
  return 0;
}

DateTime? _parseDateTime(Object? value) {
  if (value == null) {
    return null;
  }
  return DateTime.tryParse(value.toString())?.toUtc();
}

List<String> _toStringList(Object? value) {
  if (value is! List) {
    return [];
  }
  return value.map((item) => item.toString()).toList();
}

List<String> _extractAllowedBranchIds(Object? branchesValue) {
  if (branchesValue is! List) {
    return [];
  }
  return branchesValue
      .whereType<Map<String, dynamic>>()
      .map((item) => item["id"]?.toString() ?? "")
      .where((item) => item.isNotEmpty)
      .toList();
}

String _uuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0F) | 0x40;
  bytes[8] = (bytes[8] & 0x3F) | 0x80;
  final hex =
      bytes.map((value) => value.toRadixString(16).padLeft(2, "0")).join();
  return "${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}";
}
