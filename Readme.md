# LoomaPOS Monorepo

LoomaPOS SaaS ekosistemi:
- Web: tanitim + fiyatlandirma + checkout + lisans + indirme + bayi
- Desktop POS: operasyonel satis/stok (offline-first)
- Mobil: stok sayim/saha islemleri (offline-first)
- API: multi-tenant modular monolith + lisans + reseller + sync + rapor

## Web/POS Siniri (zorunlu kural)
- Web **POS islemi yapmaz**.
- Satis/stok/cari/kasa operasyonlari sadece Desktop ve Mobil uygulamadadir.

## Proje Yapisi
- `apps/api`: .NET 9 API
- `apps/web-admin`: Next.js (admin + marketing/commerce pages)
- `apps/desktop-pos`: Electron + React + SQLite outbox
- `apps/mobile`: Flutter + Drift SQLite + sync
- `packages/shared-types`: ortak TS tipleri
- `packages/ui`: ortak UI paketleri
- `docker-compose.yml`: root local stack
- `infra/docker-compose.yml`: deploy/infra referansi (root ile senkron)

## Dokumanlar
- `docs/architecture.md`
- `docs/api.md`
- `docs/licensing.md`
- `docs/reseller.md`

## Tek Komutla Calistirma
1. `.env.example` -> `.env`
2. `npm run dev:all`

Durdurma:
- `npm run dev:all:stop`

`dev:all`:
- altyapi servisleri hazir oldugunda API + Web + Desktop + Mobile (web) akisini canlandirir.

## Lokal Endpointler
- API Swagger: `http://127.0.0.1:5000/swagger`
- Web: `http://127.0.0.1:3100`
- Mobile web preview: `http://127.0.0.1:4200`
- Keycloak: `http://127.0.0.1:8081`
- Grafana: `http://127.0.0.1:3001`

## Marketing + Commerce Sayfalari
- `/site`
- `/features`
- `/pricing`
- `/checkout`
- `/portal`
- `/reseller`
- `/reseller/dashboard`
- `/download`
- `/docs`
- `/faq`
- `/blog`

## Commerce + Licensing API (MVP)
- `GET /commerce/plans`
- `POST /commerce/checkout`
- `GET /commerce/portal/{tenantId}`
- `POST /commerce/payments/webhooks`
- `POST /commerce/reseller/apply`
- `GET /commerce/reseller/{code}/dashboard`
- `POST /license/activate`
- `GET /license/status`

## Integration Mock Endpoints
- `POST /integrations/einvoice/mock/send`
- `POST /integrations/fiscal/mock/send`
- `GET /integrations/logs`

## Desktop Smoke Test
- `cd apps/desktop-pos && npm run smoke`
- Not: Yerel Node ABI ile `better-sqlite3` binary ABI farkinda smoke fallback modu devreye girer ve kritik dosya/iskelesini dogrular.

## Notlar
- Desktop sync idempotent event akisini kullanir (`/sync/events` + `processed_events`).
- Lisans aktivasyonda cihaz limiti API tarafinda enforce edilir.
- Grace period modlari: `ACTIVE`, `READ_ONLY`, `LOCKED`.
