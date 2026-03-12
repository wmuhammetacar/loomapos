import "package:flutter/material.dart";

const kApiBase = String.fromEnvironment(
  "LOOMAPOS_API_BASE",
  defaultValue: "http://127.0.0.1:5000",
);
const kMobileAppVersion = "0.5.0";
const kOfflineGraceDays = 7;
const kSyncBatchSize = 20;

class MobileColors {
  static const primary = Color(0xFF0057D9);
  static const success = Color(0xFF0F9D58);
  static const warning = Color(0xFFE37400);
  static const danger = Color(0xFFD93025);
  static const background = Color(0xFFF3F6FB);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFD6DFEA);
  static const text = Color(0xFF102033);
  static const muted = Color(0xFF5C6B7E);
  static const info = Color(0xFF3B82F6);
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
