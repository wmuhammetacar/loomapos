# Desktop POS

Electron + React tabanli kasa uygulamasi.

## Bu asamada eklenenler

- Desktop boot shell
  - startup bootstrap
  - desktop login handoff
  - device activation flow
  - locked / login required / activation required durumlari
- Zustand shell store
- Tailwind CSS renderer pipeline
- Local session ve activation persistence
  - `local_session`
  - `local_activation`
  - `local_users`
  - `local_branches`
  - `app_settings`
- Offline-first foundation
  - offline grace kontrolu
  - Electron `safeStorage` ile session token korumasi
  - local cart draft autosave
  - `sync_state`
  - `local_audit_logs`
- Operational local schema
  - `local_products`
  - `local_product_barcodes`
  - `local_product_variants`
  - `local_sales`
  - `local_sale_lines`
  - `local_payments`
  - `local_receipts`
  - `local_refunds`
  - `local_refund_lines`
  - `local_stock_moves`
  - `local_stock_snapshot`
  - `local_cash_sessions`
  - `local_cash_adjustments`
  - `local_user_sessions`
- Production-style outbox
  - `PENDING`
  - `SENDING`
  - `FAILED`
  - `SENT`
  - `DEAD_LETTER`
  - immutable payload + payload version + ack metadata
- Arka plan sync dispatcher
  - batch push `/sync/events/batch`
  - pull refresh `/sync/pull`
  - heartbeat event uretimi
  - exponential backoff
  - duplicate/accepted/retry/rejected/device-invalid/license-invalid yorumu
  - manual dead-letter retry
- Local stock ledger
  - satis -> stok dusurme
  - iade -> opsiyonel stok geri donusu
  - nedeni izlenebilir stok hareketi
- Vardiya / cash session
  - vardiya acilis
  - kasa hareketleri
  - Z kapatma akisi
  - X/Z report foundation
- Offline receipt numbering strategy
- React renderer
  - urun arama
  - sepet
  - satis
  - iade
  - vardiya
  - diagnostics
- Ikinci ekran (musteri gorunumu)
- Hardware adapter foundation
  - `IReceiptPrinter`
  - `ICashDrawer`
  - `IBarcodeInputHandler`
  - `ICustomerDisplayService`
- ESC/POS yazdirma + cash drawer tetikleme hazirligi
- Mali cihaz entegrasyon kuyrugu (`fiscal_jobs`) + arka plan retry
- Klavye kisayollari
  - `F1` yeni satis
  - `F2` iade
  - `F3` iskonto
  - `F4` musteri
  - `F5` vardiya
  - `F6` kasa hareketi
  - `F7` gun sonu
  - `F8` diagnostics
  - `F9` nakit
  - `F10` kart

## Sonraki adim

- Ayrik operasyonel cashier identity / permission backend
- Cloud tarafinda daha zengin stock snapshot / pricing rule payloadlari
- Gercek cihaz onboarding / branch provisioning API
- Mobile operational client ile ortak sync kontrati
- Opsiyonel terazi (serial/COM) ve cihaz kesif ekranlari

## Donanim Ortam Degiskenleri

- `LOOMAPOS_PRINTER_HOST`: Network yazici IP/host
- `LOOMAPOS_PRINTER_PORT`: Network yazici portu (`9100`)
- `LOOMAPOS_PRINTER_DEVICE_PATH`: Local/USB cihaz yolu
- `LOOMAPOS_CASHDRAWER_KICK`: `true` ise cash drawer tetiklenir
- `LOOMAPOS_FISCAL_MODE`: `OFF` | `BEST_EFFORT` | `STRICT`
- `LOOMAPOS_FISCAL_API_URL`: Mali cihaz bridge/API endpoint adresi
- `LOOMAPOS_FISCAL_API_KEY`: Opsiyonel mali API key
- `LOOMAPOS_FISCAL_TIMEOUT_MS`: Mali API timeout (ms)

## Test

- Build: `npm run build`
- Type lint: `npm run lint`
- Smoke: `npm run smoke`
