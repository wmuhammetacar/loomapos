import "dart:async";
import "dart:convert";
import "dart:io";

import "package:http/http.dart" as http;
import "package:loomapos_mobile/core/mobile_constants.dart";
import "package:loomapos_mobile/data/mobile_api_contracts.dart";
import "package:loomapos_mobile/models/mobile_models.dart";

enum ApiErrorKind {
  unauthorized,
  forbidden,
  notFound,
  validation,
  server,
  timeout,
  network,
  contract,
  unknown,
}

class MobileApiClient {
  MobileApiClient({
    http.Client? client,
    Duration? timeout,
    int safeGetRetryCount = 2,
  }) : _client = client ?? http.Client(),
       _timeout = timeout ?? const Duration(seconds: 12),
       _safeGetRetryCount = safeGetRetryCount;

  final http.Client _client;
  final Duration _timeout;
  final int _safeGetRetryCount;

  Future<MobileLoginResponse> mobileLogin({
    required String email,
    required String password,
  }) async {
    final json = await _requestObject(
      method: "POST",
      uri: Uri.parse("$kApiBase/commerce/auth/mobile-login"),
      headers: _jsonHeaders(),
      body: {"email": email.trim(), "password": password},
    );
    return _parseContract(
      () => MobileLoginResponse.fromJson(json),
      endpoint: "/commerce/auth/mobile-login",
    );
  }

  Future<MeResponse> me(String accessToken) async {
    final json = await _requestObject(
      method: "GET",
      uri: Uri.parse("$kApiBase/commerce/auth/me"),
      headers: _authHeaders(accessToken),
      retrySafeGet: true,
    );
    return _parseContract(
      () => MeResponse.fromJson(json),
      endpoint: "/commerce/auth/me",
    );
  }

  Future<ActiveLicenseResponse> getActiveLicense(
    String accessToken, {
    String? tenantId,
  }) async {
    final json = await _requestObject(
      method: "GET",
      uri: Uri.parse("$kApiBase/commerce/portal/licenses/active"),
      headers: _authHeaders(accessToken, tenantId: tenantId),
      retrySafeGet: true,
    );
    return _parseContract(
      () => ActiveLicenseResponse.fromJson(json),
      endpoint: "/commerce/portal/licenses/active",
    );
  }

  Future<ActivateDeviceResponse> activateMobileDevice({
    required String licenseKey,
    required String deviceId,
    required String deviceName,
    String? tenantId,
  }) async {
    final json = await _requestObject(
      method: "POST",
      uri: Uri.parse("$kApiBase/commerce/license/activate"),
      headers: {
        ..._jsonHeaders(),
        if (tenantId != null) "X-Tenant-Id": tenantId,
      },
      body: {
        "licenseKey": licenseKey,
        "deviceId": deviceId,
        "deviceName": deviceName,
        "platform": "mobile",
        "appVersion": kMobileAppVersion,
        "source": "mobile",
      },
    );
    return _parseContract(
      () => ActivateDeviceResponse.fromJson(json),
      endpoint: "/commerce/license/activate",
    );
  }

  Future<HeartbeatResponse> heartbeat({required String deviceId}) async {
    final json = await _requestObject(
      method: "POST",
      uri: Uri.parse("$kApiBase/commerce/license/heartbeat"),
      headers: _jsonHeaders(),
      body: {"deviceId": deviceId, "appVersion": kMobileAppVersion},
    );
    return _parseContract(
      () => HeartbeatResponse.fromJson(json),
      endpoint: "/commerce/license/heartbeat",
    );
  }

  Future<PullSyncResponse> pullSync({
    required String accessToken,
    required String tenantId,
    required String deviceId,
    String? branchId,
    DateTime? since,
  }) async {
    final uri = Uri.parse("$kApiBase/sync/pull").replace(
      queryParameters: {
        if (since != null) "since": since.toUtc().toIso8601String(),
      },
    );

    final json = await _requestObject(
      method: "GET",
      uri: uri,
      headers: _authHeaders(
        accessToken,
        tenantId: tenantId,
        branchId: branchId,
        deviceId: deviceId,
      ),
      retrySafeGet: true,
    );
    return PullSyncResponse.fromJson(json);
  }

  Future<PushOutboxResponse> pushOutbox({
    required String accessToken,
    required String tenantId,
    required String branchId,
    required String deviceId,
    required List<LocalOutboxEvent> events,
  }) async {
    final body = {
      "events": events
          .map(
            (event) => {
              "eventId": event.id,
              "tenantId": tenantId,
              "branchId": branchId,
              "deviceId": deviceId,
              "eventType": event.eventType,
              "aggregateType": event.aggregateType,
              "aggregateId": event.aggregateId,
              "payloadVersion": event.payloadVersion,
              "payload": jsonDecode(event.payloadJson),
            },
          )
          .toList(),
    };

    final json = await _requestObject(
      method: "POST",
      uri: Uri.parse("$kApiBase/sync/events/batch"),
      headers: _authHeaders(
        accessToken,
        tenantId: tenantId,
        branchId: branchId,
        deviceId: deviceId,
      ),
      body: body,
    );

    return _parseContract(
      () => PushOutboxResponse.fromJson(json),
      endpoint: "/sync/events/batch",
    );
  }

  T _parseContract<T>(T Function() parser, {required String endpoint}) {
    try {
      return parser();
    } on FormatException catch (error) {
      throw ApiException(
        statusCode: null,
        kind: ApiErrorKind.contract,
        message: "API cevabi beklenen formatta degil.",
        details: "[$endpoint] ${error.message}",
      );
    }
  }

  Future<Map<String, dynamic>> _requestObject({
    required String method,
    required Uri uri,
    required Map<String, String> headers,
    Object? body,
    bool retrySafeGet = false,
  }) async {
    final requestBody = body == null ? null : jsonEncode(body);
    final maxAttempts = retrySafeGet ? (_safeGetRetryCount + 1) : 1;

    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        final response = await _send(
          method: method,
          uri: uri,
          headers: headers,
          requestBody: requestBody,
        ).timeout(_timeout);

        if (_shouldRetryStatus(response.statusCode, attempt, maxAttempts)) {
          await Future<void>.delayed(_retryDelay(attempt));
          continue;
        }

        return _decodeObject(response);
      } on TimeoutException {
        if (attempt < maxAttempts) {
          await Future<void>.delayed(_retryDelay(attempt));
          continue;
        }
        throw const ApiException(
          statusCode: null,
          kind: ApiErrorKind.timeout,
          message: "Sunucu zaman asimina ugradi.",
        );
      } on SocketException {
        if (attempt < maxAttempts) {
          await Future<void>.delayed(_retryDelay(attempt));
          continue;
        }
        throw const ApiException(
          statusCode: null,
          kind: ApiErrorKind.network,
          message: "Ag baglantisi kurulamadi.",
        );
      }
    }

    throw const ApiException(
      statusCode: null,
      kind: ApiErrorKind.unknown,
      message: "Istek islenemedi.",
    );
  }

  Duration _retryDelay(int attempt) {
    final seconds = attempt <= 1 ? 1 : (attempt * 2);
    return Duration(seconds: seconds);
  }

  bool _shouldRetryStatus(int statusCode, int attempt, int maxAttempts) {
    if (attempt >= maxAttempts) {
      return false;
    }
    return statusCode == 408 ||
        statusCode == 429 ||
        statusCode == 500 ||
        statusCode == 502 ||
        statusCode == 503 ||
        statusCode == 504;
  }

  Future<http.Response> _send({
    required String method,
    required Uri uri,
    required Map<String, String> headers,
    required String? requestBody,
  }) {
    switch (method) {
      case "GET":
        return _client.get(uri, headers: headers);
      case "POST":
        return _client.post(uri, headers: headers, body: requestBody);
      default:
        throw ArgumentError("Desteklenmeyen HTTP methodu: $method");
    }
  }

  Map<String, String> _jsonHeaders() => const {
    "Content-Type": "application/json",
  };

  Map<String, String> _authHeaders(
    String accessToken, {
    String? tenantId,
    String? branchId,
    String? deviceId,
  }) {
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer $accessToken",
      if (tenantId != null) "X-Tenant-Id": tenantId,
      if (branchId != null) "X-Branch-Id": branchId,
      if (deviceId != null) "X-Device-Id": deviceId,
    };
  }

  Map<String, dynamic> _decodeObject(http.Response response) {
    final body = response.body.trim();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        statusCode: response.statusCode,
        kind: _mapStatusToKind(response.statusCode),
        message: _errorMessageFromBody(body, response.statusCode),
        details: body.isEmpty ? null : body,
      );
    }

    if (body.isEmpty) {
      return <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      throw const FormatException("JSON object bekleniyordu.");
    } on FormatException {
      throw const ApiException(
        statusCode: null,
        kind: ApiErrorKind.contract,
        message: "API cevabi JSON object formatinda degil.",
      );
    }
  }

  ApiErrorKind _mapStatusToKind(int statusCode) {
    if (statusCode == 401) {
      return ApiErrorKind.unauthorized;
    }
    if (statusCode == 403) {
      return ApiErrorKind.forbidden;
    }
    if (statusCode == 404) {
      return ApiErrorKind.notFound;
    }
    if (statusCode == 422) {
      return ApiErrorKind.validation;
    }
    if (statusCode >= 500) {
      return ApiErrorKind.server;
    }
    return ApiErrorKind.unknown;
  }

  String _errorMessageFromBody(String body, int statusCode) {
    if (body.isNotEmpty) {
      try {
        final decoded = jsonDecode(body);
        if (decoded is Map<String, dynamic>) {
          final message = decoded["message"]?.toString().trim();
          if (message != null && message.isNotEmpty) {
            return message;
          }
          final error = decoded["error"]?.toString().trim();
          if (error != null && error.isNotEmpty) {
            return error;
          }
          final title = decoded["title"]?.toString().trim();
          if (title != null && title.isNotEmpty) {
            return title;
          }
        }
      } on FormatException {
        // ignore and fallback
      }
    }

    switch (_mapStatusToKind(statusCode)) {
      case ApiErrorKind.unauthorized:
        return "Oturum suresi doldu. Lutfen tekrar giris yapin.";
      case ApiErrorKind.forbidden:
        return "Bu islem icin yetkiniz yok.";
      case ApiErrorKind.notFound:
        return "Istenen kayit bulunamadi.";
      case ApiErrorKind.validation:
        return "Gonderilen bilgiler dogrulanamadi.";
      case ApiErrorKind.server:
        return "Sunucu su anda istekleri isleyemiyor.";
      case ApiErrorKind.timeout:
      case ApiErrorKind.network:
      case ApiErrorKind.contract:
      case ApiErrorKind.unknown:
        return "Istek basarisiz oldu.";
    }
  }
}

class ApiException implements Exception {
  const ApiException({
    required this.statusCode,
    required this.kind,
    required this.message,
    this.details,
  });

  final int? statusCode;
  final ApiErrorKind kind;
  final String message;
  final String? details;

  String get userMessage => message;

  @override
  String toString() {
    final statusText = statusCode == null ? "-" : statusCode.toString();
    return "ApiException(kind: $kind, status: $statusText, message: $message)";
  }
}
