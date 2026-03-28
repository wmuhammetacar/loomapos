import "dart:convert";
import "dart:math";

import "package:loomapos_mobile/models/mobile_models.dart";

class LocalStore {
  LocalStore._();

  static Future<LocalStore> open({bool inMemory = false}) async =>
      LocalStore._();

  final Map<String, Object?> _settings = {};
  LocalSession? _session;
  LocalActivation? _activation;
  PermissionSnapshot _permissions = PermissionSnapshot.empty;
  final Map<String, LocalBranch> _branches = {};
  final Map<String, LocalProduct> _products = {};
  final Map<String, StockCountSessionRecord> _sessions = {};
  final Map<String, StockCountLineRecord> _lines = {};
  final Map<String, ActivityFeedItem> _activity = {};
  final Map<String, LocalNotificationRecord> _notifications = {};
  final Map<String, LocalOutboxEvent> _outbox = {};
  DashboardSummary _dashboard = DashboardSummary.empty;
  SyncDiagnostics _sync = SyncDiagnostics.initial;
  final Map<String, Map<String, dynamic>> _readCaches = {};

  Future<void> init() async {}
  Future<void> close() async {}

  Future<void> seedDemoData() async {
    if (_products.isNotEmpty) {
      return;
    }
    final now = DateTime.now().toUtc();
    await replaceBranches([
      LocalBranch(
        id: "00000000-0000-0000-0000-000000000001",
        name: "Merkez Sube",
        isAssigned: true,
        isSelected: true,
        settingsJson: "{}",
        updatedAt: now,
      ),
    ], selectedBranchId: "00000000-0000-0000-0000-000000000001");
    await replaceProducts([
      LocalProduct(
        id: "30000000-0000-0000-0000-000000000001",
        name: "Su 0.5L",
        barcode: "869000000001",
        sku: "SU-05",
        categoryName: "Icecek",
        salePrice: 10,
        purchasePrice: 6,
        taxRate: 10,
        stockTracked: true,
        minStock: 6,
        isActive: true,
        stockQty: 12,
        syncStatus: "synced",
        conflictState: "none",
        conflictReason: null,
        pendingVerification: false,
        updatedAt: now,
      ),
    ]);
  }

  Future<LocalSession?> getActiveSession() async => _session;
  Future<void> saveSession(LocalSession session) async => _session = session;
  Future<void> clearSession() async => _session = null;
  Future<LocalActivation?> getActivation() async => _activation;
  Future<void> saveActivation(LocalActivation activation) async =>
      _activation = activation;
  Future<void> clearActivation() async => _activation = null;

  Future<void> updateActivation({
    String? status,
    DateTime? lastValidationAt,
    DateTime? offlineGraceUntil,
    String? selectedBranchId,
  }) async {
    final current = _activation;
    if (current == null) {
      return;
    }
    _activation = LocalActivation(
      activationId: current.activationId,
      tenantId: current.tenantId,
      userId: current.userId,
      deviceId: current.deviceId,
      licenseId: current.licenseId,
      planCode: current.planCode,
      status: status ?? current.status,
      activationToken: current.activationToken,
      featureFlags: current.featureFlags,
      permissionActions: current.permissionActions,
      allowedBranchIds: current.allowedBranchIds,
      lastValidationAt: lastValidationAt ?? current.lastValidationAt,
      offlineGraceUntil: offlineGraceUntil ?? current.offlineGraceUntil,
      selectedBranchId: selectedBranchId ?? current.selectedBranchId,
      companyName: current.companyName,
      licenseExpiresAt: current.licenseExpiresAt,
    );
  }

  Future<void> saveUser({
    required String userId,
    required String fullName,
    required String email,
    String? phone,
    required String roleCode,
    required String status,
  }) async {}

  Future<void> replacePermissions(PermissionSnapshot snapshot) async =>
      _permissions = snapshot;
  Future<PermissionSnapshot> getPermissions() async => _permissions;

  Future<List<LocalBranch>> listBranches() async => _branches.values.toList();

  Future<void> replaceBranches(
    List<LocalBranch> branches, {
    String? selectedBranchId,
  }) async {
    _branches
      ..clear()
      ..addEntries(
        branches.map(
          (branch) => MapEntry(
            branch.id,
            LocalBranch(
              id: branch.id,
              name: branch.name,
              isAssigned: branch.isAssigned,
              isSelected: selectedBranchId == branch.id,
              settingsJson: branch.settingsJson,
              updatedAt: branch.updatedAt,
            ),
          ),
        ),
      );
    _settings["selected_branch_id"] = selectedBranchId;
  }

  Future<void> selectBranch(String branchId) async {
    _settings["selected_branch_id"] = branchId;
    if (_activation != null) {
      await updateActivation(selectedBranchId: branchId);
    }
    final currentBranches = _branches.values.toList();
    _branches
      ..clear()
      ..addEntries(
        currentBranches.map(
          (branch) => MapEntry(
            branch.id,
            LocalBranch(
              id: branch.id,
              name: branch.name,
              isAssigned: branch.isAssigned,
              isSelected: branch.id == branchId,
              settingsJson: branch.settingsJson,
              updatedAt: branch.updatedAt,
            ),
          ),
        ),
      );
  }

  Future<String?> getSelectedBranchId() async =>
      _settings["selected_branch_id"]?.toString();

  Future<void> replaceProducts(List<LocalProduct> products) async {
    _products
      ..clear()
      ..addEntries(products.map((product) => MapEntry(product.id, product)));
  }

  Future<List<LocalProduct>> searchProducts({
    String? query,
    String? barcode,
  }) async {
    final term = query?.trim().toLowerCase();
    return _products.values.where((product) {
      if (barcode != null && barcode.trim().isNotEmpty) {
        return product.barcode == barcode.trim();
      }
      if (term == null || term.isEmpty) {
        return true;
      }
      return product.name.toLowerCase().contains(term) ||
          (product.sku?.toLowerCase().contains(term) ?? false) ||
          (product.barcode?.toLowerCase().contains(term) ?? false);
    }).toList();
  }

  Future<LocalProduct?> getProductById(String productId) async =>
      _products[productId];

  Future<LocalProduct?> getProductByBarcode(String barcode) async {
    for (final product in _products.values) {
      if (product.barcode == barcode) {
        return product;
      }
    }
    return null;
  }

  Future<List<LocalProduct>> listConflictProducts() async =>
      _products.values.where((product) => product.hasConflict).toList();

  Future<LocalProduct> saveLocalProduct({
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
    required String syncStatus,
    required String conflictState,
    String? conflictReason,
    required bool pendingVerification,
    String? outboxEventType,
    Map<String, dynamic>? outboxPayload,
  }) async {
    final product = LocalProduct(
      id: existingId ?? _uuid(),
      name: name,
      barcode: barcode,
      sku: sku,
      categoryName: categoryName,
      salePrice: salePrice,
      purchasePrice: purchasePrice,
      taxRate: taxRate,
      stockTracked: stockTracked,
      minStock: minStock,
      isActive: isActive,
      stockQty: stockQty,
      syncStatus: syncStatus,
      conflictState: conflictState,
      conflictReason: conflictReason,
      pendingVerification: pendingVerification,
      updatedAt: DateTime.now().toUtc(),
    );
    _products[product.id] = product;
    if (outboxEventType != null && outboxPayload != null) {
      await appendOutboxEvent(
        eventType: outboxEventType,
        aggregateType: "product",
        aggregateId: product.id,
        payload: outboxPayload,
      );
    }
    return product;
  }

  Future<void> markProductSyncStatus(
    String productId, {
    required String syncStatus,
    required String conflictState,
    String? conflictReason,
    required bool pendingVerification,
  }) async {
    final current = _products[productId];
    if (current == null) {
      return;
    }
    _products[productId] = LocalProduct(
      id: current.id,
      name: current.name,
      barcode: current.barcode,
      sku: current.sku,
      categoryName: current.categoryName,
      salePrice: current.salePrice,
      purchasePrice: current.purchasePrice,
      taxRate: current.taxRate,
      stockTracked: current.stockTracked,
      minStock: current.minStock,
      isActive: current.isActive,
      stockQty: current.stockQty,
      syncStatus: syncStatus,
      conflictState: conflictState,
      conflictReason: conflictReason,
      pendingVerification: pendingVerification,
      updatedAt: DateTime.now().toUtc(),
    );
  }

  Future<StockCountSessionRecord> createStockCountSession({
    required String tenantId,
    required String branchId,
    required String label,
    required String countType,
    required String startedBy,
    String? notes,
  }) async {
    final record = StockCountSessionRecord(
      id: _uuid(),
      tenantId: tenantId,
      branchId: branchId,
      label: label,
      countType: countType,
      status: "draft",
      startedBy: startedBy,
      startedAt: DateTime.now().toUtc(),
      submittedAt: null,
      notes: notes,
      lastError: null,
      lineCount: 0,
    );
    _sessions[record.id] = record;
    return record;
  }

  Future<List<StockCountSessionRecord>> listStockCountSessions() async =>
      _sessions.values.toList();
  Future<StockCountSessionRecord?> getStockCountSession(
    String sessionId,
  ) async => _sessions[sessionId];
  Future<List<StockCountLineRecord>> listStockCountLines(
    String sessionId,
  ) async =>
      _lines.values.where((line) => line.sessionId == sessionId).toList();

  Future<void> upsertStockCountLine({
    String? lineId,
    required String sessionId,
    required String productId,
    String? variantId,
    String? barcodeSnapshot,
    required String productNameSnapshot,
    double? expectedQtySnapshot,
    required double countedQty,
    String? note,
    bool mergeOnProduct = true,
  }) async {
    var effectiveId = lineId ?? _uuid();
    var mergedQty = countedQty;
    if (mergeOnProduct && lineId == null) {
      StockCountLineRecord? existing;
      for (final line in _lines.values) {
        if (line.sessionId == sessionId && line.productId == productId) {
          existing = line;
          break;
        }
      }
      if (existing != null) {
        effectiveId = existing.id;
        mergedQty += existing.countedQty;
      }
    }

    _lines[effectiveId] = StockCountLineRecord(
      id: effectiveId,
      sessionId: sessionId,
      productId: productId,
      variantId: variantId,
      barcodeSnapshot: barcodeSnapshot,
      productNameSnapshot: productNameSnapshot,
      expectedQtySnapshot: expectedQtySnapshot,
      countedQty: mergedQty,
      deltaQty: expectedQtySnapshot == null
          ? null
          : mergedQty - expectedQtySnapshot,
      note: note,
      createdAt: DateTime.now().toUtc(),
      updatedAt: DateTime.now().toUtc(),
    );

    final current = _sessions[sessionId];
    if (current != null && current.status == "draft") {
      _sessions[sessionId] = StockCountSessionRecord(
        id: current.id,
        tenantId: current.tenantId,
        branchId: current.branchId,
        label: current.label,
        countType: current.countType,
        status: "in_progress",
        startedBy: current.startedBy,
        startedAt: current.startedAt,
        submittedAt: current.submittedAt,
        notes: current.notes,
        lastError: current.lastError,
        lineCount: current.lineCount,
      );
    }
  }

  Future<void> removeStockCountLine(String lineId) async =>
      _lines.remove(lineId);

  Future<void> submitStockCountSession(String sessionId) async {
    final current = _sessions[sessionId];
    if (current == null) {
      return;
    }
    final submittedAt = DateTime.now().toUtc();
    _sessions[sessionId] = StockCountSessionRecord(
      id: current.id,
      tenantId: current.tenantId,
      branchId: current.branchId,
      label: current.label,
      countType: current.countType,
      status: "submitted",
      startedBy: current.startedBy,
      startedAt: current.startedAt,
      submittedAt: submittedAt,
      notes: current.notes,
      lastError: null,
      lineCount: current.lineCount,
    );
    await appendOutboxEvent(
      eventType: "STOCK_COUNT_SUBMITTED",
      aggregateType: "stock_count_session",
      aggregateId: sessionId,
      payload: {
        "stockCountSessionId": sessionId,
        "tenantId": current.tenantId,
        "branchId": current.branchId,
        "countType": current.countType,
        "label": current.label,
        "startedBy": current.startedBy,
        "startedAt": current.startedAt.toIso8601String(),
        "submittedAt": submittedAt.toIso8601String(),
        "notes": current.notes,
        "lines": _lines.values
            .where((line) => line.sessionId == sessionId)
            .map(
              (line) => {
                "lineId": line.id,
                "productId": line.productId,
                "variantId": line.variantId,
                "barcodeSnapshot": line.barcodeSnapshot,
                "productNameSnapshot": line.productNameSnapshot,
                "expectedQtySnapshot": line.expectedQtySnapshot,
                "countedQty": line.countedQty,
                "deltaQty": line.deltaQty,
                "note": line.note,
              },
            )
            .toList(),
      },
    );
  }

  Future<void> markStockCountSynced(String sessionId) async {
    final current = _sessions[sessionId];
    if (current == null) {
      return;
    }
    _sessions[sessionId] = StockCountSessionRecord(
      id: current.id,
      tenantId: current.tenantId,
      branchId: current.branchId,
      label: current.label,
      countType: current.countType,
      status: "synced",
      startedBy: current.startedBy,
      startedAt: current.startedAt,
      submittedAt: current.submittedAt,
      notes: current.notes,
      lastError: null,
      lineCount: current.lineCount,
    );
  }

  Future<void> markStockCountFailed(String sessionId, String message) async {
    final current = _sessions[sessionId];
    if (current == null) {
      return;
    }
    _sessions[sessionId] = StockCountSessionRecord(
      id: current.id,
      tenantId: current.tenantId,
      branchId: current.branchId,
      label: current.label,
      countType: current.countType,
      status: "failed",
      startedBy: current.startedBy,
      startedAt: current.startedAt,
      submittedAt: current.submittedAt,
      notes: current.notes,
      lastError: message,
      lineCount: current.lineCount,
    );
  }

  Future<void> replaceRecentActivity(List<ActivityFeedItem> items) async =>
      _replaceById(_activity, items, (item) => item.id);
  Future<List<ActivityFeedItem>> listRecentActivity({int limit = 50}) async =>
      _activity.values.take(limit).toList();
  Future<void> replaceNotifications(
    List<LocalNotificationRecord> notifications,
  ) async => _replaceById(_notifications, notifications, (item) => item.id);
  Future<List<LocalNotificationRecord>> listNotifications() async =>
      _notifications.values.toList();

  Future<void> markNotificationRead(String notificationId) async {
    final current = _notifications[notificationId];
    if (current == null) {
      return;
    }
    _notifications[notificationId] = LocalNotificationRecord(
      id: current.id,
      category: current.category,
      title: current.title,
      body: current.body,
      targetRoute: current.targetRoute,
      isRead: true,
      createdAt: current.createdAt,
    );
  }

  Future<void> saveDashboardSummary(DashboardSummary summary) async =>
      _dashboard = summary;
  Future<DashboardSummary> getDashboardSummary() async => _dashboard;

  Future<void> saveReadCache(
    String cacheKey,
    Map<String, dynamic> payload,
  ) async {
    _readCaches[cacheKey] = <String, dynamic>{
      ...payload,
      "_cachedAt": DateTime.now().toUtc().toIso8601String(),
    };
  }

  Future<Map<String, dynamic>?> getReadCache(String cacheKey) async {
    return _readCaches[cacheKey];
  }

  Future<void> appendOutboxEvent({
    required String eventType,
    required String aggregateType,
    required String aggregateId,
    required Map<String, dynamic> payload,
    int payloadVersion = 1,
  }) async {
    final eventId = _uuid();
    _outbox[eventId] = LocalOutboxEvent(
      id: eventId,
      eventType: eventType,
      aggregateType: aggregateType,
      aggregateId: aggregateId,
      payloadJson: jsonEncode(payload),
      payloadVersion: payloadVersion,
      createdAt: DateTime.now().toUtc(),
      status: "pending",
      retryCount: 0,
      nextRetryAt: null,
      errorCode: null,
      errorMessage: null,
    );
  }

  Future<List<LocalOutboxEvent>> getDispatchableOutboxEvents({
    int limit = 20,
  }) async => _outbox.values
      .where((event) => event.status != "sent")
      .take(limit)
      .toList();

  Future<void> markOutboxSent(String eventId) async {
    final current = _outbox[eventId];
    if (current == null) {
      return;
    }
    _outbox[eventId] = LocalOutboxEvent(
      id: current.id,
      eventType: current.eventType,
      aggregateType: current.aggregateType,
      aggregateId: current.aggregateId,
      payloadJson: current.payloadJson,
      payloadVersion: current.payloadVersion,
      createdAt: current.createdAt,
      status: "sent",
      retryCount: current.retryCount,
      nextRetryAt: null,
      errorCode: null,
      errorMessage: null,
    );
  }

  Future<void> markOutboxFailed(
    String eventId, {
    required String errorCode,
    required String errorMessage,
    required bool deadLetter,
  }) async {
    final current = _outbox[eventId];
    if (current == null) {
      return;
    }
    _outbox[eventId] = LocalOutboxEvent(
      id: current.id,
      eventType: current.eventType,
      aggregateType: current.aggregateType,
      aggregateId: current.aggregateId,
      payloadJson: current.payloadJson,
      payloadVersion: current.payloadVersion,
      createdAt: current.createdAt,
      status: deadLetter ? "dead_letter" : "failed",
      retryCount: current.retryCount + 1,
      nextRetryAt: DateTime.now().toUtc().add(const Duration(seconds: 5)),
      errorCode: errorCode,
      errorMessage: errorMessage,
    );
  }

  Future<void> markOutboxConflict(
    String eventId, {
    required String errorMessage,
  }) async {
    await markOutboxFailed(
      eventId,
      errorCode: "conflict",
      errorMessage: errorMessage,
      deadLetter: true,
    );
  }

  Future<void> retryDeadLetterEvents() async {
    final deadEvents = _outbox.values
        .where((event) => event.status == "dead_letter")
        .toList();
    for (final event in deadEvents) {
      _outbox[event.id] = LocalOutboxEvent(
        id: event.id,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payloadJson: event.payloadJson,
        payloadVersion: event.payloadVersion,
        createdAt: event.createdAt,
        status: "failed",
        retryCount: event.retryCount,
        nextRetryAt: DateTime.now().toUtc(),
        errorCode: null,
        errorMessage: null,
      );
    }
  }

  Future<SyncDiagnostics> getSyncDiagnostics() async => _sync;
  Future<void> saveSyncDiagnostics(SyncDiagnostics diagnostics) async =>
      _sync = diagnostics;

  Future<void> refreshSyncDiagnosticsFromOutbox({
    bool? running,
    bool? online,
    DateTime? lastSuccessfulSyncAt,
    DateTime? lastPullAt,
    DateTime? lastHeartbeatAt,
    String? lastError,
    String? blockedReason,
    bool clearError = false,
  }) async {
    final pending = _outbox.values
        .where((event) => event.status == "pending")
        .length;
    final failed = _outbox.values
        .where((event) => event.status == "failed")
        .length;
    final deadLetter = _outbox.values
        .where((event) => event.status == "dead_letter")
        .length;
    _sync = _sync.copyWith(
      running: running,
      online: online,
      pendingCount: pending,
      failedCount: failed,
      deadLetterCount: deadLetter,
      lastSuccessfulSyncAt: lastSuccessfulSyncAt,
      lastPullAt: lastPullAt,
      lastHeartbeatAt: lastHeartbeatAt,
      lastError: lastError,
      blockedReason: blockedReason,
      clearError: clearError,
    );
  }

  Future<void> appendAuditLog({
    required String actionType,
    required String entityType,
    required String entityId,
    required Map<String, dynamic> metadata,
    String syncStatus = "pending",
  }) async {}
}

void _replaceById<T>(
  Map<String, T> target,
  List<T> values,
  String Function(T) idOf,
) {
  target
    ..clear()
    ..addEntries(values.map((value) => MapEntry(idOf(value), value)));
}

String _uuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0F) | 0x40;
  bytes[8] = (bytes[8] & 0x3F) | 0x80;
  final hex = bytes
      .map((value) => value.toRadixString(16).padLeft(2, "0"))
      .join();
  return "${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}";
}
