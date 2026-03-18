import "package:flutter/material.dart";

const kApiBase = String.fromEnvironment(
  "LOOMAPOS_API_BASE",
  defaultValue: "http://127.0.0.1:5000",
);
const kMobileAppVersion = "0.5.0";
const kOfflineGraceDays = 7;
const kSyncBatchSize = 20;

class MobileColors {
  static const primary = Color(0xFF0F6CBD);
  static const secondary = Color(0xFF0F766E);
  static const accent = Color(0xFFF59E0B);

  static const success = Color(0xFF15803D);
  static const warning = Color(0xFFD97706);
  static const danger = Color(0xFFDC2626);
  static const info = Color(0xFF2563EB);

  static const background = Color(0xFFF6F8FC);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFD7E0EA);
  static const text = Color(0xFF122033);
  static const muted = Color(0xFF5B6C80);
}

class MobileDarkColors {
  static const primary = Color(0xFF63B3FF);
  static const secondary = Color(0xFF4FD1C5);
  static const accent = Color(0xFFF6C453);

  static const success = Color(0xFF4ADE80);
  static const warning = Color(0xFFFBBF24);
  static const danger = Color(0xFFF87171);
  static const info = Color(0xFF60A5FA);

  static const background = Color(0xFF0B1220);
  static const surface = Color(0xFF111A2A);
  static const border = Color(0xFF2C3A4D);
  static const text = Color(0xFFE7EEF9);
  static const muted = Color(0xFF9FB1C9);
}

class MobileActions {
  static const dashboardView = "dashboard.view";
  static const dashboardViewAllBranches = "dashboard.view.all_branches";
  static const recentSalesView = "recent_sales.view";
  static const reportsSummaryView = "reports.summary.view";
  static const productLookup = "product.lookup";
  static const productCreate = "product.create";
  static const productEdit = "product.edit";
  static const branchSwitch = "branch.switch";
  static const stockCountCreate = "stock_count.create";
  static const stockCountSubmit = "stock_count.submit";
  static const stockAdjustment = "stock.adjust";
  static const settingsAccess = "settings.access";
}
