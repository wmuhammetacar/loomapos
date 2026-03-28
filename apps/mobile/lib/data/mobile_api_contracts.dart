class MobileLoginResponse {
  const MobileLoginResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.tenantId,
    required this.expiresAt,
    required this.roles,
  });

  final String accessToken;
  final String refreshToken;
  final String tenantId;
  final DateTime expiresAt;
  final List<String> roles;

  factory MobileLoginResponse.fromJson(Map<String, dynamic> json) {
    return MobileLoginResponse(
      accessToken: _requiredString(json, "accessToken"),
      refreshToken: _requiredString(json, "refreshToken"),
      tenantId: _requiredString(json, "tenantId"),
      expiresAt: _requiredDateTime(json, "expiresAt"),
      roles: _stringList(json["roles"]),
    );
  }
}

class MeResponse {
  const MeResponse({
    required this.customerAccountId,
    required this.email,
    required this.displayName,
    required this.role,
    required this.companyName,
  });

  final String? customerAccountId;
  final String email;
  final String displayName;
  final String role;
  final String? companyName;

  factory MeResponse.fromJson(Map<String, dynamic> json) {
    return MeResponse(
      customerAccountId: _nullableString(json["customerAccountId"]),
      email: _requiredString(json, "email"),
      displayName: _requiredString(json, "displayName"),
      role: _requiredString(json, "role"),
      companyName: _nullableString(json["companyName"]),
    );
  }
}

class ActiveLicenseResponse {
  const ActiveLicenseResponse({
    required this.id,
    required this.planCode,
    required this.licenseKey,
    required this.expiresAt,
  });

  final String id;
  final String planCode;
  final String licenseKey;
  final DateTime? expiresAt;

  factory ActiveLicenseResponse.fromJson(Map<String, dynamic> json) {
    return ActiveLicenseResponse(
      id: _requiredString(json, "id"),
      planCode: _requiredString(json, "planCode"),
      licenseKey: _requiredString(json, "licenseKey"),
      expiresAt: _nullableDateTime(json["expiresAt"]),
    );
  }
}

class ActivateDeviceResponse {
  const ActivateDeviceResponse({required this.id, required this.licenseId});

  final String id;
  final String licenseId;

  factory ActivateDeviceResponse.fromJson(Map<String, dynamic> json) {
    return ActivateDeviceResponse(
      id: _requiredString(json, "id"),
      licenseId: _requiredString(json, "licenseId"),
    );
  }
}

class HeartbeatResponse {
  const HeartbeatResponse({
    required this.licenseStatus,
    required this.expiresAt,
    required this.lifecycleState,
    required this.canCheckout,
    required this.canWrite,
    required this.canSync,
    required this.canView,
    required this.requiresUpgradeAction,
    required this.requiresBlock,
    required this.allowedActions,
    required this.blockedActions,
  });

  final String licenseStatus;
  final DateTime? expiresAt;
  final String? lifecycleState;
  final bool? canCheckout;
  final bool? canWrite;
  final bool? canSync;
  final bool? canView;
  final bool? requiresUpgradeAction;
  final bool? requiresBlock;
  final List<String> allowedActions;
  final List<String> blockedActions;

  factory HeartbeatResponse.fromJson(Map<String, dynamic> json) {
    return HeartbeatResponse(
      licenseStatus: _requiredString(json, "licenseStatus"),
      expiresAt: _nullableDateTime(json["expiresAt"]),
      lifecycleState: _nullableString(json["lifecycleState"]),
      canCheckout: _nullableBool(json["canCheckout"]),
      canWrite: _nullableBool(json["canWrite"]),
      canSync: _nullableBool(json["canSync"]),
      canView: _nullableBool(json["canView"]),
      requiresUpgradeAction: _nullableBool(json["requiresUpgradeAction"]),
      requiresBlock: _nullableBool(json["requiresBlock"]),
      allowedActions: _stringList(json["allowedActions"]),
      blockedActions: _stringList(json["blockedActions"]),
    );
  }
}

class PullSyncResponse {
  const PullSyncResponse({required this.payload});

  final Map<String, dynamic> payload;

  factory PullSyncResponse.fromJson(Map<String, dynamic> json) {
    return PullSyncResponse(payload: json);
  }
}

class PushOutboxResult {
  const PushOutboxResult({
    required this.eventId,
    required this.status,
    required this.message,
    required this.errorCode,
  });

  final String eventId;
  final String status;
  final String? message;
  final String? errorCode;

  factory PushOutboxResult.fromJson(Map<String, dynamic> json) {
    return PushOutboxResult(
      eventId: _requiredString(json, "eventId"),
      status: _requiredString(json, "status"),
      message: _nullableString(json["message"]),
      errorCode: _nullableString(json["errorCode"]),
    );
  }
}

class PushOutboxResponse {
  const PushOutboxResponse({required this.results});

  final List<PushOutboxResult> results;

  factory PushOutboxResponse.fromJson(Map<String, dynamic> json) {
    final rawResults = json["results"];
    if (rawResults is! List) {
      return const PushOutboxResponse(results: []);
    }

    final items = <PushOutboxResult>[];
    for (final item in rawResults) {
      if (item is Map<String, dynamic>) {
        items.add(PushOutboxResult.fromJson(item));
      }
    }
    return PushOutboxResponse(results: items);
  }
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key]?.toString().trim();
  if (value == null || value.isEmpty) {
    throw FormatException("Eksik zorunlu alan: $key");
  }
  return value;
}

String? _nullableString(Object? value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) {
    return null;
  }
  return text;
}

bool? _nullableBool(Object? value) {
  if (value is bool) {
    return value;
  }

  if (value is num) {
    return value != 0;
  }

  final text = value?.toString().trim().toLowerCase();
  if (text == null || text.isEmpty) {
    return null;
  }
  if (text == "true" || text == "1") {
    return true;
  }
  if (text == "false" || text == "0") {
    return false;
  }

  return null;
}

DateTime _requiredDateTime(Map<String, dynamic> json, String key) {
  final value = _requiredString(json, key);
  final parsed = DateTime.tryParse(value)?.toUtc();
  if (parsed == null) {
    throw FormatException("Gecersiz tarih alani: $key");
  }
  return parsed;
}

DateTime? _nullableDateTime(Object? value) {
  if (value == null) {
    return null;
  }
  return DateTime.tryParse(value.toString())?.toUtc();
}

List<String> _stringList(Object? value) {
  if (value is! List) {
    return [];
  }
  return value.map((item) => item.toString()).toList();
}
