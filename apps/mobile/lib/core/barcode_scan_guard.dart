class BarcodeScanGuard {
  BarcodeScanGuard({
    this.debounceWindow = const Duration(milliseconds: 450),
    this.duplicateSuppressionWindow = const Duration(seconds: 2),
  });

  final Duration debounceWindow;
  final Duration duplicateSuppressionWindow;

  String? _lastCode;
  DateTime? _lastSeenAt;

  bool shouldHandle(String code, {DateTime? now}) {
    final normalized = code.trim();
    if (normalized.isEmpty) {
      return false;
    }
    final current = now ?? DateTime.now();

    if (_lastSeenAt != null && current.difference(_lastSeenAt!) <= debounceWindow) {
      return false;
    }

    if (_lastCode == normalized && _lastSeenAt != null && current.difference(_lastSeenAt!) <= duplicateSuppressionWindow) {
      return false;
    }

    _lastCode = normalized;
    _lastSeenAt = current;
    return true;
  }

  void reset() {
    _lastCode = null;
    _lastSeenAt = null;
  }
}
