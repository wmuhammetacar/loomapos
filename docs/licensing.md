# Licensing Model

## 1. Issued License Payload
MVP uses signed token (HMAC JWT) with claims:
- `tenant_id`
- `plan`
- `billing_cycle`
- `max_branches`
- `max_users`
- `max_devices`
- `features` (JSON array)
- `grace_days`
- `exp`

Source table:
- `licenses`

## 2. Activation Flow
1. Checkout success creates subscription + invoice + license.
2. Desktop/Mobile calls `POST /license/activate` with device info.
3. API validates:
   - active license exists,
   - not locked,
   - device limit not exceeded.
4. API upserts `device_activations` and writes `license_events`.
5. Client receives runtime mode and grace info.

## 3. Runtime Modes
- `ACTIVE`: before `expires_at`.
- `READ_ONLY`: after `expires_at`, within `grace_days`.
- `LOCKED`: grace window ended or activation denied.

Recommended product policy:
- `ACTIVE`: full POS.
- `READ_ONLY`: reports + limited settings only.
- `LOCKED`: block transactional operations.

## 4. Offline Behavior
- Clients cache activation result and expiry locally.
- If server unreachable:
  - continue with last known license state,
  - respect grace window,
  - force revalidation when back online.
- Desktop cache file: `%APPDATA%/LoomaPOS/license-status.json` equivalent Electron `userData` path.
- Mobile cache (MVP): in-memory/session grace fallback during app runtime; persistent cache can be promoted in v1.1.

## 5. Device Limit Enforcement
- Active devices counted from `device_activations` where `revoked_at IS NULL`.
- Existing active device heartbeat does not consume extra slot.
- New activation over limit returns `403`.

## 6. Edge Cases
- Duplicate activation on same device:
  - idempotent update (`last_seen_at` refresh).
- Expired license with grace:
  - mode becomes `READ_ONLY`, not immediate hard lock.
- Expired + grace ended:
  - activation rejected (`LOCKED`).
- Missing tenant context:
  - activation/status returns `400`.

## 7. Security Notes
- Signing key from `Licensing:SigningKey`.
- Rotate key in production and version claims if needed.
- Never trust client-only validation for entitlement changes; server remains source of truth.
