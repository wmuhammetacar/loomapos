# LoomaPOS API

Modular monolith yaklasimiyla .NET 9 API iskeleti.

## Moduller

- Identity & Tenant
- Catalog
- Inventory
- Sales
- Customers
- Cashbook
- Reporting
- Sync

## Cekirdek ozellikler (MVP basis)

- Tenant scoped tablo modeli (`tenant_id` filtreli)
- Immutable stock hareketleri (`stock_moves`)
- Idempotent sync endpoint (`POST /sync/events`, `processed_events` ile)
- Audit log (`audit_logs`)
- Tenant ayarlari guncelleme (`PUT /tenants/me/settings`)
- Tenant logo upload (`POST /tenants/me/logo`)
- Dosya erisimi (`GET /files/{key}`)
- Kategori yonetimi (`GET/POST /categories`)
- Kullanici rol atama (`POST /users/{id}/roles`)
- RabbitMQ entegrasyon publish'i (sync eventleri `loomapos.events` exchange)

## Lokal calistirma

1. `docker compose up -d` (repo root)
2. `dotnet restore LoomaPos.sln`
3. `dotnet run --project src/LoomaPos.Api/LoomaPos.Api.csproj`

Varsayilan swagger: `http://localhost:5000/swagger`

## Not

- Sandbox ortami nedeniyle `LoomaPos.Api` projesi `Domain` ve `Infrastructure` kaynaklarini csproj `Compile Include` ile derliyor. Mimari klasor ayrimi korunuyor, paketleme tek host uzerinden ilerliyor.
