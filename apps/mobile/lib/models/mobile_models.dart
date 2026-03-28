enum AppRuntimeMode { booting, needsLogin, ready, locked }

class LocalSession {
  const LocalSession({
    required this.sessionId,
    required this.userId,
    required this.email,
    required this.fullName,
    required this.tenantId,
    required this.roleCode,
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.lastLoginAt,
    required this.status,
  });

  final String sessionId;
  final String userId;
  final String email;
  final String fullName;
  final String tenantId;
  final String roleCode;
  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;
  final DateTime lastLoginAt;
  final String status;
}

class LocalActivation {
  const LocalActivation({
    required this.activationId,
    required this.tenantId,
    required this.userId,
    required this.deviceId,
    required this.licenseId,
    required this.planCode,
    required this.status,
    required this.activationToken,
    required this.featureFlags,
    required this.permissionActions,
    required this.allowedBranchIds,
    required this.lastValidationAt,
    required this.offlineGraceUntil,
    required this.selectedBranchId,
    required this.companyName,
    required this.licenseExpiresAt,
  });

  final String activationId;
  final String tenantId;
  final String userId;
  final String deviceId;
  final String licenseId;
  final String planCode;
  final String status;
  final String activationToken;
  final List<String> featureFlags;
  final List<String> permissionActions;
  final List<String> allowedBranchIds;
  final DateTime lastValidationAt;
  final DateTime offlineGraceUntil;
  final String? selectedBranchId;
  final String? companyName;
  final DateTime? licenseExpiresAt;

  bool get canOperateOffline => DateTime.now().isBefore(offlineGraceUntil);
}

class PermissionSnapshot {
  const PermissionSnapshot({
    required this.roleCode,
    required this.actions,
    required this.allowedBranchIds,
  });

  final String roleCode;
  final Set<String> actions;
  final Set<String> allowedBranchIds;

  bool can(String action) => actions.contains(action);

  static const empty = PermissionSnapshot(
    roleCode: "unknown",
    actions: <String>{},
    allowedBranchIds: <String>{},
  );
}

class LocalBranch {
  const LocalBranch({
    required this.id,
    required this.name,
    required this.isAssigned,
    required this.isSelected,
    required this.settingsJson,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final bool isAssigned;
  final bool isSelected;
  final String settingsJson;
  final DateTime updatedAt;
}

class LocalProduct {
  const LocalProduct({
    required this.id,
    required this.name,
    required this.barcode,
    required this.sku,
    required this.categoryName,
    required this.salePrice,
    required this.purchasePrice,
    required this.taxRate,
    required this.stockTracked,
    required this.minStock,
    required this.isActive,
    required this.stockQty,
    required this.syncStatus,
    required this.conflictState,
    required this.conflictReason,
    required this.pendingVerification,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final String? barcode;
  final String? sku;
  final String? categoryName;
  final double salePrice;
  final double purchasePrice;
  final double taxRate;
  final bool stockTracked;
  final double minStock;
  final bool isActive;
  final double stockQty;
  final String syncStatus;
  final String conflictState;
  final String? conflictReason;
  final bool pendingVerification;
  final DateTime updatedAt;

  bool get hasConflict => conflictState != "none";
  bool get isLowStock => stockTracked && stockQty <= minStock;
}

class StockCountSessionRecord {
  const StockCountSessionRecord({
    required this.id,
    required this.tenantId,
    required this.branchId,
    required this.label,
    required this.countType,
    required this.status,
    required this.startedBy,
    required this.startedAt,
    required this.submittedAt,
    required this.notes,
    required this.lastError,
    required this.lineCount,
  });

  final String id;
  final String tenantId;
  final String branchId;
  final String label;
  final String countType;
  final String status;
  final String startedBy;
  final DateTime startedAt;
  final DateTime? submittedAt;
  final String? notes;
  final String? lastError;
  final int lineCount;
}

class StockCountLineRecord {
  const StockCountLineRecord({
    required this.id,
    required this.sessionId,
    required this.productId,
    required this.variantId,
    required this.barcodeSnapshot,
    required this.productNameSnapshot,
    required this.expectedQtySnapshot,
    required this.countedQty,
    required this.deltaQty,
    required this.note,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String sessionId;
  final String productId;
  final String? variantId;
  final String? barcodeSnapshot;
  final String productNameSnapshot;
  final double? expectedQtySnapshot;
  final double countedQty;
  final double? deltaQty;
  final String? note;
  final DateTime createdAt;
  final DateTime updatedAt;
}

class DashboardSummary {
  const DashboardSummary({
    required this.todaySales,
    required this.transactionCount,
    required this.averageBasket,
    required this.refundTotal,
    required this.lowStockAlerts,
    required this.topProducts,
    required this.paymentMethodSummary,
    required this.lastUpdatedAt,
  });

  final double todaySales;
  final int transactionCount;
  final double averageBasket;
  final double refundTotal;
  final List<LowStockAlert> lowStockAlerts;
  final List<TopProductSummary> topProducts;
  final Map<String, double> paymentMethodSummary;
  final DateTime? lastUpdatedAt;

  static const empty = DashboardSummary(
    todaySales: 0,
    transactionCount: 0,
    averageBasket: 0,
    refundTotal: 0,
    lowStockAlerts: <LowStockAlert>[],
    topProducts: <TopProductSummary>[],
    paymentMethodSummary: <String, double>{},
    lastUpdatedAt: null,
  );
}

class LowStockAlert {
  const LowStockAlert({
    required this.productId,
    required this.productName,
    required this.qty,
    required this.minStock,
    required this.branchName,
  });

  final String productId;
  final String productName;
  final double qty;
  final double minStock;
  final String? branchName;
}

class TopProductSummary {
  const TopProductSummary({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.revenue,
  });

  final String productId;
  final String productName;
  final double quantity;
  final double revenue;
}

class ActivityFeedItem {
  const ActivityFeedItem({
    required this.id,
    required this.type,
    required this.title,
    required this.subtitle,
    required this.branchName,
    required this.actorName,
    required this.amount,
    required this.qtyImpact,
    required this.createdAt,
    required this.syncState,
  });

  final String id;
  final String type;
  final String title;
  final String subtitle;
  final String? branchName;
  final String? actorName;
  final double? amount;
  final double? qtyImpact;
  final DateTime createdAt;
  final String syncState;
}

class LocalNotificationRecord {
  const LocalNotificationRecord({
    required this.id,
    required this.category,
    required this.title,
    required this.body,
    required this.targetRoute,
    required this.isRead,
    required this.createdAt,
  });

  final String id;
  final String category;
  final String title;
  final String body;
  final String? targetRoute;
  final bool isRead;
  final DateTime createdAt;
}

class LocalOutboxEvent {
  const LocalOutboxEvent({
    required this.id,
    required this.eventType,
    required this.aggregateType,
    required this.aggregateId,
    required this.payloadJson,
    required this.payloadVersion,
    required this.createdAt,
    required this.status,
    required this.retryCount,
    required this.nextRetryAt,
    required this.errorCode,
    required this.errorMessage,
  });

  final String id;
  final String eventType;
  final String aggregateType;
  final String aggregateId;
  final String payloadJson;
  final int payloadVersion;
  final DateTime createdAt;
  final String status;
  final int retryCount;
  final DateTime? nextRetryAt;
  final String? errorCode;
  final String? errorMessage;
}

class SyncDiagnostics {
  const SyncDiagnostics({
    required this.running,
    required this.online,
    required this.pendingCount,
    required this.failedCount,
    required this.deadLetterCount,
    required this.lastSuccessfulSyncAt,
    required this.lastPullAt,
    required this.lastHeartbeatAt,
    required this.lastError,
    required this.blockedReason,
  });

  final bool running;
  final bool online;
  final int pendingCount;
  final int failedCount;
  final int deadLetterCount;
  final DateTime? lastSuccessfulSyncAt;
  final DateTime? lastPullAt;
  final DateTime? lastHeartbeatAt;
  final String? lastError;
  final String? blockedReason;

  SyncDiagnostics copyWith({
    bool? running,
    bool? online,
    int? pendingCount,
    int? failedCount,
    int? deadLetterCount,
    DateTime? lastSuccessfulSyncAt,
    DateTime? lastPullAt,
    DateTime? lastHeartbeatAt,
    String? lastError,
    String? blockedReason,
    bool clearError = false,
  }) {
    return SyncDiagnostics(
      running: running ?? this.running,
      online: online ?? this.online,
      pendingCount: pendingCount ?? this.pendingCount,
      failedCount: failedCount ?? this.failedCount,
      deadLetterCount: deadLetterCount ?? this.deadLetterCount,
      lastSuccessfulSyncAt: lastSuccessfulSyncAt ?? this.lastSuccessfulSyncAt,
      lastPullAt: lastPullAt ?? this.lastPullAt,
      lastHeartbeatAt: lastHeartbeatAt ?? this.lastHeartbeatAt,
      lastError: clearError ? null : (lastError ?? this.lastError),
      blockedReason: blockedReason ?? this.blockedReason,
    );
  }

  static const initial = SyncDiagnostics(
    running: false,
    online: false,
    pendingCount: 0,
    failedCount: 0,
    deadLetterCount: 0,
    lastSuccessfulSyncAt: null,
    lastPullAt: null,
    lastHeartbeatAt: null,
    lastError: null,
    blockedReason: null,
  );
}

class AppShellState {
  const AppShellState({
    required this.mode,
    required this.busy,
    required this.message,
    required this.session,
    required this.activation,
    required this.permissions,
    required this.branches,
    required this.selectedBranchId,
    required this.syncDiagnostics,
  });

  final AppRuntimeMode mode;
  final bool busy;
  final String? message;
  final LocalSession? session;
  final LocalActivation? activation;
  final PermissionSnapshot permissions;
  final List<LocalBranch> branches;
  final String? selectedBranchId;
  final SyncDiagnostics syncDiagnostics;

  LocalBranch? get selectedBranch {
    if (selectedBranchId == null) {
      return branches.isEmpty ? null : branches.first;
    }

    for (final branch in branches) {
      if (branch.id == selectedBranchId) {
        return branch;
      }
    }
    return branches.isEmpty ? null : branches.first;
  }

  AppShellState copyWith({
    AppRuntimeMode? mode,
    bool? busy,
    String? message,
    LocalSession? session,
    LocalActivation? activation,
    PermissionSnapshot? permissions,
    List<LocalBranch>? branches,
    String? selectedBranchId,
    SyncDiagnostics? syncDiagnostics,
    bool clearMessage = false,
  }) {
    return AppShellState(
      mode: mode ?? this.mode,
      busy: busy ?? this.busy,
      message: clearMessage ? null : (message ?? this.message),
      session: session ?? this.session,
      activation: activation ?? this.activation,
      permissions: permissions ?? this.permissions,
      branches: branches ?? this.branches,
      selectedBranchId: selectedBranchId ?? this.selectedBranchId,
      syncDiagnostics: syncDiagnostics ?? this.syncDiagnostics,
    );
  }

  static const initial = AppShellState(
    mode: AppRuntimeMode.booting,
    busy: false,
    message: null,
    session: null,
    activation: null,
    permissions: PermissionSnapshot.empty,
    branches: <LocalBranch>[],
    selectedBranchId: null,
    syncDiagnostics: SyncDiagnostics.initial,
  );
}

class CachedRead<T> {
  const CachedRead({
    required this.data,
    required this.isStale,
    required this.source,
    required this.cachedAt,
  });

  final T data;
  final bool isStale;
  final String source;
  final DateTime? cachedAt;
}
