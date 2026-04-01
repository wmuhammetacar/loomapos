# LoomaPOS Monorepo

LoomaPOS coklu yuzey mimarisi:
- `apps/api`: kanonik backend (ASP.NET Core / .NET 9)
- `apps/web-admin`: public web + customer/reseller portal (Next.js)
- `apps/control-center`: internal operations panel (Next.js)
- `apps/desktop-pos`: operasyonel kasa uygulamasi (Electron)
- `apps/mobile`: saha operasyon mobil uygulamasi (Flutter)

## Kanonik backend kurali
- Uretim dogrusu `.NET API`dir (`apps/api/src/LoomaPos.Api`).
- `apps/api/src-node` ve `apps/api/modules` altindaki Node tarafi legacy/yardimci calismalardir; kaynak gercekligi olarak alinmamalidir.

## Zorunlu urun siniri
- Web ekranlari operasyonel POS degildir.
- Satis/kasa/stok yazma operasyonlari Desktop POS uzerinden yurur.
- Mobile uygulama saha operasyonu ve izleme amaclidir (kasiyer checkout degil).

## Gereksinimler
- .NET SDK 9.x
- Node.js 20+ ve `pnpm@9.15.0`
- Flutter SDK 3.4+
- Docker (local bagimliliklar icin)

## Lokal hizli baslangic
1. Repo kokunde bagimliliklari kurun: `pnpm install`
2. Altyapiyi kaldirin: `docker compose up -d`
3. API'yi baslatin:
   `dotnet run --project apps/api/src/LoomaPos.Api/LoomaPos.Api.csproj`
4. Web Admin:
   `pnpm --filter @loomapos/web-admin dev -- --hostname 127.0.0.1 --port 3100`
5. Control Center:
   `pnpm --filter @loomapos/control-center dev -- --hostname 127.0.0.1 --port 3300`
6. Desktop POS:
   `cd apps/desktop-pos && npm run start`
7. Mobile (web preview):
   `cd apps/mobile && flutter run -d web-server --web-hostname 127.0.0.1 --web-port 4200`

## Tek komut notu
- `npm run dev:all` ve `npm run dev:all:stop` PowerShell scriptleridir.
- Windows disi ortamlarda yukaridaki manuel akisi kullanin.

## Lokal endpointler
- API Swagger: `http://127.0.0.1:5000/swagger`
- API health: `http://127.0.0.1:5000/health`, `http://127.0.0.1:5000/health/live`, `http://127.0.0.1:5000/health/ready`
- Web Admin: `http://127.0.0.1:3100`
- Control Center: `http://127.0.0.1:3300`
- Mobile web preview: `http://127.0.0.1:4200`

## Sik gorulen hata notu
- `http://127.0.0.1:5000/commerce/auth/mobile-login` endpointi `POST` bekler.
- Tarayicidan direkt `GET` acildiginda `405 Method Not Allowed` donmesi normaldir.

## Dokumanlar
- `docs/architecture.md`
- `docs/api.md`
- `docs/licensing.md`
- `docs/reseller.md`
- `docs/runbooks/domain-cutover-loomapos-com.md`
