# Web Platform

Next.js tabanli Phase 1 + Phase 2 ticari web platformu.

## Komutlar

- `pnpm --filter @loomapos/web-admin dev`
- `pnpm --filter @loomapos/web-admin build`
- `pnpm --filter @loomapos/web-admin test:e2e`

## Notlar

- Bu uygulama web uzerinden operasyonel POS isleri yapmaz.
- Kapsam:
  - urun tanitimi
  - pricing
  - monthly/yearly subscription checkout
  - reseller acquisition
  - license delivery
  - customer portal
  - app download hub
  - docs / faq / blog / legal
- Gercek operasyon:
  - Desktop app
  - Mobile app
- Formlar:
  - React Hook Form + Zod
- Auth:
  - `NEXT_PUBLIC_AUTH_MODE=mock`
  - `NEXT_PUBLIC_AUTH_MODE=oidc`
- Commerce entegrasyonu:
  - Backend commerce endpointleri varsa once API kullanilir
  - API yoksa Phase 1 local fallback state devreye girer
  - Customer portal auth:
    - `/commerce/auth/register`
    - `/commerce/auth/login`
    - `/commerce/auth/forgot-password`
    - `/commerce/auth/reset-password`
  - Reseller auth foundation:
    - `/commerce/auth/reseller-login`
  - Checkout and provisioning:
    - `/commerce/checkout/session`
    - `/commerce/checkout/status/{id}`
  - Portal data:
    - `/commerce/portal/*`
- Mimari ozeti:
  - [Phase 1 architecture](/c:/Users/acarm/Desktop/projeler/eticaret%20projesi/docs/phase1-web-platform-architecture.md)
  - [Phase 1 completion report](/c:/Users/acarm/Desktop/projeler/eticaret%20projesi/docs/phase1-completion-report.md)
  - [Phase 2 commerce backend report](/c:/Users/acarm/Desktop/projeler/eticaret%20projesi/docs/phase2-commerce-backend-report.md)

## Test Checklists

- Tasarim Bolum 4 smoke checklist: [BOLUM4_SMOKE_CHECKLIST.md](/c:/Users/acarm/Desktop/eticaret%20projesi/apps/web-admin/BOLUM4_SMOKE_CHECKLIST.md)
                                      