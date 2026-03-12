import "dart:convert";

import "package:http/http.dart" as http;
import "package:loomapos_mobile/core/mobile_constants.dart";
import "package:loomapos_mobile/models/mobile_models.dart";

class MobileApiClient {
  MobileApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<Map<String, dynamic>> mobileLogin({
    required String email,
    required String password,
  }) async {
    return _decodeObject(
      await _client.post(
        Uri.parse("$kApiBase/commerce/auth/mobile-login"),
        headers: _jsonHeaders(),
        body: jsonEncode({"email": email.trim(), "password": password}),
      ),
    );
  }

  Future<Map<String, dynamic>> me(String accessToken) async {
    return _decodeObject(
      await _client.get(
        Uri.parse("$kApiBase/commerce/auth/me"),
        headers: _authHeaders(accessToken),
      ),
    );
  }

  Future<Map<String, dynamic>> getActiveLicense(String accessToken) async {
    return _decodeObject(
      await _client.get(
        Uri.parse("$kApiBase/commerce/portal/licenses/active"),
        headers: _authHeaders(accessToken),
      ),
    );
  }

  Future<Map<String, dynamic>> activateMobileDevice({
    required String licenseKey,
    required String deviceId,
    required String deviceName,
  }) async {
    return _decodeObject(
      await _client.post(
        Uri.parse("$kApiBase/commerce/license/activate"),
        headers: _jsonHeaders(),
        body: jsonEncode(
          {
            "licenseKey": licenseKey,
            "deviceId": deviceId,
            "deviceName": deviceName,
            "platform": "mobile",
            "appVersion": kMobileAppVersion,
            "source": "mobile",
          },
        ),
      ),
    );
  }

  Future<Map<String, dynamic>> heartbeat({
    required String deviceId,
  }) async {
    return _decodeObject(
      await _client.post(
        Uri.parse("$kApiBase/commerce/license/heartbeat"),
        headers: _jsonHeaders(),
        body: jsonEncode(
          {
            "deviceId": deviceId,
            "appVersion": kMobileAppVersion,
          },
        ),
      ),
    );
  }

  Future<Map<String, dynamic>> pullSync({
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
    return _decodeObject(
      await _client.get(
        uri,
        headers: _authHeaders(
          accessToken,
          tenantId: tenantId,
          branchId: branchId,
          deviceId: deviceId,
        ),
      ),
    );
  }

  Future<List<Map<String, dynamic>>> pushOutbox({
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
    final response = await _client.post(
      Uri.parse("$kApiBase/sync/events/batch"),
      headers: _authHeaders(
        accessToken,
        tenantId: tenantId,
        branchId: branchId,
        deviceId: deviceId,
      ),
      body: jsonEncode(body),
    );
    final decoded = _decodeObject(response);
    final results = decoded["results"];
    if (results is! List) {
      return [];
    }
    return results.whereType<Map<String, dynamic>>().toList();
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
        message: body.isEmpty ? "HTTP ${response.statusCode}" : body,
      );
    }

    if (body.isEmpty) {
      return {};
    }

    final decoded = jsonDecode(body);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }

    throw ApiException(
      statusCode: response.statusCode,
      message: "Beklenmeyen API cevabi alindi.",
    );
  }
}

class ApiException implements Exception {
  const ApiException({
    required this.statusCode,
    required this.message,
  });

  final int statusCode;
  final String message;

  @override
  String toString() => "ApiException($statusCode): $message";
}
