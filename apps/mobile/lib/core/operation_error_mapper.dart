import "package:loomapos_mobile/data/mobile_api_client.dart";
import "package:loomapos_mobile/data/mobile_repository.dart";

class OperationalErrorView {
  const OperationalErrorView({
    required this.message,
    required this.requiresReauth,
  });

  final String message;
  final bool requiresReauth;
}

OperationalErrorView mapOperationalError(
  Object error, {
  required bool isMutation,
  bool cachedDataVisible = false,
}) {
  if (error is AuthExpiredException) {
    return const OperationalErrorView(
      message: "Oturum suresi doldu. Lutfen tekrar giris yapin.",
      requiresReauth: true,
    );
  }

  if (error is ApiException) {
    final base = _apiMessage(error, isMutation: isMutation);
    final withCache = !isMutation && cachedDataVisible
        ? "$base Son onbellek verisi gosteriliyor."
        : base;
    return OperationalErrorView(
      message: withCache,
      requiresReauth: error.kind == ApiErrorKind.unauthorized,
    );
  }

  return OperationalErrorView(
    message: isMutation
        ? "Islem su an tamamlanamadi. Lutfen tekrar deneyin."
        : "Veri su an guncellenemedi. Lutfen tekrar deneyin.",
    requiresReauth: false,
  );
}

String _apiMessage(ApiException error, {required bool isMutation}) {
  switch (error.kind) {
    case ApiErrorKind.timeout:
      return isMutation
          ? "Istek zaman asimina ugradi. Islem tamamlanmadi, tekrar deneyin."
          : "Sunucu yaniti gecikti (zaman asimi).";
    case ApiErrorKind.network:
      return isMutation
          ? "Baglanti kurulamadigi icin islem tamamlanmadi. Tekrar deneyin."
          : "Baglanti sorunu nedeniyle veri yenilenemedi.";
    case ApiErrorKind.server:
      return isMutation
          ? "Sunucu su an islemi tamamlayamiyor. Biraz sonra tekrar deneyin."
          : "Sunucu su an musait degil. Veri guncelleme tamamlanamadi.";
    case ApiErrorKind.unauthorized:
      return "Oturum suresi doldu. Lutfen tekrar giris yapin.";
    case ApiErrorKind.forbidden:
      return "Bu islem icin yetkiniz bulunmuyor (403).";
    case ApiErrorKind.validation:
      return isMutation
          ? "Gonderilen bilgiler dogrulanamadi (422). Lutfen alanlari kontrol edin."
          : "Veri dogrulanamadi. Lutfen tekrar deneyin.";
    case ApiErrorKind.notFound:
      return "Istenen kayit bulunamadi.";
    case ApiErrorKind.contract:
      return "Sunucudan beklenmeyen cevap alindi. Tekrar deneyin.";
    case ApiErrorKind.unknown:
      return error.userMessage;
  }
}
