import "dart:convert";
import "dart:io";
import "dart:math";

import "package:drift/drift.dart";
import "package:drift/native.dart";
import "package:loomapos_mobile/models/mobile_models.dart";
import "package:path/path.dart" as p;
import "package:path_provider/path_provider.dart";

class LocalStore {
  LocalStore._(this._db);

  final _RawDatabase _db;

  static Future<LocalStore> open({bool inMemory = false}) async {
    if (inMemory) {
      return LocalStore._(_RawDatabase(NativeDatabase.memory()));
    }

    final dir = await getApplicationDocumentsDirectory();
    return LocalStore._(
      _RawDatabase(
        NativeDatabase(File(p.join(dir.path, "loomapos-mobile.db"))),
      ),
    );
  }

  Future<void> init() async {
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_session(session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, email TEXT NOT NULL, full_name TEXT NOT NULL, tenant_id TEXT NOT NULL, role_code TEXT NOT NULL, access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, expires_at TEXT NOT NULL, last_login_at TEXT NOT NULL, status TEXT NOT NULL);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_activation(activation_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, device_id TEXT NOT NULL, license_id TEXT NOT NULL, plan_code TEXT NOT NULL, status TEXT NOT NULL, activation_token TEXT NOT NULL, company_name TEXT, license_expires_at TEXT, feature_flags_json TEXT NOT NULL, permission_actions_json TEXT NOT NULL, allowed_branch_ids_json TEXT NOT NULL, last_validation_at TEXT NOT NULL, offline_grace_until TEXT NOT NULL, selected_branch_id TEXT);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_users(user_id TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, role_code TEXT NOT NULL, status TEXT NOT NULL, last_synced_at TEXT NOT NULL);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_permissions(action_key TEXT PRIMARY KEY, allowed INTEGER NOT NULL, role_code TEXT NOT NULL, updated_at TEXT NOT NULL);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_branches(branch_id TEXT PRIMARY KEY, name TEXT NOT NULL, is_assigned INTEGER NOT NULL, is_selected INTEGER NOT NULL, settings_json TEXT NOT NULL, updated_at TEXT NOT NULL);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_products(product_id TEXT PRIMARY KEY, name TEXT NOT NULL, barcode TEXT, sku TEXT, category_name TEXT, sale_price REAL NOT NULL, purchase_price REAL NOT NULL, tax_rate REAL NOT NULL, stock_tracked INTEGER NOT NULL, min_stock REAL NOT NULL, is_active INTEGER NOT NULL, stock_qty REAL NOT NULL, sync_status TEXT NOT NULL, conflict_state TEXT NOT NULL, conflict_reason TEXT, pending_verification INTEGER NOT NULL, updated_at TEXT NOT NULL);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_product_barcodes(barcode TEXT PRIMARY KEY, product_id TEXT NOT NULL);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_stock_snapshot(product_id TEXT NOT NULL, branch_id TEXT NOT NULL, qty REAL NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(product_id, branch_id));",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_stock_count_sessions(local_stock_count_session_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, branch_id TEXT NOT NULL, label TEXT NOT NULL, count_type TEXT NOT NULL, status TEXT NOT NULL, started_by TEXT NOT NULL, started_at TEXT NOT NULL, submitted_at TEXT, notes TEXT, last_error TEXT);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_stock_count_lines(local_stock_count_line_id TEXT PRIMARY KEY, local_stock_count_session_id TEXT NOT NULL, product_id TEXT NOT NULL, variant_id TEXT, barcode_snapshot TEXT, product_name_snapshot TEXT NOT NULL, expected_qty_snapshot REAL, counted_qty REAL NOT NULL, delta_qty REAL, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_recent_sales_cache(item_id TEXT PRIMARY KEY, item_type TEXT NOT NULL, title TEXT NOT NULL, subtitle TEXT NOT NULL, branch_name TEXT, actor_name TEXT, amount REAL, qty_impact REAL, created_at TEXT NOT NULL, sync_state TEXT NOT NULL);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS outbox_events(event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, aggregate_type TEXT NOT NULL, aggregate_id TEXT NOT NULL, payload_json TEXT NOT NULL, payload_version INTEGER NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL, retry_count INTEGER NOT NULL, next_retry_at TEXT, error_code TEXT, error_message TEXT, server_ack_at TEXT);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS sync_state(sync_key TEXT PRIMARY KEY, running INTEGER NOT NULL, online INTEGER NOT NULL, pending_count INTEGER NOT NULL, failed_count INTEGER NOT NULL, dead_letter_count INTEGER NOT NULL, last_successful_sync_at TEXT, last_pull_at TEXT, last_heartbeat_at TEXT, last_error TEXT, blocked_reason TEXT);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_notifications(notification_id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, target_route TEXT, is_read INTEGER NOT NULL, created_at TEXT NOT NULL);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_audit_logs(audit_id TEXT PRIMARY KEY, action_type TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL, sync_status TEXT NOT NULL);",
    );
    await _db.customStatement(
      "CREATE TABLE IF NOT EXISTS local_report_snapshots(snapshot_key TEXT PRIMARY KEY, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL);",
    );

    final row = await _db.customSelect(
      "SELECT sync_key FROM sync_state WHERE sync_key='global' LIMIT 1",
      readsFrom: {},
    ).getSingleOrNull();
    if (row == null) {
      await _db.customStatement(
        "INSERT INTO sync_state(sync_key,running,online,pending_count,failed_count,dead_letter_count,last_successful_sync_at,last_pull_at,last_heartbeat_at,last_error,blocked_reason) VALUES('global',0,0,0,0,0,NULL,NULL,NULL,NULL,NULL)",
      );
    }
  }

  Future<void> close() async {
    await _db.close();
  }

  Future<void> seedDemoData() async {
    final count = await _count("local_products");
    if (count > 0) {
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
      LocalProduct(
        id: "30000000-0000-0000-0000-000000000002",
        name: "Kahve Buyuk",
        barcode: "869000000003",
        sku: "KHV-BYK",
        categoryName: "Icecek",
        salePrice: 95,
        purchasePrice: 62,
        taxRate: 20,
        stockTracked: true,
        minStock: 4,
        isActive: true,
        stockQty: 3,
        syncStatus: "synced",
        conflictState: "none",
        conflictReason: null,
        pendingVerification: false,
        updatedAt: now,
      ),
    ]);
  }

  Future<LocalSession?> getActiveSession() async {
    final row = await _db.customSelect(
      "SELECT * FROM local_session WHERE status='active' ORDER BY last_login_at DESC LIMIT 1",
      readsFrom: {},
    ).getSingleOrNull();
    return row == null ? null : _mapSession(row);
  }

  Future<void> saveSession(LocalSession session) async {
    await _db.transaction(() async {
      await _db.customStatement("DELETE FROM local_session");
      await _db.customStatement(
        "INSERT INTO local_session(session_id,user_id,email,full_name,tenant_id,role_code,access_token,refresh_token,expires_at,last_login_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        [
          session.sessionId,
          session.userId,
          session.email,
          session.fullName,
          session.tenantId,
          session.roleCode,
          session.accessToken,
          session.refreshToken,
          _iso(session.expiresAt),
          _iso(session.lastLoginAt),
          session.status,
        ],
      );
    });
  }

  Future<void> clearSession() async {
    await _db.customStatement("DELETE FROM local_session");
  }

  Future<LocalActivation?> getActivation() async {
    final row = await _db.customSelect("SELECT * FROM local_activation LIMIT 1",
        readsFrom: {}).getSingleOrNull();
    return row == null ? null : _mapActivation(row);
  }

  Future<void> saveActivation(LocalActivation activation) async {
    await _db.transaction(() async {
      await _db.customStatement("DELETE FROM local_activation");
      await _db.customStatement(
        "INSERT INTO local_activation(activation_id,tenant_id,user_id,device_id,license_id,plan_code,status,activation_token,company_name,license_expires_at,feature_flags_json,permission_actions_json,allowed_branch_ids_json,last_validation_at,offline_grace_until,selected_branch_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          activation.activationId,
          activation.tenantId,
          activation.userId,
          activation.deviceId,
          activation.licenseId,
          activation.planCode,
          activation.status,
          activation.activationToken,
          activation.companyName,
          activation.licenseExpiresAt == null
              ? null
              : _iso(activation.licenseExpiresAt!),
          jsonEncode(activation.featureFlags),
          jsonEncode(activation.permissionActions),
          jsonEncode(activation.allowedBranchIds),
          _iso(activation.lastValidationAt),
          _iso(activation.offlineGraceUntil),
          activation.selectedBranchId,
        ],
      );
    });
  }

  Future<void> clearActivation() async {
    await _db.customStatement("DELETE FROM local_activation");
    await _db.customStatement("DELETE FROM local_permissions");
    await _db.customStatement("DELETE FROM local_users");
  }

  Future<void> updateActivation({
    String? status,
    DateTime? lastValidationAt,
    DateTime? offlineGraceUntil,
    String? selectedBranchId,
  }) async {
    final activation = await getActivation();
    if (activation == null) {
      return;
    }

    await saveActivation(
      LocalActivation(
        activationId: activation.activationId,
        tenantId: activation.tenantId,
        userId: activation.userId,
        deviceId: activation.deviceId,
        licenseId: activation.licenseId,
        planCode: activation.planCode,
        status: status ?? activation.status,
        activationToken: activation.activationToken,
        featureFlags: activation.featureFlags,
        permissionActions: activation.permissionActions,
        allowedBranchIds: activation.allowedBranchIds,
        lastValidationAt: lastValidationAt ?? activation.lastValidationAt,
        offlineGraceUntil: offlineGraceUntil ?? activation.offlineGraceUntil,
        selectedBranchId: selectedBranchId ?? activation.selectedBranchId,
        companyName: activation.companyName,
        licenseExpiresAt: activation.licenseExpiresAt,
      ),
    );
  }

  Future<void> saveUser({
    required String userId,
    required String fullName,
    required String email,
    String? phone,
    required String roleCode,
    required String status,
  }) async {
    await _db.customStatement(
      "INSERT INTO local_users(user_id,full_name,email,phone,role_code,status,last_synced_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,email=excluded.email,phone=excluded.phone,role_code=excluded.role_code,status=excluded.status,last_synced_at=excluded.last_synced_at",
      [
        userId,
        fullName,
        email,
        phone,
        roleCode,
        status,
        _iso(DateTime.now().toUtc()),
      ],
    );
  }

  Future<void> replacePermissions(PermissionSnapshot snapshot) async {
    await _db.transaction(() async {
      await _db.customStatement("DELETE FROM local_permissions");
      for (final action in snapshot.actions) {
        await _db.customStatement(
          "INSERT INTO local_permissions(action_key,allowed,role_code,updated_at) VALUES(?,?,?,?)",
          [action, 1, snapshot.roleCode, _iso(DateTime.now().toUtc())],
        );
      }
      await _setSetting(
        "allowed_branch_ids",
        snapshot.allowedBranchIds.toList(),
      );
    });
  }

  Future<PermissionSnapshot> getPermissions() async {
    final rows = await _db.customSelect(
      "SELECT action_key,role_code FROM local_permissions WHERE allowed=1",
      readsFrom: {},
    ).get();
    if (rows.isEmpty) {
      return PermissionSnapshot.empty;
    }
    final allowedBranches =
        (await _getSetting("allowed_branch_ids") as List<dynamic>? ?? [])
            .map((value) => value.toString())
            .toSet();
    return PermissionSnapshot(
      roleCode: rows.first.read<String>("role_code"),
      actions: rows.map((row) => row.read<String>("action_key")).toSet(),
      allowedBranchIds: allowedBranches,
    );
  }

  Future<List<LocalBranch>> listBranches() async {
    final rows = await _db.customSelect(
      "SELECT * FROM local_branches ORDER BY is_selected DESC, name ASC",
      readsFrom: {},
    ).get();
    return rows.map(_mapBranch).toList();
  }

  Future<void> replaceBranches(
    List<LocalBranch> branches, {
    String? selectedBranchId,
  }) async {
    await _db.transaction(() async {
      await _db.customStatement("DELETE FROM local_branches");
      final selection =
          selectedBranchId ?? (branches.isEmpty ? null : branches.first.id);
      for (final branch in branches) {
        await _db.customStatement(
          "INSERT INTO local_branches(branch_id,name,is_assigned,is_selected,settings_json,updated_at) VALUES(?,?,?,?,?,?)",
          [
            branch.id,
            branch.name,
            branch.isAssigned ? 1 : 0,
            branch.id == selection ? 1 : 0,
            branch.settingsJson,
            _iso(branch.updatedAt),
          ],
        );
      }
      if (selection != null) {
        await _setSetting("selected_branch_id", selection);
      }
    });
  }

  Future<void> selectBranch(String branchId) async {
    await _db.transaction(() async {
      await _db.customStatement("UPDATE local_branches SET is_selected=0");
      await _db.customStatement(
        "UPDATE local_branches SET is_selected=1 WHERE branch_id=?",
        [branchId],
      );
      await _setSetting("selected_branch_id", branchId);
      await updateActivation(selectedBranchId: branchId);
    });
  }

  Future<String?> getSelectedBranchId() async {
    final row = await _db.customSelect(
      "SELECT branch_id FROM local_branches WHERE is_selected=1 LIMIT 1",
      readsFrom: {},
    ).getSingleOrNull();
    if (row != null) {
      return row.read<String>("branch_id");
    }
    final value = await _getSetting("selected_branch_id");
    return value?.toString();
  }

  Future<void> replaceProducts(List<LocalProduct> products) async {
    await _db.transaction(() async {
      await _db.customStatement("DELETE FROM local_product_barcodes");
      await _db.customStatement("DELETE FROM local_products");
      final selectedBranchId = await getSelectedBranchId();
      for (final product in products) {
        await _db.customStatement(
          "INSERT INTO local_products(product_id,name,barcode,sku,category_name,sale_price,purchase_price,tax_rate,stock_tracked,min_stock,is_active,stock_qty,sync_status,conflict_state,conflict_reason,pending_verification,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [
            product.id,
            product.name,
            product.barcode,
            product.sku,
            product.categoryName,
            product.salePrice,
            product.purchasePrice,
            product.taxRate,
            product.stockTracked ? 1 : 0,
            product.minStock,
            product.isActive ? 1 : 0,
            product.stockQty,
            product.syncStatus,
            product.conflictState,
            product.conflictReason,
            product.pendingVerification ? 1 : 0,
            _iso(product.updatedAt),
          ],
        );
        if (product.barcode != null && product.barcode!.isNotEmpty) {
          await _db.customStatement(
            "INSERT INTO local_product_barcodes(barcode,product_id) VALUES(?,?)",
            [product.barcode, product.id],
          );
        }
        if (selectedBranchId != null) {
          await _db.customStatement(
            "INSERT INTO local_stock_snapshot(product_id,branch_id,qty,updated_at) VALUES(?,?,?,?) ON CONFLICT(product_id,branch_id) DO UPDATE SET qty=excluded.qty,updated_at=excluded.updated_at",
            [
              product.id,
              selectedBranchId,
              product.stockQty,
              _iso(product.updatedAt),
            ],
          );
        }
      }
    });
  }

  Future<List<LocalProduct>> searchProducts({
    String? query,
    String? barcode,
  }) async {
    final filters = <String>[];
    final args = <Object?>[];
    if (query != null && query.trim().isNotEmpty) {
      final normalized = "%${query.trim().toLowerCase()}%";
      filters.add(
        "(LOWER(name) LIKE ? OR LOWER(COALESCE(sku,'')) LIKE ? OR LOWER(COALESCE(barcode,'')) LIKE ?)",
      );
      args.addAll([normalized, normalized, normalized]);
    }
    if (barcode != null && barcode.trim().isNotEmpty) {
      filters.add("barcode = ?");
      args.add(barcode.trim());
    }

    final where = filters.isEmpty ? "" : "WHERE ${filters.join(' AND ')}";
    final rows = await _db.customSelect(
      "SELECT * FROM local_products $where ORDER BY CASE WHEN conflict_state='none' THEN 0 ELSE 1 END, name ASC LIMIT 300",
      variables: args.map((value) => Variable<Object>(value)).toList(),
      readsFrom: {},
    ).get();
    return rows.map(_mapProduct).toList();
  }

  Future<LocalProduct?> getProductById(String productId) async {
    final row = await _db.customSelect(
      "SELECT * FROM local_products WHERE product_id=? LIMIT 1",
      variables: [Variable.withString(productId)],
      readsFrom: {},
    ).getSingleOrNull();
    return row == null ? null : _mapProduct(row);
  }

  Future<LocalProduct?> getProductByBarcode(String barcode) async {
    final row = await _db.customSelect(
      "SELECT p.* FROM local_products p LEFT JOIN local_product_barcodes b ON b.product_id=p.product_id WHERE p.barcode=? OR b.barcode=? LIMIT 1",
      variables: [
        Variable.withString(barcode),
        Variable.withString(barcode),
      ],
      readsFrom: {},
    ).getSingleOrNull();
    return row == null ? null : _mapProduct(row);
  }

  Future<List<LocalProduct>> listConflictProducts() async {
    final rows = await _db.customSelect(
      "SELECT * FROM local_products WHERE conflict_state <> 'none' ORDER BY updated_at DESC",
      readsFrom: {},
    ).get();
    return rows.map(_mapProduct).toList();
  }

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
    final now = DateTime.now().toUtc();
    final product = LocalProduct(
      id: existingId ?? _uuid(),
      name: name.trim(),
      barcode: barcode?.trim().isEmpty ?? true ? null : barcode!.trim(),
      sku: sku?.trim().isEmpty ?? true ? null : sku!.trim(),
      categoryName:
          categoryName?.trim().isEmpty ?? true ? null : categoryName!.trim(),
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
      updatedAt: now,
    );

    await _db.transaction(() async {
      await _db.customStatement(
        "INSERT INTO local_products(product_id,name,barcode,sku,category_name,sale_price,purchase_price,tax_rate,stock_tracked,min_stock,is_active,stock_qty,sync_status,conflict_state,conflict_reason,pending_verification,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET name=excluded.name,barcode=excluded.barcode,sku=excluded.sku,category_name=excluded.category_name,sale_price=excluded.sale_price,purchase_price=excluded.purchase_price,tax_rate=excluded.tax_rate,stock_tracked=excluded.stock_tracked,min_stock=excluded.min_stock,is_active=excluded.is_active,stock_qty=excluded.stock_qty,sync_status=excluded.sync_status,conflict_state=excluded.conflict_state,conflict_reason=excluded.conflict_reason,pending_verification=excluded.pending_verification,updated_at=excluded.updated_at",
        [
          product.id,
          product.name,
          product.barcode,
          product.sku,
          product.categoryName,
          product.salePrice,
          product.purchasePrice,
          product.taxRate,
          product.stockTracked ? 1 : 0,
          product.minStock,
          product.isActive ? 1 : 0,
          product.stockQty,
          product.syncStatus,
          product.conflictState,
          product.conflictReason,
          product.pendingVerification ? 1 : 0,
          _iso(product.updatedAt),
        ],
      );
      await _db.customStatement(
        "DELETE FROM local_product_barcodes WHERE product_id=?",
        [product.id],
      );
      if (product.barcode != null && product.barcode!.isNotEmpty) {
        await _db.customStatement(
          "INSERT OR REPLACE INTO local_product_barcodes(barcode,product_id) VALUES(?,?)",
          [product.barcode, product.id],
        );
      }
      if (outboxEventType != null && outboxPayload != null) {
        await appendOutboxEvent(
          eventType: outboxEventType,
          aggregateType: "product",
          aggregateId: product.id,
          payload: outboxPayload,
        );
      }
    });
    return product;
  }

  Future<void> markProductSyncStatus(
    String productId, {
    required String syncStatus,
    required String conflictState,
    String? conflictReason,
    required bool pendingVerification,
  }) async {
    await _db.customStatement(
      "UPDATE local_products SET sync_status=?, conflict_state=?, conflict_reason=?, pending_verification=?, updated_at=? WHERE product_id=?",
      [
        syncStatus,
        conflictState,
        conflictReason,
        pendingVerification ? 1 : 0,
        _iso(DateTime.now().toUtc()),
        productId,
      ],
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
    await _db.customStatement(
      "INSERT INTO local_stock_count_sessions(local_stock_count_session_id,tenant_id,branch_id,label,count_type,status,started_by,started_at,submitted_at,notes,last_error) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      [
        record.id,
        record.tenantId,
        record.branchId,
        record.label,
        record.countType,
        record.status,
        record.startedBy,
        _iso(record.startedAt),
        null,
        record.notes,
        null,
      ],
    );
    return record;
  }

  Future<List<StockCountSessionRecord>> listStockCountSessions() async {
    final rows = await _db.customSelect(
      "SELECT s.*, (SELECT COUNT(1) FROM local_stock_count_lines l WHERE l.local_stock_count_session_id=s.local_stock_count_session_id) AS line_count FROM local_stock_count_sessions s ORDER BY started_at DESC",
      readsFrom: {},
    ).get();
    return rows.map(_mapStockCountSession).toList();
  }

  Future<StockCountSessionRecord?> getStockCountSession(
    String sessionId,
  ) async {
    final row = await _db.customSelect(
      "SELECT s.*, (SELECT COUNT(1) FROM local_stock_count_lines l WHERE l.local_stock_count_session_id=s.local_stock_count_session_id) AS line_count FROM local_stock_count_sessions s WHERE local_stock_count_session_id=? LIMIT 1",
      variables: [Variable.withString(sessionId)],
      readsFrom: {},
    ).getSingleOrNull();
    return row == null ? null : _mapStockCountSession(row);
  }

  Future<List<StockCountLineRecord>> listStockCountLines(
    String sessionId,
  ) async {
    final rows = await _db.customSelect(
      "SELECT * FROM local_stock_count_lines WHERE local_stock_count_session_id=? ORDER BY updated_at DESC",
      variables: [Variable.withString(sessionId)],
      readsFrom: {},
    ).get();
    return rows.map(_mapStockCountLine).toList();
  }

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
    final now = DateTime.now().toUtc();
    var effectiveId = lineId ?? _uuid();
    var nextCountedQty = countedQty;
    if (mergeOnProduct && lineId == null) {
      final existing = await _db.customSelect(
        "SELECT local_stock_count_line_id, counted_qty FROM local_stock_count_lines WHERE local_stock_count_session_id=? AND product_id=? LIMIT 1",
        variables: [
          Variable.withString(sessionId),
          Variable.withString(productId),
        ],
        readsFrom: {},
      ).getSingleOrNull();
      if (existing != null) {
        effectiveId = existing.read<String>("local_stock_count_line_id");
        nextCountedQty += _asDouble(existing.read("counted_qty"));
      }
    }
    final deltaQty = expectedQtySnapshot == null
        ? null
        : nextCountedQty - expectedQtySnapshot;
    await _db.customStatement(
      "INSERT INTO local_stock_count_lines(local_stock_count_line_id,local_stock_count_session_id,product_id,variant_id,barcode_snapshot,product_name_snapshot,expected_qty_snapshot,counted_qty,delta_qty,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(local_stock_count_line_id) DO UPDATE SET product_id=excluded.product_id,variant_id=excluded.variant_id,barcode_snapshot=excluded.barcode_snapshot,product_name_snapshot=excluded.product_name_snapshot,expected_qty_snapshot=excluded.expected_qty_snapshot,counted_qty=excluded.counted_qty,delta_qty=excluded.delta_qty,note=excluded.note,updated_at=excluded.updated_at",
      [
        effectiveId,
        sessionId,
        productId,
        variantId,
        barcodeSnapshot,
        productNameSnapshot,
        expectedQtySnapshot,
        nextCountedQty,
        deltaQty,
        note,
        _iso(now),
        _iso(now),
      ],
    );
    await _db.customStatement(
      "UPDATE local_stock_count_sessions SET status='in_progress' WHERE local_stock_count_session_id=? AND status='draft'",
      [sessionId],
    );
  }

  Future<void> removeStockCountLine(String lineId) async {
    await _db.customStatement(
      "DELETE FROM local_stock_count_lines WHERE local_stock_count_line_id=?",
      [lineId],
    );
  }

  Future<void> submitStockCountSession(String sessionId) async {
    final session = await getStockCountSession(sessionId);
    if (session == null ||
        session.status == "submitted" ||
        session.status == "synced") {
      return;
    }
    final lines = await listStockCountLines(sessionId);
    final submittedAt = DateTime.now().toUtc();
    await _db.transaction(() async {
      await _db.customStatement(
        "UPDATE local_stock_count_sessions SET status='submitted', submitted_at=?, last_error=NULL WHERE local_stock_count_session_id=?",
        [_iso(submittedAt), sessionId],
      );
      await appendOutboxEvent(
        eventType: "STOCK_COUNT_SUBMITTED",
        aggregateType: "stock_count_session",
        aggregateId: sessionId,
        payload: {
          "stockCountSessionId": sessionId,
          "tenantId": session.tenantId,
          "branchId": session.branchId,
          "countType": session.countType,
          "label": session.label,
          "startedBy": session.startedBy,
          "startedAt": session.startedAt.toIso8601String(),
          "submittedAt": submittedAt.toIso8601String(),
          "notes": session.notes,
          "lines": lines
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
    });
  }

  Future<void> markStockCountSynced(String sessionId) async {
    await _db.customStatement(
      "UPDATE local_stock_count_sessions SET status='synced', last_error=NULL WHERE local_stock_count_session_id=?",
      [sessionId],
    );
  }

  Future<void> markStockCountFailed(String sessionId, String message) async {
    await _db.customStatement(
      "UPDATE local_stock_count_sessions SET status='failed', last_error=? WHERE local_stock_count_session_id=?",
      [_shortError(message), sessionId],
    );
  }

  Future<void> replaceRecentActivity(List<ActivityFeedItem> items) async {
    await _db.transaction(() async {
      await _db.customStatement("DELETE FROM local_recent_sales_cache");
      for (final item in items) {
        await _db.customStatement(
          "INSERT INTO local_recent_sales_cache(item_id,item_type,title,subtitle,branch_name,actor_name,amount,qty_impact,created_at,sync_state) VALUES(?,?,?,?,?,?,?,?,?,?)",
          [
            item.id,
            item.type,
            item.title,
            item.subtitle,
            item.branchName,
            item.actorName,
            item.amount,
            item.qtyImpact,
            _iso(item.createdAt),
            item.syncState,
          ],
        );
      }
    });
  }

  Future<List<ActivityFeedItem>> listRecentActivity({int limit = 50}) async {
    final rows = await _db.customSelect(
      "SELECT * FROM local_recent_sales_cache ORDER BY created_at DESC LIMIT $limit",
      readsFrom: {},
    ).get();
    return rows.map(_mapActivityItem).toList();
  }

  Future<void> replaceNotifications(
    List<LocalNotificationRecord> notifications,
  ) async {
    await _db.transaction(() async {
      await _db.customStatement("DELETE FROM local_notifications");
      for (final notification in notifications) {
        await _db.customStatement(
          "INSERT INTO local_notifications(notification_id,category,title,body,target_route,is_read,created_at) VALUES(?,?,?,?,?,?,?)",
          [
            notification.id,
            notification.category,
            notification.title,
            notification.body,
            notification.targetRoute,
            notification.isRead ? 1 : 0,
            _iso(notification.createdAt),
          ],
        );
      }
    });
  }

  Future<List<LocalNotificationRecord>> listNotifications() async {
    final rows = await _db.customSelect(
      "SELECT * FROM local_notifications ORDER BY is_read ASC, created_at DESC",
      readsFrom: {},
    ).get();
    return rows.map(_mapNotification).toList();
  }

  Future<void> markNotificationRead(String notificationId) async {
    await _db.customStatement(
      "UPDATE local_notifications SET is_read=1 WHERE notification_id=?",
      [notificationId],
    );
  }

  Future<void> saveDashboardSummary(DashboardSummary summary) async {
    final payload = {
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
    await _db.customStatement(
      "INSERT INTO local_report_snapshots(snapshot_key,payload_json,updated_at) VALUES('dashboard',?,?) ON CONFLICT(snapshot_key) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at",
      [jsonEncode(payload), _iso(DateTime.now().toUtc())],
    );
  }

  Future<DashboardSummary> getDashboardSummary() async {
    final row = await _db.customSelect(
      "SELECT payload_json FROM local_report_snapshots WHERE snapshot_key='dashboard' LIMIT 1",
      readsFrom: {},
    ).getSingleOrNull();
    if (row == null) {
      return DashboardSummary.empty;
    }
    final payload = jsonDecode(row.read<String>("payload_json"));
    if (payload is! Map<String, dynamic>) {
      return DashboardSummary.empty;
    }
    return DashboardSummary(
      todaySales: _asDouble(payload["todaySales"]),
      transactionCount: _asInt(payload["transactionCount"]),
      averageBasket: _asDouble(payload["averageBasket"]),
      refundTotal: _asDouble(payload["refundTotal"]),
      lowStockAlerts: (payload["lowStockAlerts"] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(
            (item) => LowStockAlert(
              productId: item["productId"]?.toString() ?? "",
              productName: item["productName"]?.toString() ?? "-",
              qty: _asDouble(item["qty"]),
              minStock: _asDouble(item["minStock"]),
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
              quantity: _asDouble(item["quantity"]),
              revenue: _asDouble(item["revenue"]),
            ),
          )
          .toList(),
      paymentMethodSummary:
          (payload["paymentMethodSummary"] as Map<String, dynamic>? ?? {}).map(
        (key, value) => MapEntry(key, _asDouble(value)),
      ),
      lastUpdatedAt: _parseDate(payload["lastUpdatedAt"]?.toString()),
    );
  }

  Future<void> saveReadCache(
    String cacheKey,
    Map<String, dynamic> payload,
  ) async {
    final now = DateTime.now().toUtc();
    final wrapped = <String, dynamic>{
      "_cachedAt": _iso(now),
      "payload": payload,
    };
    await _db.customStatement(
      "INSERT INTO local_report_snapshots(snapshot_key,payload_json,updated_at) VALUES(?,?,?) ON CONFLICT(snapshot_key) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at",
      [cacheKey, jsonEncode(wrapped), _iso(now)],
    );
  }

  Future<Map<String, dynamic>?> getReadCache(String cacheKey) async {
    final row = await _db.customSelect(
      "SELECT payload_json FROM local_report_snapshots WHERE snapshot_key=? LIMIT 1",
      variables: [Variable.withString(cacheKey)],
      readsFrom: {},
    ).getSingleOrNull();
    if (row == null) {
      return null;
    }

    final decoded = jsonDecode(row.read<String>("payload_json"));
    if (decoded is! Map<String, dynamic>) {
      return null;
    }

    final payload = decoded["payload"];
    if (payload is Map<String, dynamic>) {
      return <String, dynamic>{...payload, "_cachedAt": decoded["_cachedAt"]};
    }
    return null;
  }

  Future<void> appendOutboxEvent({
    required String eventType,
    required String aggregateType,
    required String aggregateId,
    required Map<String, dynamic> payload,
    int payloadVersion = 1,
  }) async {
    await _db.customStatement(
      "INSERT INTO outbox_events(event_id,event_type,aggregate_type,aggregate_id,payload_json,payload_version,created_at,status,retry_count,next_retry_at,error_code,error_message,server_ack_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        _uuid(),
        eventType,
        aggregateType,
        aggregateId,
        jsonEncode(payload),
        payloadVersion,
        _iso(DateTime.now().toUtc()),
        "pending",
        0,
        null,
        null,
        null,
        null,
      ],
    );
  }

  Future<List<LocalOutboxEvent>> getDispatchableOutboxEvents({
    int limit = 20,
  }) async {
    final rows = await _db.customSelect(
      "SELECT * FROM outbox_events WHERE status IN ('pending','failed','dead_letter') AND (next_retry_at IS NULL OR next_retry_at <= ?) ORDER BY created_at ASC LIMIT $limit",
      variables: [Variable.withString(_iso(DateTime.now().toUtc()))],
      readsFrom: {},
    ).get();
    return rows.map(_mapOutboxEvent).toList();
  }

  Future<void> markOutboxSent(String eventId) async {
    await _db.customStatement(
      "UPDATE outbox_events SET status='sent', error_code=NULL, error_message=NULL, server_ack_at=? WHERE event_id=?",
      [_iso(DateTime.now().toUtc()), eventId],
    );
  }

  Future<void> markOutboxFailed(
    String eventId, {
    required String errorCode,
    required String errorMessage,
    required bool deadLetter,
  }) async {
    final row = await _db.customSelect(
      "SELECT retry_count FROM outbox_events WHERE event_id=? LIMIT 1",
      variables: [Variable.withString(eventId)],
      readsFrom: {},
    ).getSingleOrNull();
    final retryCount = row == null ? 1 : row.read<int>("retry_count") + 1;
    final nextRetryAt = DateTime.now().toUtc().add(
          Duration(seconds: min(300, 3 * (1 << max(0, retryCount - 1)))),
        );
    await _db.customStatement(
      "UPDATE outbox_events SET status=?, retry_count=?, next_retry_at=?, error_code=?, error_message=? WHERE event_id=?",
      [
        deadLetter ? "dead_letter" : "failed",
        retryCount,
        _iso(nextRetryAt),
        errorCode,
        _shortError(errorMessage),
        eventId,
      ],
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
    await _db.customStatement(
      "UPDATE outbox_events SET status='failed', next_retry_at=?, error_code=NULL, error_message=NULL WHERE status='dead_letter'",
      [_iso(DateTime.now().toUtc())],
    );
  }

  Future<SyncDiagnostics> getSyncDiagnostics() async {
    final row = await _db.customSelect(
      "SELECT * FROM sync_state WHERE sync_key='global' LIMIT 1",
      readsFrom: {},
    ).getSingleOrNull();
    if (row == null) {
      return SyncDiagnostics.initial;
    }
    return SyncDiagnostics(
      running: _asBool(row.read<int>("running")),
      online: _asBool(row.read<int>("online")),
      pendingCount: _asInt(row.read<int>("pending_count")),
      failedCount: _asInt(row.read<int>("failed_count")),
      deadLetterCount: _asInt(row.read<int>("dead_letter_count")),
      lastSuccessfulSyncAt: _parseDate(
        row.readNullable<String>("last_successful_sync_at"),
      ),
      lastPullAt: _parseDate(row.readNullable<String>("last_pull_at")),
      lastHeartbeatAt: _parseDate(
        row.readNullable<String>("last_heartbeat_at"),
      ),
      lastError: row.readNullable<String>("last_error"),
      blockedReason: row.readNullable<String>("blocked_reason"),
    );
  }

  Future<void> saveSyncDiagnostics(SyncDiagnostics diagnostics) async {
    await _db.customStatement(
      "UPDATE sync_state SET running=?, online=?, pending_count=?, failed_count=?, dead_letter_count=?, last_successful_sync_at=?, last_pull_at=?, last_heartbeat_at=?, last_error=?, blocked_reason=? WHERE sync_key='global'",
      [
        diagnostics.running ? 1 : 0,
        diagnostics.online ? 1 : 0,
        diagnostics.pendingCount,
        diagnostics.failedCount,
        diagnostics.deadLetterCount,
        diagnostics.lastSuccessfulSyncAt == null
            ? null
            : _iso(diagnostics.lastSuccessfulSyncAt!),
        diagnostics.lastPullAt == null ? null : _iso(diagnostics.lastPullAt!),
        diagnostics.lastHeartbeatAt == null
            ? null
            : _iso(diagnostics.lastHeartbeatAt!),
        diagnostics.lastError,
        diagnostics.blockedReason,
      ],
    );
  }

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
    final rows = await _db.customSelect(
      "SELECT status, COUNT(1) AS c FROM outbox_events GROUP BY status",
      readsFrom: {},
    ).get();
    var pending = 0;
    var failed = 0;
    var dead = 0;
    for (final row in rows) {
      final status = row.read<String>("status");
      final count = row.read<int>("c");
      if (status == "pending") {
        pending = count;
      } else if (status == "failed") {
        failed = count;
      } else if (status == "dead_letter") {
        dead = count;
      }
    }
    final current = await getSyncDiagnostics();
    await saveSyncDiagnostics(
      current.copyWith(
        running: running,
        online: online,
        pendingCount: pending,
        failedCount: failed,
        deadLetterCount: dead,
        lastSuccessfulSyncAt: lastSuccessfulSyncAt,
        lastPullAt: lastPullAt,
        lastHeartbeatAt: lastHeartbeatAt,
        lastError: lastError,
        blockedReason: blockedReason,
        clearError: clearError,
      ),
    );
  }

  Future<void> appendAuditLog({
    required String actionType,
    required String entityType,
    required String entityId,
    required Map<String, dynamic> metadata,
    String syncStatus = "pending",
  }) async {
    await _db.customStatement(
      "INSERT INTO local_audit_logs(audit_id,action_type,entity_type,entity_id,metadata_json,created_at,sync_status) VALUES(?,?,?,?,?,?,?)",
      [
        _uuid(),
        actionType,
        entityType,
        entityId,
        jsonEncode(metadata),
        _iso(DateTime.now().toUtc()),
        syncStatus,
      ],
    );
  }

  Future<int> _count(String table) async {
    final row = await _db.customSelect("SELECT COUNT(1) AS c FROM $table",
        readsFrom: {}).getSingle();
    return row.read<int>("c");
  }

  Future<void> _setSetting(String key, Object? value) async {
    await _db.customStatement(
      "INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
      [key, jsonEncode(value), _iso(DateTime.now().toUtc())],
    );
  }

  Future<Object?> _getSetting(String key) async {
    final row = await _db.customSelect(
      "SELECT value_json FROM app_settings WHERE key=? LIMIT 1",
      variables: [Variable.withString(key)],
      readsFrom: {},
    ).getSingleOrNull();
    return row == null ? null : jsonDecode(row.read<String>("value_json"));
  }

  LocalSession _mapSession(QueryRow row) {
    return LocalSession(
      sessionId: row.read<String>("session_id"),
      userId: row.read<String>("user_id"),
      email: row.read<String>("email"),
      fullName: row.read<String>("full_name"),
      tenantId: row.read<String>("tenant_id"),
      roleCode: row.read<String>("role_code"),
      accessToken: row.read<String>("access_token"),
      refreshToken: row.read<String>("refresh_token"),
      expiresAt: DateTime.parse(row.read<String>("expires_at")),
      lastLoginAt: DateTime.parse(row.read<String>("last_login_at")),
      status: row.read<String>("status"),
    );
  }

  LocalActivation _mapActivation(QueryRow row) {
    return LocalActivation(
      activationId: row.read<String>("activation_id"),
      tenantId: row.read<String>("tenant_id"),
      userId: row.read<String>("user_id"),
      deviceId: row.read<String>("device_id"),
      licenseId: row.read<String>("license_id"),
      planCode: row.read<String>("plan_code"),
      status: row.read<String>("status"),
      activationToken: row.read<String>("activation_token"),
      companyName: row.readNullable<String>("company_name"),
      licenseExpiresAt: _parseDate(
        row.readNullable<String>("license_expires_at"),
      ),
      featureFlags: _decodeStringList(row.read<String>("feature_flags_json")),
      permissionActions: _decodeStringList(
        row.read<String>("permission_actions_json"),
      ),
      allowedBranchIds: _decodeStringList(
        row.read<String>("allowed_branch_ids_json"),
      ),
      lastValidationAt: DateTime.parse(row.read<String>("last_validation_at")),
      offlineGraceUntil: DateTime.parse(
        row.read<String>("offline_grace_until"),
      ),
      selectedBranchId: row.readNullable<String>("selected_branch_id"),
    );
  }

  LocalBranch _mapBranch(QueryRow row) {
    return LocalBranch(
      id: row.read<String>("branch_id"),
      name: row.read<String>("name"),
      isAssigned: _asBool(row.read<int>("is_assigned")),
      isSelected: _asBool(row.read<int>("is_selected")),
      settingsJson: row.read<String>("settings_json"),
      updatedAt: DateTime.parse(row.read<String>("updated_at")),
    );
  }

  LocalProduct _mapProduct(QueryRow row) {
    return LocalProduct(
      id: row.read<String>("product_id"),
      name: row.read<String>("name"),
      barcode: row.readNullable<String>("barcode"),
      sku: row.readNullable<String>("sku"),
      categoryName: row.readNullable<String>("category_name"),
      salePrice: _asDouble(row.read<double>("sale_price")),
      purchasePrice: _asDouble(row.read<double>("purchase_price")),
      taxRate: _asDouble(row.read<double>("tax_rate")),
      stockTracked: _asBool(row.read<int>("stock_tracked")),
      minStock: _asDouble(row.read<double>("min_stock")),
      isActive: _asBool(row.read<int>("is_active")),
      stockQty: _asDouble(row.read<double>("stock_qty")),
      syncStatus: row.read<String>("sync_status"),
      conflictState: row.read<String>("conflict_state"),
      conflictReason: row.readNullable<String>("conflict_reason"),
      pendingVerification: _asBool(row.read<int>("pending_verification")),
      updatedAt: DateTime.parse(row.read<String>("updated_at")),
    );
  }

  StockCountSessionRecord _mapStockCountSession(QueryRow row) {
    return StockCountSessionRecord(
      id: row.read<String>("local_stock_count_session_id"),
      tenantId: row.read<String>("tenant_id"),
      branchId: row.read<String>("branch_id"),
      label: row.read<String>("label"),
      countType: row.read<String>("count_type"),
      status: row.read<String>("status"),
      startedBy: row.read<String>("started_by"),
      startedAt: DateTime.parse(row.read<String>("started_at")),
      submittedAt: _parseDate(row.readNullable<String>("submitted_at")),
      notes: row.readNullable<String>("notes"),
      lastError: row.readNullable<String>("last_error"),
      lineCount: _asInt(row.read<int>("line_count")),
    );
  }

  StockCountLineRecord _mapStockCountLine(QueryRow row) {
    return StockCountLineRecord(
      id: row.read<String>("local_stock_count_line_id"),
      sessionId: row.read<String>("local_stock_count_session_id"),
      productId: row.read<String>("product_id"),
      variantId: row.readNullable<String>("variant_id"),
      barcodeSnapshot: row.readNullable<String>("barcode_snapshot"),
      productNameSnapshot: row.read<String>("product_name_snapshot"),
      expectedQtySnapshot:
          row.readNullable<double>("expected_qty_snapshot") == null
              ? null
              : _asDouble(row.read<double>("expected_qty_snapshot")),
      countedQty: _asDouble(row.read<double>("counted_qty")),
      deltaQty: row.readNullable<double>("delta_qty") == null
          ? null
          : _asDouble(row.read<double>("delta_qty")),
      note: row.readNullable<String>("note"),
      createdAt: DateTime.parse(row.read<String>("created_at")),
      updatedAt: DateTime.parse(row.read<String>("updated_at")),
    );
  }

  ActivityFeedItem _mapActivityItem(QueryRow row) {
    return ActivityFeedItem(
      id: row.read<String>("item_id"),
      type: row.read<String>("item_type"),
      title: row.read<String>("title"),
      subtitle: row.read<String>("subtitle"),
      branchName: row.readNullable<String>("branch_name"),
      actorName: row.readNullable<String>("actor_name"),
      amount: row.readNullable<double>("amount") == null
          ? null
          : _asDouble(row.read<double>("amount")),
      qtyImpact: row.readNullable<double>("qty_impact") == null
          ? null
          : _asDouble(row.read<double>("qty_impact")),
      createdAt: DateTime.parse(row.read<String>("created_at")),
      syncState: row.read<String>("sync_state"),
    );
  }

  LocalNotificationRecord _mapNotification(QueryRow row) {
    return LocalNotificationRecord(
      id: row.read<String>("notification_id"),
      category: row.read<String>("category"),
      title: row.read<String>("title"),
      body: row.read<String>("body"),
      targetRoute: row.readNullable<String>("target_route"),
      isRead: _asBool(row.read<int>("is_read")),
      createdAt: DateTime.parse(row.read<String>("created_at")),
    );
  }

  LocalOutboxEvent _mapOutboxEvent(QueryRow row) {
    return LocalOutboxEvent(
      id: row.read<String>("event_id"),
      eventType: row.read<String>("event_type"),
      aggregateType: row.read<String>("aggregate_type"),
      aggregateId: row.read<String>("aggregate_id"),
      payloadJson: row.read<String>("payload_json"),
      payloadVersion: _asInt(row.read<int>("payload_version")),
      createdAt: DateTime.parse(row.read<String>("created_at")),
      status: row.read<String>("status"),
      retryCount: _asInt(row.read<int>("retry_count")),
      nextRetryAt: _parseDate(row.readNullable<String>("next_retry_at")),
      errorCode: row.readNullable<String>("error_code"),
      errorMessage: row.readNullable<String>("error_message"),
    );
  }
}

class _RawDatabase extends GeneratedDatabase {
  _RawDatabase(super.executor);

  @override
  Iterable<TableInfo<Table, Object?>> get allTables => const [];

  @override
  int get schemaVersion => 1;
}

bool _asBool(Object? value) {
  if (value is bool) {
    return value;
  }
  if (value is num) {
    return value != 0;
  }
  if (value is String) {
    return value == "1" || value.toLowerCase() == "true";
  }
  return false;
}

int _asInt(Object? value) {
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

double _asDouble(Object? value) {
  if (value is double) {
    return value;
  }
  if (value is int) {
    return value.toDouble();
  }
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value) ?? 0;
  }
  return 0;
}

DateTime? _parseDate(String? value) {
  if (value == null || value.isEmpty) {
    return null;
  }
  return DateTime.tryParse(value);
}

String _iso(DateTime value) => value.toUtc().toIso8601String();

List<String> _decodeStringList(String jsonValue) {
  final decoded = jsonDecode(jsonValue);
  if (decoded is! List) {
    return [];
  }
  return decoded.map((value) => value.toString()).toList();
}

String _shortError(String value) {
  return value.length > 500 ? value.substring(0, 500) : value;
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
