# Phase 3 Desktop POS Foundation

## 1) Architecture Summary

Phase 3 turns `apps/desktop-pos` into the first real operational layer of the POS ecosystem. The website remains commercial-only; cashier operations now start exclusively in the Electron desktop client.

The desktop foundation now has five runtime layers:

1. Secure Electron shell
   - `contextIsolation: true`
   - renderer access only through validated preload IPC
   - no operational logic in the renderer without main-process persistence
   - access and refresh tokens protected with Electron `safeStorage` when available

2. Desktop shell lifecycle
   - boot check
   - explicit desktop login contract backed by Phase 2 commerce auth
   - device activation
   - local activation/session validation
   - settings surface
   - ready state that unlocks POS workspace

3. Local transactional POS core
   - local SQLite persistence
   - local catalog lookup
   - cart
   - cash/card payment completion
   - local sale, payment, receipt persistence
   - outbox generation for future sync

4. Sync-ready service layer
   - outbox worker
   - sync state persistence
   - offline grace support
   - non-blocking print and fiscal extension points

5. Renderer application state + styling
   - shell/bootstrap state managed with Zustand
   - POS workspace keeps high-frequency cashier state local for speed
   - Tailwind-enabled renderer pipeline is active alongside the custom POS design CSS

Important implementation note:
- Operational cashier auth endpoints are not available yet in the backend.
- Phase 3 therefore uses a desktop login contract that currently delegates to the Phase 2 commercial customer account identity.
- Branch assignment is completed locally during activation/setup, which keeps the app usable and offline-first without waiting for a future branch provisioning API.

## 2) Local Database Schema

SQLite database: `loomapos-local.db`

Commercial/bootstrap tables:
- `app_settings`
- `local_session`
- `local_activation`
- `local_users`
- `local_branches`
- `sync_state`
- `local_audit_logs`

Operational cache + transaction tables:
- `local_products`
- `local_product_barcodes`
- `local_product_variants`
- `local_cart_drafts`
- `local_sales`
- `local_sale_lines`
- `local_payments`
- `local_receipts`
- `outbox_events`

Legacy compatibility tables kept in place:
- `products`
- `sales`
- `sale_lines`
- `payments`
- `stock_moves`
- `fiscal_jobs`
- `z_reports`

Key records:

`local_activation`
- `activation_id`
- `tenant_id`
- `branch_id`
- `branch_name`
- `device_id`
- `device_name`
- `license_id`
- `license_key`
- `license_token`
- `plan_code`
- `feature_flags_json`
- `activated_at`
- `expires_at`
- `grace_days`
- `last_validation_at`
- `offline_allowed_until`
- `status`

`local_session`
- `session_id`
- `tenant_id`
- `email`
- `display_name`
- `company_name`
- `portal_type`
- `roles_json`
- `access_token`
- `refresh_token`
- `expires_at`
- `refresh_expires_at`
- `last_validated_at`
- `offline_allowed_until`
- `status`

`local_sales`
- `local_sale_id`
- `cloud_sale_id`
- `tenant_id`
- `branch_id`
- `device_id`
- `cashier_user_id`
- `receipt_no_local`
- `status`
- `subtotal`
- `discount_total`
- `tax_total`
- `grand_total`
- `currency`
- `sync_status`
- `created_at`
- `updated_at`

`outbox_events`
- `event_id`
- `tenant_id`
- `branch_id`
- `device_id`
- `event_type`
- `aggregate_type`
- `aggregate_id`
- `payload_json`
- `status`
- `retry_count`
- `created_at`
- `last_try_at`
- `last_error`

## 3) Activation Flow Description

Startup flow:

1. App launches.
2. SQLite opens and device identity is resolved from `app_settings`.
3. Desktop shell asks main process for bootstrap state.
4. If no local activation exists, app enters activation flow.
5. If activation exists but no usable local session exists, app enters login flow.
6. If activation and session are both acceptable, POS workspace opens.

Activation flow:

1. Customer logs in via `/commerce/auth/desktop-login`.
2. Desktop fetches `/commerce/portal/company`, `/commerce/portal/licenses/active`, and when available `/commerce/portal/catalog/products`.
3. Operator enters local branch name/code and device name.
4. Desktop calls `/commerce/license/activate`.
5. App stores:
   - device identity
   - branch assignment
   - license snapshot
   - feature flags
   - offline grace window
6. Local product seed is guaranteed.
7. POS workspace becomes available.

Online validation flow:

1. When backend is reachable, desktop calls `/commerce/license/heartbeat`.
2. If portal token is still available, desktop also refreshes active license snapshot from `/commerce/portal/licenses/active`.
3. Activation record is updated with new validation timestamp and next offline grace window.

Offline continuation flow:

1. If backend is unreachable, desktop falls back to `local_activation`.
2. If `offline_allowed_until` is still in the future, device stays usable in `READ_ONLY`/offline mode.
3. If grace is exceeded, desktop enters locked state and blocks re-entry until revalidation.

## 4) Desktop Route / Screen Map

Renderer state map:

- `boot`
  - initial loading shell

- `activation_required`
  - login form if session missing
  - activation form if session exists
  - setup summary panel

- `login_required`
  - login form
  - stored device/license summary

- `locked`
  - blocked shell
  - re-login action
  - clear activation action

- `ready`
  - POS workspace
  - settings modal

POS workspace major surfaces:
- status bar
- barcode input
- product search
- cart table
- totals panel
- payment modal
- refund modal
- day-end modal
- sync panel
- license panel

## 5) State Management Approach

Renderer state is split into two scopes:

1. Shell state in `App.tsx`
   - bootstrap state
   - login credentials
   - activation context
   - settings modal

2. POS interaction state in `PosWorkspace.tsx`
   - cart lines
   - selected line
   - discount draft
   - payment modal state
   - refund flow state
   - day-end state
   - transient toast feedback

Persistence boundary:
- renderer state is not trusted for durability
- durable state is always written through IPC to SQLite
- cart draft is autosaved to `local_cart_drafts`
- completed sales are written locally first, then synced later

## 6) Outbox / Sync Model

Sale completion is local-first and transactional:

1. write sale header
2. write sale lines
3. write payment
4. write receipt payload
5. write stock movement
6. write outbox event
7. return success to UI

Current event types emitted:
- `SALE_CREATED`
- `SALE_VOIDED`
- `SALE_REFUND_CREATED`

Outbox worker behavior:
- polls pending and failed events
- applies exponential retry delay
- marks events as sent/failed
- persists summary into `sync_state`
- keeps sync isolated from cashier checkout speed

## 7) API Contract Expectations

Implemented Phase 2/3 integration points:

Auth:
- `POST /commerce/auth/desktop-login`
- `POST /commerce/auth/logout`

Portal bootstrap:
- `GET /commerce/portal/company`
- `GET /commerce/portal/licenses/active`
- `GET /commerce/portal/catalog/products`

License/device:
- `POST /commerce/license/activate`
- `POST /commerce/license/heartbeat`
- `POST /commerce/license/deactivate`

Health:
- `GET /health`

Still scaffolded / future-facing:
- operational cashier auth
- branch assignment API
- authenticated sync endpoint with device/user credentials

Current catalog bootstrap behavior:
- desktop first tries the portal-auth catalog endpoint
- if cloud catalog pull fails, local seeded catalog keeps POS usable offline

## 8) Error Handling Strategy

Handled failure classes:

- backend unreachable
  - bootstrap falls back to offline activation/session policy

- license heartbeat failure
  - app falls back to locally stored activation grace window

- missing activation
  - POS workspace is blocked until activation completes

- missing/expired session
  - login screen is shown before POS entry

- product not found
  - non-blocking warning modal

- printer failure
  - sale still completes locally

- sync failure
  - outbox event remains retryable
  - cashier flow does not block

- corrupted cart draft
  - draft is ignored and POS still opens

## 9) Implementation Checklist

- [x] Secure Electron shell remains isolated through preload IPC
- [x] Desktop boot lifecycle implemented
- [x] Local activation persistence implemented
- [x] Local session persistence implemented
- [x] Phase 2 customer login handoff wired to desktop
- [x] Branch/device setup added to activation flow
- [x] Local settings surface added
- [x] Local cart draft persistence added
- [x] Local sale/payment/receipt persistence expanded
- [x] Outbox aggregate metadata added
- [x] Sync state persistence added
- [x] Offline grace fallback implemented
- [x] Existing POS workspace preserved as operational core

## 10) Scaffold Code

Main process:
- `apps/desktop-pos/src/main/index.ts`
- `apps/desktop-pos/src/main/ipc/desktop-shell-ipc.ts`
- `apps/desktop-pos/src/main/ipc/pos-ipc.ts`
- `apps/desktop-pos/src/main/desktop/desktop-shell-service.ts`
- `apps/desktop-pos/src/main/backend/commerce-client.ts`
- `apps/desktop-pos/src/main/storage/local-db.ts`
- `apps/desktop-pos/src/main/storage/local-state-repository.ts`
- `apps/desktop-pos/src/main/pos/pos-service.ts`
- `apps/desktop-pos/src/main/sync/outbox-repository.ts`
- `apps/desktop-pos/src/main/sync/sync-worker.ts`

Renderer:
- `apps/desktop-pos/src/renderer/App.tsx`
- `apps/desktop-pos/src/renderer/PosWorkspace.tsx`
- `apps/desktop-pos/src/renderer/global.d.ts`
- `apps/desktop-pos/src/renderer/styles.css`

Validation:
- `npm run build`
- `cmd /c npm run smoke`
