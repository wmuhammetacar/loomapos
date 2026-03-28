# LoomaPOS API

Kanonik backend: ASP.NET Core (.NET 9)

## Onemli not
- Bu repo icinde Node tabanli legacy dizinler bulunsa da (`src-node`, `modules`), sistemin gercek backend dogrusu `apps/api/src/LoomaPos.Api` altindadir.

## Cekirdek kapsama alani
- Multi-tenant auth ve role modeli
- Commerce auth / checkout / portal
- License + device activation
- Sales / inventory / reports endpointleri
- Desktop sync (`/sync/events`)
- Internal admin endpointleri (`/internal/admin/*`)

## Lokal calistirma
Repo kokunden:
1. `docker compose up -d`
2. `dotnet restore LoomaPos.sln`
3. `dotnet run --project apps/api/src/LoomaPos.Api/LoomaPos.Api.csproj`

## Health endpointleri
- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /health/deep`

## Sik hata notu
- `/commerce/auth/mobile-login` sadece `POST` kabul eder.
- Tarayici adres cubugundan acildiginda `GET` gider ve `405` donmesi beklenir.

## Guvenlik notlari
- Tenant/device baglami server tarafinda resolve edilir.
- Yeni endpointlerde istemci header degerleri tek basina yetki kaynagi olarak kullanilmamalidir.
