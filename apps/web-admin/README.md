# Web Platform (`@loomapos/web-admin`)

Next.js tabanli public web + portal uygulamasi.

## Scope
- Marketing / pricing / download
- Customer portal
- Reseller portal
- Checkout baslatma ve lisans gorunurlugu

## Urun siniri
- Bu uygulama operasyonel POS degildir.
- Satis/stok/kasa yazma operasyonlari desktop POS uzerinden yurur.

## Komutlar
- `pnpm --filter @loomapos/web-admin dev -- --hostname 127.0.0.1 --port 3100`
- `pnpm --filter @loomapos/web-admin build`
- `pnpm --filter @loomapos/web-admin start`
- `pnpm --filter @loomapos/web-admin test:e2e`

## Backend baglantisi
- Kanonik backend: `.NET API`
- Auth/commerce cagrilari `/commerce/*` ve `/internal/admin/*` uzerinden gider.

## Kimlik dogrulama notu
- Mobile/desktop login endpointleri backendde `POST` ister.
- `GET /commerce/auth/mobile-login` veya `GET /commerce/auth/desktop-login` beklenen bir akis degildir.

## Referans dokumanlar
- `docs/phase1-web-platform-architecture.md`
- `docs/phase2-commerce-backend-report.md`
