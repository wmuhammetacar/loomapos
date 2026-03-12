String formatMoney(num value) => "${value.toStringAsFixed(2)} TL";

String formatDateTimeShort(DateTime value) {
  final local = value.toLocal();
  final dd = local.day.toString().padLeft(2, "0");
  final mm = local.month.toString().padLeft(2, "0");
  final hh = local.hour.toString().padLeft(2, "0");
  final min = local.minute.toString().padLeft(2, "0");
  return "$dd.$mm $hh:$min";
}

String formatClock(DateTime value) {
  final local = value.toLocal();
  final hh = local.hour.toString().padLeft(2, "0");
  final mm = local.minute.toString().padLeft(2, "0");
  return "$hh:$mm";
}

String formatQty(num value) {
  final normalized = value.toStringAsFixed(value % 1 == 0 ? 0 : 3);
  return normalized;
}
