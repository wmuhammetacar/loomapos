import "dart:convert";
import "dart:math";

import "package:loomapos_mobile/core/mobile_constants.dart";
import "package:loomapos_mobile/data/mobile_api_client.dart";
import "package:loomapos_mobile/models/mobile_models.dart";
import "package:loomapos_mobile/store/local_store.dart";

class MobileRepository {
  MobileRepository({
    required LocalStore store,
    required MobileApiClient api,
  })  : _store = store,
        _api = api;

  final LocalStore _store;
  final MobileApiClient _api;

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

    if (!activation.canOperateOffline && session.expiresAt.isBefore(DateTime.now().toUtc())) {
      return AppShellState.initial.copyWith(
        mode: AppRuntimeMode.locked,
        message: "Offline grace suresi doldu. Yeniden baglanip lisansi dogrulayin.",
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
    final accessToken = auth["accessToken"]?.toString() ?? "";
    final refreshToken = auth["refreshToken"]?.toString() ?? "";
    final tenantId = auth["tenantId"]?.toString() ?? "";
    final roleCode = _firstRole(auth["roles"]) ?? "tenant_owner";

    if (accessToken.isEmpty || tenantId.isEmpty) {
      throw const ApiException(statusCode: 500, message: "Portal session olusturulamadi.");
    }

    final identity = await _api.me(accessToken);
    final license = await _api.getActiveLicense(accessToken);
    final deviceId = (await _store.getActivation())?.deviceId ?? _uuid();
    final activationResponse = await _api.activateMobileDevice(
      licenseKey: license["licenseKey"]?.toString() ?? "",
      deviceId: deviceId,
      deviceName: "mobile-${deviceId.substring(0, 8)}",
    );

    final session = LocalSession(
      sessionId: _uuid(),
      userId: identity["customerAccountId"]?.toString() ?? identity["email"]?.toString() ?? email,
      email: identity["email"]?.toString() ?? email,
      fullName: identity["displayName"]?.toString() ?? email,
      tenantId: tenantId,
      roleCode: identity["role"]?.toString() ?? roleCode,
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: _parseDateTime(auth["expiresAt"]) ?? DateTime.now().toUtc().add(const Duration(hours: 12)),
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
      pull,
      tenantId: tenantId,
      defaultBranchId: null,
    );

    final licenseExpiresAt = _parseDateTime(license["expiresAt"]);
    final offlineGraceUntil = _calculateOfflineGrace(licenseExpiresAt);
    final activation = LocalActivation(
      activationId: activationResponse["id"]?.toString() ?? _uuid(),
      tenantId: tenantId,
      userId: session.userId,
      deviceId: deviceId,
      licenseId: activationResponse["licenseId"]?.toString() ?? license["id"]?.toString() ?? "",
      planCode: license["planCode"]?.toString() ?? "starter",
      status: "active",
      activationToken: license["licenseKey"]?.toString() ?? "",
      featureFlags: _toStringList(pull["featureFlags"]),
      permissionActions: _toStringList((pull["permissions"] as Map<String, dynamic>? ?? {})["actions"]),
      allowedBranchIds: _extractAllowedBranchIds(pull["branches"]),
      lastValidationAt: DateTime.now().toUtc(),
      offlineGraceUntil: offlineGraceUntil,
      selectedBranchId: selectedBranchId,
      companyName: identity["companyName"]?.toString(),
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

  Future<SyncDiagnostics> syncNow() async {
    final session = await _store.getActiveSession();
    final activation = await _store.getActivation();
    if (session == null || activation == null || activation.selectedBranchId == null) {
      await _store.refreshSyncDiagnosticsFromOutbox(
        online: false,
        lastError: "Activation veya session eksik.",
        blockedReason: "login_required",
      );
      return _store.getSyncDiagnostics();
    }

    await _store.refreshSyncDiagnosticsFromOutbox(running: true, online: true, clearError: true);
    try {
      final events = await _store.getDispatchableOutboxEvents(limit: kSyncBatchSize);
      if (events.isNotEmpty) {
        final results = await _api.pushOutbox(
          accessToken: session.accessToken,
          tenantId: activation.tenantId,
          branchId: activation.selectedBranchId!,
          deviceId: activation.deviceId,
          events: events,
        );
        final byId = {for (final event in events) event.id: event};
        for (final result in results) {
          final eventId = result["eventId"]?.toString();
          if (eventId == null) {
            continue;
          }
          final event = byId[eventId];
          final status = result["status"]?.toString() ?? "retry_later";
          final message = result["message"]?.toString() ?? status;
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
              if (event != null && event.aggregateType == "stock_count_session") {
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
                errorCode: result["errorCode"]?.toString() ?? "rejected",
                errorMessage: message,
                deadLetter: true,
              );
              if (event != null && event.aggregateType == "stock_count_session") {
                await _store.markStockCountFailed(event.aggregateId, message);
              }
              break;
            case "device_invalid":
            case "license_invalid":
              await _store.markOutboxFailed(
                eventId,
                errorCode: status,
                errorMessage: message,
                deadLetter: true,
              );
              await _store.updateActivation(status: "locked");
              await _store.refreshSyncDiagnosticsFromOutbox(
                blockedReason: status,
                lastError: message,
              );
              break;
            default:
              await _store.markOutboxFailed(
                eventId,
                errorCode: result["errorCode"]?.toString() ?? status,
                errorMessage: message,
                deadLetter: false,
              );
              break;
          }
        }
      }

      final heartbeat = await _api.heartbeat(deviceId: activation.deviceId);
      await _store.updateActivation(
        status: heartbeat["licenseStatus"]?.toString() == "active" ? "active" : activation.status,
        lastValidationAt: DateTime.now().toUtc(),
        offlineGraceUntil: _calculateOfflineGrace(_parseDateTime(heartbeat["expiresAt"])),
      );
      final pull = await _api.pullSync(
        accessToken: session.accessToken,
        tenantId: activation.tenantId,
        deviceId: activation.deviceId,
        branchId: activation.selectedBranchId,
        since: (await _store.getSyncDiagnostics()).lastPullAt,
      );
      await _applyPullSnapshot(
        pull,
        tenantId: activation.tenantId,
        defaultBranchId: activation.selectedBranchId,
      );
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
      await _store.refreshSyncDiagnosticsFromOutbox(
        running: false,
        online: false,
        lastError: error.toString(),
      );
    }

    return _store.getSyncDiagnostics();
  }

  Future<SyncDiagnostics> retryDeadLetter() async {
    await _store.retryDeadLetterEvents();
    return syncNow();
  }

  Future<DashboardSummary> getDashboardSummary() => _store.getDashboardSummary();
  Future<List<ActivityFeedItem>> getActivityFeed() => _store.listRecentActivity();
  Future<List<LocalNotificationRecord>> getNotifications() => _store.listNotifications();
  Future<void> markNotificationRead(String id) => _store.markNotificationRead(id);
  Future<List<LocalProduct>> searchProducts({String? query, String? barcode}) => _store.searchProducts(query: query, barcode: barcode);
  Future<List<LocalProduct>> getConflictProducts() => _store.listConflictProducts();
  Future<List<StockCountSessionRecord>> getStockCountSessions() => _store.listStockCountSessions();
  Future<StockCountSessionRecord?> getStockCountSession(String id) => _store.getStockCountSession(id);
  Future<List<StockCountLineRecord>> getStockCountLines(String id) => _store.listStockCountLines(id);

  Future<StockCountSessionRecord> createStockCountSession({
    required String label,
    required String countType,
    String? notes,
  }) async {
    final session = await _store.getActiveSession();
    final activation = await _store.getActivation();
    final branchId = await _store.getSelectedBranchId();
    if (session == null || activation == null || branchId == null) {
      throw StateError("Aktif session veya branch bulunamadi.");
    }
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

  Future<LocalProduct?> findProductByBarcode(String barcode) => _store.getProductByBarcode(barcode);

  Future<void> submitStockCount(String sessionId) async {
    await _store.submitStockCountSession(sessionId);
    await _store.appendAuditLog(
      actionType: "STOCK_COUNT_SUBMITTED",
      entityType: "stock_count_session",
      entityId: sessionId,
      metadata: {"submittedAt": DateTime.now().toUtc().toIso8601String()},
    );
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

    final eventType = existingId == null ? "PRODUCT_CREATED" : "PRODUCT_UPDATED";
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
            updatedAt: _parseDateTime(item["updatedAt"]) ?? DateTime.now().toUtc(),
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

    final permissionsPayload = payload["permissions"] as Map<String, dynamic>? ?? {};
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
            updatedAt: _parseDateTime(item["updatedAt"]) ?? DateTime.now().toUtc(),
          ),
        )
        .where((item) => item.id.isNotEmpty)
        .toList();
    if (productsPayload.isNotEmpty) {
      await _store.replaceProducts(productsPayload);
    }

    final dashboardPayload = payload["dashboardSummary"] as Map<String, dynamic>? ?? {};
    await _store.saveDashboardSummary(
      DashboardSummary(
        todaySales: _toDouble(dashboardPayload["todaySales"]),
        transactionCount: _toInt(dashboardPayload["transactionCount"]),
        averageBasket: _toDouble(dashboardPayload["averageBasket"]),
        refundTotal: _toDouble(dashboardPayload["refundTotal"]),
        lowStockAlerts: (dashboardPayload["lowStockAlerts"] as List<dynamic>? ?? [])
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
        paymentMethodSummary: (dashboardPayload["paymentMethodSummary"] as Map<String, dynamic>? ?? {})
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
            createdAt: _parseDateTime(item["createdAt"]) ?? DateTime.now().toUtc(),
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
            createdAt: _parseDateTime(item["createdAt"]) ?? DateTime.now().toUtc(),
          ),
        )
        .toList();
    if (notifications.isNotEmpty) {
      await _store.replaceNotifications(notifications);
    }

    return branches.isEmpty ? defaultBranchId : (defaultBranchId ?? branches.first.id);
  }

  DateTime _calculateOfflineGrace(DateTime? licenseExpiresAt) {
    final now = DateTime.now().toUtc();
    final defaultGrace = now.add(const Duration(days: kOfflineGraceDays));
    if (licenseExpiresAt == null) {
      return defaultGrace;
    }
    return licenseExpiresAt.isBefore(defaultGrace) ? licenseExpiresAt : defaultGrace;
  }
}

String? _firstRole(Object? value) {
  if (value is List && value.isNotEmpty) {
    return value.first.toString();
  }
  return null;
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
  final hex = bytes.map((value) => value.toRadixString(16).padLeft(2, "0")).join();
  return "${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}";
}
