# Phase 4 Operational Engine

## 1) Architecture Summary

Phase 4 turns the desktop client from a local cashier foundation into a more operationally credible retail engine. The website remains commercial-only; real POS operations continue to live only in desktop/mobile clients.

This phase hardens four runtime layers:

1. Local operational integrity
   - sales, refunds, payments, receipts, stock moves and outbox events are written locally first
   - receipt numbering is offline-safe and device/session scoped
   - refunds are linked records, not destructive sale deletion

2. Sync engine
   - production-style outbox statuses
   - batch push endpoint with per-event acknowledgement
   - dead-letter support
   - exponential backoff
   - pull refresh for product/config/license/permission snapshots
   - heartbeat event generation

3. Operational session layer
   - cash session / shift open-close flow
   - cash adjustments
   - X/Z foundations sourced from local session data
   - sync-visible diagnostics

4. Hardware abstraction
   - explicit receipt printer adapter
   - cash drawer adapter
   - barcode input handler interface
   - customer display service marker

## 2) Sync Lifecycle Description

Push flow:

1. Desktop completes sale/refund/shift/cash action locally.
2. Immutable outbox event is written with payload version and checksum.
3. Background dispatcher marks dispatchable events as `SENDING`.
4. Dispatcher submits a batch to `/sync/events/batch`.
5. Backend returns per-event ack:
   - `accepted`
   - `duplicate`
   - `retry_later`
   - `rejected`
   - `device_invalid`
   - `license_invalid`
6. Desktop updates local event status:
   - `accepted` / `duplicate` -> `SENT`
   - `retry_later` -> `FAILED` with next retry timestamp
   - `rejected` / invalid device/license -> `DEAD_LETTER`

Pull flow:

1. Desktop periodically calls `/sync/pull`.
2. Product cache is refreshed.
3. Permission snapshot and license runtime state are refreshed.
4. Branch snapshot is updated locally when present.

Heartbeat flow:

1. Desktop periodically enqueues `DEVICE_HEARTBEAT`.
2. Payload includes pending outbox count, app version, cash-session state and printer configuration status.
3. Heartbeat never blocks cashier flow.

## 3) Local Database Additions / Changes

New or hardened tables:

- `local_refunds`
- `local_refund_lines`
- `local_stock_moves`
- `local_stock_snapshot`
- `local_cash_sessions`
- `local_cash_adjustments`
- `local_user_sessions`
- `outbox_events` extended with:
  - `payload_version`
  - `next_retry_at`
  - `server_ack_at`
  - `server_reference_id`
  - `checksum`
  - `error_code`
  - `error_message`
- `sync_state` extended with:
  - `dead_letter_count`
  - `last_pull_at`
  - `last_heartbeat_at`
  - `connection_quality`
  - `blocked_reason`
- `local_sales` extended with:
  - `cash_session_id`
  - `customer_name`
  - `original_sale_id`

## 4) Event Type Catalog

Implemented event types:

- `SALE_CREATED`
- `SALE_PAYMENT_RECORDED`
- `SALE_REFUND_CREATED`
- `SALE_VOIDED`
- `CASH_SESSION_OPENED`
- `CASH_SESSION_CLOSED`
- `CASH_ADJUSTMENT_RECORDED`
- `DEVICE_HEARTBEAT`
- `USER_SESSION_STARTED`
- `USER_SESSION_ENDED`
- `STOCK_ADJUSTMENT_RECORDED`

## 5) Refund / Stock / Session Rules

Refund:

- original sale remains immutable
- refund is a new linked record
- refund receipt number is separate
- return-to-stock is explicit
- refund reason can be captured

Stock:

- stock effects are ledger-style moves
- sales decrease stock
- refunds increase stock only when `return_to_stock = true`
- stock-tracked/service-item flags are respected locally
- silent stock mutation is avoided

Cash session:

- shift open creates an active cash session
- sales/refunds/payments link to the active session
- cash adjustments affect expected cash
- shift close produces a Z foundation snapshot and outbox event

## 6) Backend Contract Expectations

Implemented desktop-facing sync contracts:

- `POST /sync/events`
- `POST /sync/events/batch`
- `GET /sync/pull`

Pull contract currently returns:

- product snapshots
- branch snapshot
- permission role snapshot
- license snapshot
- feature flags

## 7) UI / Screen Additions

Desktop renderer additions:

- shift status in top bar
- shift open modal
- cash adjustment modal
- diagnostics modal
- dead-letter retry action
- expanded hotkeys:
  - `F5` shift
  - `F6` cash adjustment
  - `F8` diagnostics

## 8) Hardware Abstraction Design

New adapter surface:

- `IReceiptPrinter`
- `ICashDrawer`
- `IBarcodeInputHandler`
- `ICustomerDisplayService`

Current concrete behavior:

- printer -> ESC/POS adapter
- cash drawer -> printer-trigger-based adapter
- scanner -> keyboard wedge normalization
- customer display -> Electron secondary window

## 9) Failure Recovery Strategy

- Sync failure does not invalidate completed local sales.
- Printer failure does not rollback sale completion.
- Device/license invalid acknowledgements move events to dead-letter and lock license runtime state.
- Pull sync failure degrades diagnostics state but does not block cashier flow.
- Dead-letter events can be manually requeued from the diagnostics modal.

## 10) Verification

Validated locally:

- `cmd /c npm run build` in `apps/desktop-pos`
- `cmd /c npm run lint` in `apps/desktop-pos`
- `cmd /c npm run smoke` in `apps/desktop-pos`
- `dotnet build apps/api/src/LoomaPos.Api/LoomaPos.Api.csproj`

## 11) Remaining External Dependencies

Still outside repo scope:

- live cashier-specific identity domain
- richer cloud stock snapshot payloads
- real printer discovery / selection UI
- production device provisioning workflow
