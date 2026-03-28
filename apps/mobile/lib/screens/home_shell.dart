import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:loomapos_mobile/core/mobile_constants.dart";
import "package:loomapos_mobile/core/barcode_scan_guard.dart";
import "package:loomapos_mobile/core/mobile_formatters.dart";
import "package:loomapos_mobile/core/read_freshness.dart";
import "package:loomapos_mobile/core/operation_error_mapper.dart";
import "package:loomapos_mobile/models/mobile_models.dart";
import "package:loomapos_mobile/providers/mobile_providers.dart";
import "package:mobile_scanner/mobile_scanner.dart";

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _index = 0;

  static const _titles = [
    "Dashboard",
    "Urunler",
    "Stok Sayim",
    "Aktivite",
    "Ayarlar",
  ];

  @override
  Widget build(BuildContext context) {
    final appState = ref.watch(appControllerProvider);
    final syncState = ref.watch(syncControllerProvider);
    final lifecycle = resolveTenantLifecycle(appState, syncState);

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 80,
        titleSpacing: 16,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              _titles[_index],
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                _Pill(
                  label: syncState.online ? "Online" : "Offline",
                  color: syncState.online
                      ? MobileColors.success
                      : MobileColors.warning,
                ),
                if (appState.selectedBranch != null)
                  _Pill(
                    label: appState.selectedBranch!.name,
                    color: MobileColors.info,
                  ),
                _Pill(
                  label: lifecycle.label,
                  color: tenantLifecycleColor(lifecycle.state),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: syncState.running
                ? null
                : () => ref.read(syncControllerProvider.notifier).run(),
            icon: syncState.running
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.sync),
          ),
          if (appState.branches.length > 1)
            PopupMenuButton<String>(
              icon: const Icon(Icons.storefront_outlined),
              onSelected: (branchId) => ref
                  .read(appControllerProvider.notifier)
                  .selectBranch(branchId),
              itemBuilder: (context) => appState.branches
                  .map(
                    (branch) => PopupMenuItem<String>(
                      value: branch.id,
                      child: Text(branch.name),
                    ),
                  )
                  .toList(),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          if (!syncState.online)
            const _CachedDataBanner(
              message:
                  "Baglanti yok. Son basarili veriler onbellekten gosteriliyor.",
            ),
          if (lifecycle.state != TenantLifecycleState.subscriptionActive)
            _CachedDataBanner(
              message:
                  "${lifecycle.message} • Sonraki adim: ${lifecycle.nextAction}",
            ),
          Expanded(
            child: IndexedStack(
              index: _index,
              children: const [
                _DashboardTab(),
                _ProductsTab(),
                _StockCountTab(),
                _ActivityTab(),
                _SettingsTab(),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.space_dashboard_outlined),
            selectedIcon: Icon(Icons.space_dashboard),
            label: "Dashboard",
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: "Urunler",
          ),
          NavigationDestination(
            icon: Icon(Icons.qr_code_scanner_outlined),
            selectedIcon: Icon(Icons.qr_code_scanner),
            label: "Stok Sayim",
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history),
            label: "Aktivite",
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: "Ayarlar",
          ),
        ],
      ),
    );
  }
}

class _DashboardTab extends ConsumerWidget {
  const _DashboardTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appState = ref.watch(appControllerProvider);
    final syncState = ref.watch(syncControllerProvider);
    final lifecycle = resolveTenantLifecycle(appState, syncState);
    final writeLocked =
        lifecycle.state == TenantLifecycleState.trialExpired ||
            lifecycle.state == TenantLifecycleState.suspendedBlocked;
    final dashboard = ref.watch(dashboardReadProvider);
    final reports = ref.watch(reportsSummaryProvider);
    final branches = ref.watch(branchOverviewProvider);

    return RefreshIndicator(
      onRefresh: () => _refreshDashboardReadSurface(context, ref),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    appState.activation?.companyName ??
                        "Operational mobile companion",
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "Plan ${appState.activation?.planCode.toUpperCase() ?? "-"} | Rol ${appState.permissions.roleCode}",
                    style: const TextStyle(color: MobileColors.muted),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    syncState.lastSuccessfulSyncAt == null
                        ? "Henuz basarili sync alinmadi."
                        : "Son sync ${formatDateTimeShort(syncState.lastSuccessfulSyncAt!)}",
                    style: const TextStyle(color: MobileColors.muted),
                  ),
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(
                      onPressed: syncState.running
                          ? null
                          : () => _refreshDashboardReadSurface(context, ref),
                      icon: syncState.running
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.refresh),
                      label: Text(syncState.running ? "Yenileniyor" : "Yenile"),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (writeLocked)
            _ErrorCard(message: "${lifecycle.message} ${lifecycle.nextAction}"),
          if (writeLocked) const SizedBox(height: 12),
          dashboard.when(
            data: (read) {
              final summary = read.data;
              return Column(
                children: [
                  _ReadFreshnessBanner(read: read, label: "Dashboard"),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      _MetricCard(
                        title: "Bugun Satis",
                        value: formatMoney(summary.todaySales),
                      ),
                      _MetricCard(
                        title: "Islem",
                        value: summary.transactionCount.toString(),
                      ),
                      _MetricCard(
                        title: "Sepet",
                        value: formatMoney(summary.averageBasket),
                      ),
                      _MetricCard(
                        title: "Iade",
                        value: formatMoney(summary.refundTotal),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _SectionCard(
                    title: "Low stock",
                    child: summary.lowStockAlerts.isEmpty
                        ? const Text(
                            "Aktif low stock alarmi yok.",
                            style: TextStyle(color: MobileColors.muted),
                          )
                        : Column(
                            children: summary.lowStockAlerts
                                .take(5)
                                .map(
                                  (item) => ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(item.productName),
                                    subtitle: Text(
                                      item.branchName ??
                                          appState.selectedBranch?.name ??
                                          "-",
                                    ),
                                    trailing: Text(
                                      "${formatQty(item.qty)} / min ${formatQty(item.minStock)}",
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                  ),
                ],
              );
            },
            loading: () => const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, _) => _ErrorCard(message: _friendlyError(error)),
          ),
          const SizedBox(height: 12),
          reports.when(
            data: (read) {
              final summary = read.data;
              return _SectionCard(
                title: "Rapor ozeti",
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _ReadFreshnessBanner(read: read, label: "Rapor"),
                    const SizedBox(height: 8),
                    Text(
                      "Toplam gelir: ${formatMoney(summary.todaySales)} | Islem: ${summary.transactionCount}",
                    ),
                    const SizedBox(height: 8),
                    if (summary.topProducts.isEmpty)
                      const Text(
                        "Top urun verisi yok.",
                        style: TextStyle(color: MobileColors.muted),
                      )
                    else
                      ...summary.topProducts.take(3).map(
                            (item) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(item.productName),
                              subtitle: Text(
                                "Adet: ${formatQty(item.quantity)}",
                              ),
                              trailing: Text(formatMoney(item.revenue)),
                            ),
                          ),
                  ],
                ),
              );
            },
            loading: () => const Card(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
            error: (error, _) => _ErrorCard(message: _friendlyError(error)),
          ),
          const SizedBox(height: 12),
          branches.when(
            data: (read) {
              final items = read.data;
              return _SectionCard(
                title: "Sube gorunumu",
                child: Column(
                  children: [
                    _ReadFreshnessBanner(read: read, label: "Sube listesi"),
                    const SizedBox(height: 8),
                    if (items.isEmpty)
                      const Text(
                        "Sube verisi bulunamadi.",
                        style: TextStyle(color: MobileColors.muted),
                      )
                    else
                      ...items.map(
                        (branch) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(branch.name),
                          subtitle:
                              Text(branch.isAssigned ? "Atanmis" : "Pasif"),
                          trailing: branch.isSelected
                              ? const Icon(Icons.check_circle,
                                  color: MobileColors.success)
                              : const Icon(Icons.circle_outlined,
                                  color: MobileColors.muted),
                        ),
                      ),
                  ],
                ),
              );
            },
            loading: () => const Card(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
            error: (error, _) => _ErrorCard(message: _friendlyError(error)),
          ),
        ],
      ),
    );
  }
}

class _ProductsTab extends ConsumerStatefulWidget {
  const _ProductsTab();

  @override
  ConsumerState<_ProductsTab> createState() => _ProductsTabState();
}

class _ProductsTabState extends ConsumerState<_ProductsTab> {
  final _searchController = TextEditingController();
  String _query = "";
  bool _barcodeLookupInProgress = false;
  bool _refreshing = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = ref.watch(appControllerProvider);
    final syncState = ref.watch(syncControllerProvider);
    final products = ref.watch(productSearchReadProvider(_query));

    return RefreshIndicator(
      onRefresh: _refreshProducts,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          if (!syncState.online)
            const _CachedDataBanner(
              message: "Urun listesi onbellekten gosteriliyor.",
            ),
          TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              labelText: "Urun, SKU veya barkod ara",
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) => setState(() => _query = value.trim()),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _scanBarcode,
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text("Barkod tara"),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed:
                      appState.permissions.can(MobileActions.productCreate)
                          ? () => _openEditor()
                          : null,
                  icon: const Icon(Icons.add),
                  label: const Text("Urun ekle"),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: _refreshing ? null : _refreshProducts,
              icon: _refreshing
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh),
              label: Text(_refreshing ? "Yenileniyor" : "Listeyi yenile"),
            ),
          ),
          const SizedBox(height: 8),
          products.when(
            data: (read) {
              final items = read.data;
              return Column(
                children: [
                  _ReadFreshnessBanner(read: read, label: "Urun listesi"),
                  const SizedBox(height: 8),
                  if (items.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text(
                          "Arama kriterine uygun urun bulunamadi.",
                          style: TextStyle(color: MobileColors.muted),
                        ),
                      ),
                    )
                  else
                    ...items.map(
                      (product) => Card(
                        child: ListTile(
                          onTap: () => _openEditor(product: product),
                          title: Text(product.name),
                          subtitle: Text(
                            [
                              if (product.barcode != null) product.barcode!,
                              if (product.sku != null) product.sku!,
                              if (product.categoryName != null)
                                product.categoryName!,
                            ].join(" | "),
                          ),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(formatMoney(product.salePrice)),
                              Text(
                                product.stockTracked
                                    ? "Stok ${formatQty(product.stockQty)}"
                                    : "Servis",
                                style: TextStyle(
                                  fontSize: 12,
                                  color: product.isLowStock
                                      ? MobileColors.warning
                                      : MobileColors.muted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              );
            },
            loading: () => const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, _) => _ErrorCard(message: _friendlyError(error)),
          ),
        ],
      ),
    );
  }

  Future<void> _refreshProducts() async {
    if (_refreshing) {
      return;
    }
    setState(() => _refreshing = true);
    try {
      final repository = await ref.read(repositoryProvider.future);
      final read = await repository.searchProductsRead(
        query: _query,
        refreshFromNetwork: true,
      );
      refreshDataProviders(ref);
      if (mounted) {
        _showSnackBar(
            context, _refreshResultMessage(read.isStale, "Urun listesi"));
      }
    } catch (error) {
      if (mounted) {
        await _handleOperationalError(
          context,
          ref,
          error,
          isMutation: false,
          cachedDataVisible: true,
        );
      }
    } finally {
      if (mounted) {
        setState(() => _refreshing = false);
      }
    }
  }

  Future<void> _scanBarcode() async {
    if (_barcodeLookupInProgress) {
      return;
    }

    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => const _ScannerPage(title: "Barkod tara"),
      ),
    );
    if (!mounted || code == null || code.trim().isEmpty) {
      return;
    }

    _barcodeLookupInProgress = true;
    try {
      final repository = await ref.read(repositoryProvider.future);
      final product = await repository.findProductByBarcode(code.trim());
      if (!mounted) {
        return;
      }
      if (product == null) {
        _showSnackBar(
          context,
          "Barkod taninmadi. Tekrar deneyin veya manuel arama yapin.",
        );
        return;
      }
      _showSnackBar(context, "Urun bulundu: ${product.name}");
      await _openEditor(product: product);
    } catch (_) {
      if (mounted) {
        _showSnackBar(
          context,
          "Barkod sorgusu basarisiz. Baglantiyi kontrol edip tekrar deneyin.",
        );
      }
    } finally {
      _barcodeLookupInProgress = false;
    }
  }

  Future<void> _openEditor({LocalProduct? product}) async {
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ProductEditorSheet(product: product),
    );
    if (updated == true && mounted) {
      refreshDataProviders(ref);
    }
  }
}

class _StockCountTab extends ConsumerWidget {
  const _StockCountTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appState = ref.watch(appControllerProvider);
    final syncState = ref.watch(syncControllerProvider);
    final lifecycle = resolveTenantLifecycle(appState, syncState);
    final writeLocked =
        lifecycle.state == TenantLifecycleState.trialExpired ||
            lifecycle.state == TenantLifecycleState.suspendedBlocked;
    final sessions = ref.watch(stockCountSessionsProvider);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        FilledButton.icon(
          onPressed: appState.permissions.can(MobileActions.stockCountCreate) &&
                  !writeLocked
              ? () => _showCreateSession(context, ref)
              : null,
          icon: const Icon(Icons.add_box_outlined),
          label: const Text("Yeni sayim seansi"),
        ),
        const SizedBox(height: 12),
        if (writeLocked)
          _ErrorCard(message: "${lifecycle.message} ${lifecycle.nextAction}"),
        if (writeLocked) const SizedBox(height: 12),
        sessions.when(
          data: (items) => Column(
            children: items
                .map(
                  (session) => Card(
                    child: ListTile(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) =>
                              _StockCountDetailPage(sessionId: session.id),
                        ),
                      ),
                      title: Text(session.label),
                      subtitle: Text(
                        "${session.countType} | ${session.startedBy}",
                      ),
                      trailing: _Pill(
                        label: session.status,
                        color: _statusColor(session.status),
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
          loading: () => const Padding(
            padding: EdgeInsets.all(32),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, _) => _ErrorCard(message: _friendlyError(error)),
        ),
      ],
    );
  }
}

class _ActivityTab extends ConsumerStatefulWidget {
  const _ActivityTab();

  @override
  ConsumerState<_ActivityTab> createState() => _ActivityTabState();
}

class _ActivityTabState extends ConsumerState<_ActivityTab> {
  bool _refreshing = false;

  @override
  Widget build(BuildContext context) {
    final activity = ref.watch(salesListReadProvider);
    final notifications = ref.watch(notificationsProvider);

    return RefreshIndicator(
      onRefresh: _refreshActivity,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: _refreshing ? null : _refreshActivity,
              icon: _refreshing
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh),
              label: Text(_refreshing ? "Yenileniyor" : "Akisi yenile"),
            ),
          ),
          notifications.when(
            data: (items) => _SectionCard(
              title: "Notifications",
              child: items.isEmpty
                  ? const Text(
                      "Bildirim yok.",
                      style: TextStyle(color: MobileColors.muted),
                    )
                  : Column(
                      children: items
                          .take(5)
                          .map(
                            (item) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(item.title),
                              subtitle: Text(item.body),
                              trailing: Text(
                                formatClock(item.createdAt),
                                style:
                                    const TextStyle(color: MobileColors.muted),
                              ),
                            ),
                          )
                          .toList(),
                    ),
            ),
            loading: () => const SizedBox.shrink(),
            error: (error, _) => _ErrorCard(message: _friendlyError(error)),
          ),
          const SizedBox(height: 12),
          activity.when(
            data: (read) {
              final items = read.data;
              return _SectionCard(
                title: "Recent activity",
                child: Column(
                  children: [
                    _ReadFreshnessBanner(read: read, label: "Aktivite"),
                    const SizedBox(height: 8),
                    if (items.isEmpty)
                      const Text(
                        "Son operasyon aktivitesi yok.",
                        style: TextStyle(color: MobileColors.muted),
                      )
                    else
                      ...items.map(
                        (item) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            _activityIcon(item.type),
                            color: _activityColor(item.type),
                          ),
                          title: Text(item.title),
                          subtitle: Text(item.subtitle),
                          trailing: Text(
                            formatDateTimeShort(item.createdAt),
                            style: const TextStyle(
                              fontSize: 12,
                              color: MobileColors.muted,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
            loading: () => const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, _) => _ErrorCard(message: _friendlyError(error)),
          ),
        ],
      ),
    );
  }

  Future<void> _refreshActivity() async {
    if (_refreshing) {
      return;
    }
    setState(() => _refreshing = true);
    try {
      final repository = await ref.read(repositoryProvider.future);
      final read = await repository.getSalesListRead(refreshFromNetwork: true);
      refreshDataProviders(ref);
      if (mounted) {
        _showSnackBar(context, _refreshResultMessage(read.isStale, "Aktivite"));
      }
    } catch (error) {
      if (mounted) {
        await _handleOperationalError(
          context,
          ref,
          error,
          isMutation: false,
          cachedDataVisible: true,
        );
      }
    } finally {
      if (mounted) {
        setState(() => _refreshing = false);
      }
    }
  }
}

class _SettingsTab extends ConsumerWidget {
  const _SettingsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appState = ref.watch(appControllerProvider);
    final syncState = ref.watch(syncControllerProvider);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        _SectionCard(
          title: "Account",
          child: Column(
            children: [
              _InfoRow(
                label: "Kullanici",
                value: appState.session?.fullName ?? "-",
              ),
              _InfoRow(label: "Email", value: appState.session?.email ?? "-"),
              _InfoRow(label: "Rol", value: appState.permissions.roleCode),
              _InfoRow(
                label: "Tenant",
                value: appState.activation?.companyName ?? "-",
              ),
              _InfoRow(
                label: "Plan",
                value: appState.activation?.planCode ?? "-",
              ),
              _InfoRow(
                label: "Device",
                value: appState.activation?.deviceId ?? "-",
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _SectionCard(
          title: "Sync diagnostics",
          child: Column(
            children: [
              _InfoRow(
                label: "Baglanti",
                value: syncState.online ? "Online" : "Offline",
              ),
              _InfoRow(
                label: "Pending",
                value: syncState.pendingCount.toString(),
              ),
              _InfoRow(
                label: "Failed",
                value: syncState.failedCount.toString(),
              ),
              _InfoRow(
                label: "Dead letter",
                value: syncState.deadLetterCount.toString(),
              ),
              if (syncState.lastError != null)
                _InfoRow(label: "Last error", value: syncState.lastError!),
            ],
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () => ref.read(appControllerProvider.notifier).logout(),
          style: FilledButton.styleFrom(backgroundColor: MobileColors.danger),
          icon: const Icon(Icons.logout),
          label: const Text("Logout"),
        ),
      ],
    );
  }
}

class _ProductEditorSheet extends ConsumerStatefulWidget {
  const _ProductEditorSheet({this.product});

  final LocalProduct? product;

  @override
  ConsumerState<_ProductEditorSheet> createState() =>
      _ProductEditorSheetState();
}

class _ProductEditorSheetState extends ConsumerState<_ProductEditorSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _barcodeController;
  late final TextEditingController _skuController;
  late final TextEditingController _categoryController;
  late final TextEditingController _salePriceController;
  late final TextEditingController _purchasePriceController;
  late final TextEditingController _taxRateController;
  late final TextEditingController _minStockController;
  late final TextEditingController _stockQtyController;
  bool _stockTracked = true;
  bool _isActive = true;
  bool _saving = false;
  bool _refreshingDetail = false;

  @override
  void initState() {
    super.initState();
    final product = widget.product;
    _nameController = TextEditingController(text: product?.name ?? "");
    _barcodeController = TextEditingController(text: product?.barcode ?? "");
    _skuController = TextEditingController(text: product?.sku ?? "");
    _categoryController = TextEditingController(
      text: product?.categoryName ?? "",
    );
    _salePriceController = TextEditingController(
      text: product == null ? "" : product.salePrice.toStringAsFixed(2),
    );
    _purchasePriceController = TextEditingController(
      text: product == null ? "" : product.purchasePrice.toStringAsFixed(2),
    );
    _taxRateController = TextEditingController(
      text: product == null ? "20" : product.taxRate.toStringAsFixed(0),
    );
    _minStockController = TextEditingController(
      text: product == null ? "0" : product.minStock.toStringAsFixed(0),
    );
    _stockQtyController = TextEditingController(
      text: product == null ? "0" : product.stockQty.toStringAsFixed(0),
    );
    _stockTracked = product?.stockTracked ?? true;
    _isActive = product?.isActive ?? true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _barcodeController.dispose();
    _skuController.dispose();
    _categoryController.dispose();
    _salePriceController.dispose();
    _purchasePriceController.dispose();
    _taxRateController.dispose();
    _minStockController.dispose();
    _stockQtyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final detailRead = widget.product == null
        ? null
        : ref.watch(productDetailReadProvider(widget.product!.id));

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.product == null ? "Yeni urun" : "Urunu duzenle",
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 12),
                if (detailRead != null)
                  detailRead.when(
                    data: (read) => Column(
                      children: [
                        _ReadFreshnessBanner(read: read, label: "Urun detayi"),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            onPressed: _refreshingDetail
                                ? null
                                : _refreshProductDetail,
                            icon: _refreshingDetail
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.refresh),
                            label: Text(
                              _refreshingDetail
                                  ? "Yenileniyor"
                                  : "Detayi yenile",
                            ),
                          ),
                        ),
                      ],
                    ),
                    loading: () => const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: LinearProgressIndicator(minHeight: 2),
                    ),
                    error: (error, _) => Padding(
                      padding: const EdgeInsets.only(top: 6, bottom: 10),
                      child: _ErrorCard(message: _friendlyError(error)),
                    ),
                  ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: "Urun adi"),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? "Urun adi zorunlu."
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _barcodeController,
                  decoration: const InputDecoration(labelText: "Barkod"),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _skuController,
                  decoration: const InputDecoration(labelText: "SKU"),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _categoryController,
                  decoration: const InputDecoration(labelText: "Kategori"),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _salePriceController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: "Satis fiyat",
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _purchasePriceController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: "Alis fiyat",
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _taxRateController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: "Vergi orani",
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _minStockController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: "Min stok",
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _stockQtyController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: "Branch stock snapshot",
                  ),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _stockTracked,
                  onChanged: (value) => setState(() => _stockTracked = value),
                  title: const Text("Stock tracked"),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _isActive,
                  onChanged: (value) => setState(() => _isActive = value),
                  title: const Text("Aktif"),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _saving ? null : _save,
                    child: Text(_saving ? "Kaydediliyor..." : "Kaydet"),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _refreshProductDetail() async {
    final product = widget.product;
    if (product == null || _refreshingDetail) {
      return;
    }
    setState(() => _refreshingDetail = true);
    try {
      final repository = await ref.read(repositoryProvider.future);
      final read = await repository.getProductDetail(
        productId: product.id,
        refreshFromNetwork: true,
      );
      ref.invalidate(productDetailReadProvider(product.id));
      if (mounted) {
        _showSnackBar(
            context, _refreshResultMessage(read.isStale, "Urun detayi"));
      }
    } catch (error) {
      if (mounted) {
        await _handleOperationalError(
          context,
          ref,
          error,
          isMutation: false,
          cachedDataVisible: true,
        );
      }
    } finally {
      if (mounted) {
        setState(() => _refreshingDetail = false);
      }
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _saving = true);
    try {
      final repository = await ref.read(repositoryProvider.future);
      await repository.saveProduct(
        existingId: widget.product?.id,
        name: _nameController.text,
        barcode: _barcodeController.text,
        sku: _skuController.text,
        categoryName: _categoryController.text,
        salePrice:
            double.tryParse(_salePriceController.text.replaceAll(",", ".")) ??
                0,
        purchasePrice: double.tryParse(
              _purchasePriceController.text.replaceAll(",", "."),
            ) ??
            0,
        taxRate:
            double.tryParse(_taxRateController.text.replaceAll(",", ".")) ?? 0,
        stockTracked: _stockTracked,
        minStock:
            double.tryParse(_minStockController.text.replaceAll(",", ".")) ?? 0,
        isActive: _isActive,
        stockQty:
            double.tryParse(_stockQtyController.text.replaceAll(",", ".")) ?? 0,
      );
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) {
        return;
      }
      _showSnackBar(context, _friendlyError(error));
      setState(() => _saving = false);
    }
  }
}

class _StockCountDetailPage extends ConsumerWidget {
  const _StockCountDetailPage({required this.sessionId});

  final String sessionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(stockCountSessionProvider(sessionId));
    final lines = ref.watch(stockCountLinesProvider(sessionId));
    final appState = ref.watch(appControllerProvider);
    final syncState = ref.watch(syncControllerProvider);
    final lifecycle = resolveTenantLifecycle(appState, syncState);
    final writeLocked =
        lifecycle.state == TenantLifecycleState.trialExpired ||
            lifecycle.state == TenantLifecycleState.suspendedBlocked;

    return Scaffold(
      appBar: AppBar(
        title: const Text("Sayim detayi"),
        actions: [
          IconButton(
            onPressed: writeLocked
                ? null
                : () => _scanIntoCount(context, ref, sessionId),
            icon: const Icon(Icons.qr_code_scanner),
          ),
          IconButton(
            onPressed: writeLocked
                ? null
                : () => _pickProductForCount(context, ref, sessionId),
            icon: const Icon(Icons.playlist_add),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          session.when(
            data: (value) => value == null
                ? const _ErrorCard(message: "Sayim seansi bulunamadi.")
                : Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            value.label,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _InfoRow(label: "Status", value: value.status),
                          _InfoRow(label: "Type", value: value.countType),
                          _InfoRow(label: "Started by", value: value.startedBy),
                        ],
                      ),
                    ),
                  ),
            loading: () => const Card(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
            error: (error, _) => _ErrorCard(message: _friendlyError(error)),
          ),
          const SizedBox(height: 12),
          if (writeLocked)
            _ErrorCard(message: "${lifecycle.message} ${lifecycle.nextAction}"),
          if (writeLocked) const SizedBox(height: 12),
          lines.when(
            data: (items) => Column(
              children: items.isEmpty
                  ? [
                      const Card(
                        child: Padding(
                          padding: EdgeInsets.all(18),
                          child: Text(
                            "Sayim satiri yok. Barkod tarayin veya urun secin.",
                            style: TextStyle(color: MobileColors.muted),
                          ),
                        ),
                      ),
                    ]
                  : items
                      .map(
                        (line) => Card(
                          child: ListTile(
                            onTap: writeLocked
                                ? null
                                : () => _editCountLine(context, ref, line),
                            title: Text(line.productNameSnapshot),
                            subtitle: Text(
                              [
                                if (line.barcodeSnapshot != null)
                                  line.barcodeSnapshot!,
                                "Beklenen ${formatQty(line.expectedQtySnapshot ?? 0)}",
                              ].join(" | "),
                            ),
                            trailing: Text(formatQty(line.countedQty)),
                          ),
                        ),
                      )
                      .toList(),
            ),
            loading: () => const Card(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
            error: (error, _) => _ErrorCard(message: _friendlyError(error)),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: FilledButton.icon(
          onPressed: appState.permissions.can(MobileActions.stockCountSubmit) &&
                  !writeLocked
              ? () => _submitCount(context, ref, sessionId)
              : null,
          icon: const Icon(Icons.cloud_upload_outlined),
          label: const Text("Sayimi submit et"),
        ),
      ),
    );
  }
}

class _ScannerPage extends StatefulWidget {
  const _ScannerPage({required this.title});

  final String title;

  @override
  State<_ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<_ScannerPage> {
  final _manualController = TextEditingController();
  final BarcodeScanGuard _scanGuard = BarcodeScanGuard();
  bool _handled = false;
  String? _scanFeedback;

  @override
  void dispose() {
    _manualController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(
        children: [
          Expanded(
            child: MobileScanner(
              onDetect: (capture) {
                if (_handled) {
                  return;
                }
                final code = capture.barcodes.isEmpty
                    ? null
                    : capture.barcodes.first.rawValue;
                if (code == null || code.trim().isEmpty) {
                  setState(() => _scanFeedback = "Gecersiz barkod.");
                  return;
                }
                if (!_scanGuard.shouldHandle(code)) {
                  return;
                }
                _handled = true;
                setState(() => _scanFeedback = "Barkod okundu: ${code.trim()}");
                final navigator = Navigator.of(context);
                Future<void>.delayed(const Duration(milliseconds: 180), () {
                  if (mounted) {
                    navigator.pop(code.trim());
                  }
                });
              },
            ),
          ),
          if (_scanFeedback != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(
                _scanFeedback!,
                style: const TextStyle(
                  color: MobileColors.info,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _manualController,
                    decoration: const InputDecoration(
                      labelText: "Manuel barkod girisi",
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                FilledButton(
                  onPressed: () {
                    final manual = _manualController.text.trim();
                    if (manual.isEmpty) {
                      setState(() => _scanFeedback = "Lutfen barkod girin.");
                      return;
                    }
                    Navigator.of(context).pop(manual);
                  },
                  child: const Text("Tamam"),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.title, required this.value});

  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 150),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: MobileColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: MobileColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: MobileColors.muted)),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(color: MobileColors.muted),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: MobileColors.danger),
            const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
  }
}

Future<void> _showCreateSession(BuildContext context, WidgetRef ref) async {
  final labelController = TextEditingController();
  final created = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Yeni sayim seansi",
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: labelController,
              decoration: const InputDecoration(labelText: "Etiket"),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () async {
                  final repository = await ref.read(repositoryProvider.future);
                  final label = labelController.text.trim().isEmpty
                      ? "Yeni sayim"
                      : labelController.text.trim();
                  await repository.createStockCountSession(
                    label: label,
                    countType: "full",
                  );
                  if (!context.mounted) {
                    return;
                  }
                  Navigator.of(context).pop(true);
                },
                child: const Text("Olustur"),
              ),
            ),
          ],
        ),
      ),
    ),
  );
  labelController.dispose();
  if (created == true) {
    refreshDataProviders(ref);
  }
}

Future<void> _pickProductForCount(
  BuildContext context,
  WidgetRef ref,
  String sessionId,
) async {
  final controller = TextEditingController();
  String query = "";
  final product = await showModalBottomSheet<LocalProduct>(
    context: context,
    isScrollControlled: true,
    builder: (context) => StatefulBuilder(
      builder: (context, setModalState) {
        final products = ref.watch(productSearchProvider(query));
        return SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              16,
              20,
              16 + MediaQuery.of(context).viewInsets.bottom,
            ),
            child: SizedBox(
              height: 420,
              child: Column(
                children: [
                  TextField(
                    controller: controller,
                    decoration: const InputDecoration(labelText: "Ara"),
                    onChanged: (value) =>
                        setModalState(() => query = value.trim()),
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: products.when(
                      data: (items) => ListView(
                        children: items
                            .map(
                              (item) => ListTile(
                                onTap: () => Navigator.of(context).pop(item),
                                title: Text(item.name),
                                subtitle: Text(item.barcode ?? item.sku ?? "-"),
                              ),
                            )
                            .toList(),
                      ),
                      loading: () =>
                          const Center(child: CircularProgressIndicator()),
                      error: (error, _) =>
                          Center(child: Text(_friendlyError(error))),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    ),
  );
  controller.dispose();
  if (product == null || !context.mounted) {
    return;
  }
  await _upsertCountLine(context, ref, sessionId, product);
}

Future<void> _scanIntoCount(
  BuildContext context,
  WidgetRef ref,
  String sessionId,
) async {
  final code = await Navigator.of(context).push<String>(
    MaterialPageRoute(
      builder: (_) => const _ScannerPage(title: "Sayim barkodu tara"),
    ),
  );
  if (code == null || code.trim().isEmpty || !context.mounted) {
    return;
  }
  final repository = await ref.read(repositoryProvider.future);
  final product = await repository.findProductByBarcode(code.trim());
  if (product == null) {
    if (context.mounted) {
      _showSnackBar(context, "Barkod cache icinde bulunamadi.");
    }
    return;
  }
  if (!context.mounted) {
    return;
  }
  await _upsertCountLine(context, ref, sessionId, product, initialQty: 1);
}

Future<void> _editCountLine(
  BuildContext context,
  WidgetRef ref,
  StockCountLineRecord line,
) async {
  final product = LocalProduct(
    id: line.productId,
    name: line.productNameSnapshot,
    barcode: line.barcodeSnapshot,
    sku: null,
    categoryName: null,
    salePrice: 0,
    purchasePrice: 0,
    taxRate: 0,
    stockTracked: true,
    minStock: 0,
    isActive: true,
    stockQty: line.expectedQtySnapshot ?? 0,
    syncStatus: "synced",
    conflictState: "none",
    conflictReason: null,
    pendingVerification: false,
    updatedAt: line.updatedAt,
  );
  await _upsertCountLine(
    context,
    ref,
    line.sessionId,
    product,
    initialQty: line.countedQty,
  );
}

Future<void> _upsertCountLine(
  BuildContext context,
  WidgetRef ref,
  String sessionId,
  LocalProduct product, {
  double? initialQty,
}) async {
  final qtyController = TextEditingController(text: formatQty(initialQty ?? 1));
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(product.name),
      content: TextField(
        controller: qtyController,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: const InputDecoration(labelText: "Counted qty"),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text("Iptal"),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text("Kaydet"),
        ),
      ],
    ),
  );
  if (confirmed == true) {
    final repository = await ref.read(repositoryProvider.future);
    await repository.addProductToCount(
      sessionId: sessionId,
      product: product,
      countedQty: double.tryParse(qtyController.text.replaceAll(",", ".")) ?? 1,
    );
    refreshDataProviders(ref);
  }
  qtyController.dispose();
}

Future<void> _submitCount(
  BuildContext context,
  WidgetRef ref,
  String sessionId,
) async {
  try {
    final repository = await ref.read(repositoryProvider.future);
    await repository.submitStockCount(sessionId);
    refreshDataProviders(ref);
    if (!context.mounted) {
      return;
    }
    _showSnackBar(
      context,
      "Sayim submit edildi. Sync sonraki pencerede push edecek.",
    );
  } catch (error) {
    if (!context.mounted) {
      return;
    }
    await _handleOperationalError(
      context,
      ref,
      error,
      isMutation: true,
      cachedDataVisible: false,
    );
  }
}

Future<void> _refreshDashboardReadSurface(
  BuildContext context,
  WidgetRef ref,
) async {
  try {
    final repository = await ref.read(repositoryProvider.future);
    final dashboard = await repository.getDashboardSummaryRead(
      refreshFromNetwork: true,
    );
    final reports = await repository.getReportsSummary(
      refreshFromNetwork: true,
    );
    final branches = await repository.getBranchOverview(
      refreshFromNetwork: true,
    );
    refreshDataProviders(ref);
    if (context.mounted) {
      final anyStale = dashboard.isStale || reports.isStale || branches.isStale;
      _showSnackBar(context, _refreshResultMessage(anyStale, "Dashboard"));
    }
  } catch (error) {
    if (context.mounted) {
      await _handleOperationalError(
        context,
        ref,
        error,
        isMutation: false,
        cachedDataVisible: true,
      );
    }
  }
}

String _refreshResultMessage(bool stale, String scope) {
  if (stale) {
    return "$scope yenilenemedi, onbellekteki son veri gosteriliyor.";
  }
  return "$scope verileri guncellendi.";
}

Future<void> _handleOperationalError(
  BuildContext context,
  WidgetRef ref,
  Object error, {
  required bool isMutation,
  required bool cachedDataVisible,
}) async {
  final mapped = mapOperationalError(
    error,
    isMutation: isMutation,
    cachedDataVisible: cachedDataVisible,
  );

  if (mapped.requiresReauth) {
    await ref.read(appControllerProvider.notifier).refreshFromStore();
  }

  if (context.mounted) {
    _showSnackBar(context, mapped.message);
  }
}

String _friendlyError(Object error) {
  if (error is String && error.trim().isNotEmpty) {
    return error.trim();
  }
  return mapOperationalError(error, isMutation: false).message;
}

void _showSnackBar(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

Color _statusColor(String status) {
  switch (status) {
    case "synced":
      return MobileColors.success;
    case "submitted":
      return MobileColors.primary;
    case "failed":
      return MobileColors.danger;
    case "in_progress":
      return MobileColors.warning;
    default:
      return MobileColors.muted;
  }
}

IconData _activityIcon(String type) {
  final normalized = type.toLowerCase();
  if (normalized.contains("refund")) {
    return Icons.reply_outlined;
  }
  if (normalized.contains("stock")) {
    return Icons.inventory_outlined;
  }
  if (normalized.contains("sync")) {
    return Icons.sync_problem_outlined;
  }
  return Icons.receipt_long_outlined;
}

Color _activityColor(String type) {
  final normalized = type.toLowerCase();
  if (normalized.contains("refund")) {
    return MobileColors.warning;
  }
  if (normalized.contains("stock")) {
    return MobileColors.info;
  }
  if (normalized.contains("sync")) {
    return MobileColors.danger;
  }
  return MobileColors.primary;
}

enum TenantLifecycleState {
  trialActive,
  trialExpiring,
  trialExpired,
  subscriptionActive,
  subscriptionPastDue,
  subscriptionCanceled,
  suspendedBlocked,
}

class TenantLifecycleDescriptor {
  const TenantLifecycleDescriptor({
    required this.state,
    required this.label,
    required this.message,
    required this.nextAction,
    this.daysRemaining,
  });

  final TenantLifecycleState state;
  final String label;
  final String message;
  final String nextAction;
  final int? daysRemaining;
}

TenantLifecycleDescriptor resolveTenantLifecycle(
  AppShellState appState,
  SyncDiagnostics syncState,
) {
  final activation = appState.activation;
  if (activation == null) {
    return const TenantLifecycleDescriptor(
      state: TenantLifecycleState.subscriptionActive,
      label: "Durum yukleniyor",
      message: "Abonelik/lisans durumu dogrulaniyor.",
      nextAction: "Oturumu yenileyin.",
    );
  }

  final now = DateTime.now().toUtc();
  final status = activation.status.toLowerCase();
  final planCode = activation.planCode.toLowerCase();
  final blockedReason = (syncState.blockedReason ?? "").toLowerCase();

  final isSuspended =
      status.contains("suspend") ||
      status.contains("blocked") ||
      status.contains("lock") ||
      status.contains("revoked") ||
      status.contains("invalid") ||
      blockedReason.contains("suspend") ||
      blockedReason.contains("blocked") ||
      blockedReason.contains("license_invalid") ||
      blockedReason.contains("device_invalid");

  if (isSuspended) {
    return const TenantLifecycleDescriptor(
      state: TenantLifecycleState.suspendedBlocked,
      label: "Askida / Bloklu",
      message: "Hesap askida veya bloklu oldugu icin operasyon yazma akislari kapali.",
      nextAction: "Web portalden abonelik/lisans durumunu kontrol edin.",
    );
  }

  final isPastDue =
      status.contains("past_due") ||
      status.contains("past-due") ||
      blockedReason.contains("past_due") ||
      blockedReason.contains("past-due");
  if (isPastDue) {
    return const TenantLifecycleDescriptor(
      state: TenantLifecycleState.subscriptionPastDue,
      label: "Odeme Gecikmis",
      message:
          "Abonelik odemesi gecikmis. Operasyon acik; yeni cihaz aktivasyonu kisitli olabilir.",
      nextAction: "Odeme durumunu portalden guncelleyin.",
    );
  }

  final isCanceled =
      status.contains("subscription_canceled") ||
      status.contains("canceled") ||
      status.contains("cancelled") ||
      blockedReason.contains("subscription_canceled");
  if (isCanceled) {
    return const TenantLifecycleDescriptor(
      state: TenantLifecycleState.subscriptionCanceled,
      label: "Abonelik Iptal",
      message:
          "Abonelik iptal durumunda. Donem sonuna kadar izinli akislar devam eder, yenileme kapali olabilir.",
      nextAction: "Devam etmek icin aboneligi yeniden etkinlestirin.",
    );
  }

  final isTrial =
      status.contains("trial") ||
      planCode.contains("trial") ||
      status.contains("deneme");
  final expiry = activation.licenseExpiresAt;
  final expired = expiry != null && !expiry.isAfter(now);
  final daysRemaining =
      expiry == null
          ? null
          : (expiry.difference(now).inDays < 0
              ? 0
              : expiry.difference(now).inDays);

  final readOnlyHint =
      status.contains("trial_expired") ||
      status.contains("read_only") ||
      status.contains("readonly") ||
      status.contains("expired") ||
      blockedReason.contains("trial_expired") ||
      blockedReason.contains("read_only") ||
      blockedReason.contains("readonly") ||
      blockedReason.contains("expired");

  if (isTrial && (expired || readOnlyHint)) {
    return const TenantLifecycleDescriptor(
      state: TenantLifecycleState.trialExpired,
      label: "Deneme Bitti / Salt-Okunur",
      message:
          "Deneme suresi sona erdi. Yazma islemleri kapali, yalnizca goruntuleme acik.",
      nextAction: "Kesintisiz devam icin aktif plana gecin.",
    );
  }

  if (isTrial) {
    final safeDays = daysRemaining;
    if (safeDays != null && safeDays <= 3) {
      return TenantLifecycleDescriptor(
        state: TenantLifecycleState.trialExpiring,
        label: "Deneme Bitmek Uzere",
        message:
            "Deneme suresi kritik seviyede (${safeDays == 0 ? "Bugun son gun" : "$safeDays gun kaldi"}).",
        nextAction: "Kesinti olmamasi icin plan secimini tamamlayin.",
        daysRemaining: safeDays,
      );
    }

    return TenantLifecycleDescriptor(
      state: TenantLifecycleState.trialActive,
      label: "Deneme Aktif",
      message:
          safeDays == null
              ? "Deneme suresi aktif."
              : "Deneme suresi aktif (${safeDays == 0 ? "Bugun son gun" : "$safeDays gun kaldi"}).",
      nextAction: "Bitmeden once uygun plani secin.",
      daysRemaining: safeDays,
    );
  }

  if (readOnlyHint) {
    return const TenantLifecycleDescriptor(
      state: TenantLifecycleState.suspendedBlocked,
      label: "Operasyon Bloklu",
      message: "Lisans aktif olmadigi icin operasyon yazma akislari kapali.",
      nextAction: "Lisansi yenileyin veya destekle iletisime gecin.",
    );
  }

  return const TenantLifecycleDescriptor(
    state: TenantLifecycleState.subscriptionActive,
    label: "Abonelik Aktif",
    message: "Abonelik ve lisans aktif. Tum izinli operasyon akislari acik.",
    nextAction: "Normal operasyona devam edin.",
  );
}

Color tenantLifecycleColor(TenantLifecycleState state) {
  switch (state) {
    case TenantLifecycleState.trialActive:
      return MobileColors.info;
    case TenantLifecycleState.trialExpiring:
      return MobileColors.warning;
    case TenantLifecycleState.trialExpired:
      return MobileColors.warning;
    case TenantLifecycleState.subscriptionActive:
      return MobileColors.success;
    case TenantLifecycleState.subscriptionPastDue:
      return MobileColors.warning;
    case TenantLifecycleState.subscriptionCanceled:
      return MobileColors.warning;
    case TenantLifecycleState.suspendedBlocked:
      return MobileColors.danger;
  }
}

class _ReadFreshnessBanner<T> extends StatelessWidget {
  const _ReadFreshnessBanner({required this.read, required this.label});

  final CachedRead<T> read;
  final String label;

  @override
  Widget build(BuildContext context) {
    final freshness = resolveReadFreshness(read);
    final color = _freshnessColor(freshness);
    final statusText = freshnessLabel(freshness);
    final updatedText = lastUpdatedLabel(read.cachedAt);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        children: [
          Icon(Icons.history, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              "$label: $statusText · Son guncelleme: $updatedText",
              style: TextStyle(
                fontSize: 12,
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Color _freshnessColor(ReadFreshnessState state) {
  switch (state) {
    case ReadFreshnessState.fresh:
      return MobileColors.success;
    case ReadFreshnessState.cached:
      return MobileColors.info;
    case ReadFreshnessState.stale:
      return MobileColors.warning;
  }
}

class _CachedDataBanner extends StatelessWidget {
  const _CachedDataBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: MobileColors.warning.withValues(alpha: 0.12),
      child: Row(
        children: [
          const Icon(Icons.cloud_off, size: 16, color: MobileColors.warning),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(fontSize: 12, color: MobileColors.warning),
            ),
          ),
        ],
      ),
    );
  }
}
