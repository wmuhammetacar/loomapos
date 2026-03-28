import "package:loomapos_mobile/models/mobile_models.dart";

enum ReadFreshnessState { fresh, cached, stale }

const Duration _cachedStateThreshold = Duration(minutes: 15);

ReadFreshnessState resolveReadFreshness<T>(
  CachedRead<T> read, {
  DateTime? now,
}) {
  if (!read.isStale && read.source == "live") {
    return ReadFreshnessState.fresh;
  }

  if (read.source == "cache") {
    final at = read.cachedAt;
    if (at == null) {
      return ReadFreshnessState.stale;
    }
    final age = (now ?? DateTime.now().toUtc()).difference(at.toUtc());
    if (age <= _cachedStateThreshold) {
      return ReadFreshnessState.cached;
    }
    return ReadFreshnessState.stale;
  }

  return read.isStale ? ReadFreshnessState.stale : ReadFreshnessState.cached;
}

String freshnessLabel(ReadFreshnessState state) {
  switch (state) {
    case ReadFreshnessState.fresh:
      return "Canli";
    case ReadFreshnessState.cached:
      return "Onbellek";
    case ReadFreshnessState.stale:
      return "Eski";
  }
}

String lastUpdatedLabel(
  DateTime? updatedAt, {
  DateTime? now,
}) {
  if (updatedAt == null) {
    return "Bilinmiyor";
  }
  final current = now ?? DateTime.now().toUtc();
  final age = current.difference(updatedAt.toUtc());
  if (age.inSeconds < 60) {
    return "Az once";
  }
  if (age.inMinutes < 60) {
    return "${age.inMinutes} dk once";
  }
  if (age.inHours < 24) {
    return "${age.inHours} sa once";
  }
  return "${age.inDays} gun once";
}

class RefreshStateTracker {
  bool _refreshing = false;

  bool get refreshing => _refreshing;

  Future<T> run<T>(Future<T> Function() action) async {
    _refreshing = true;
    try {
      return await action();
    } finally {
      _refreshing = false;
    }
  }
}
