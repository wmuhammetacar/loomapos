# LoomaPOS Domain Cutover (loomapos.com)

Bu runbook, Looma'nin tum yuzeylerini `loomapos.com` etrafinda tek bir production domain modeline gecirmek icindir.

## 1) Canonical domain haritasi

- Public web: `https://loomapos.com`
- Customer portal / web-admin: `https://app.loomapos.com`
- .NET API: `https://api.loomapos.com`
- Internal control center: `https://control.loomapos.com`
- Status/health UI: `https://status.loomapos.com`
- Downloads (opsiyonel): `https://downloads.loomapos.com`

## 2) DNS kayitlari

Ayni edge/load balancer'a cikacaksaniz CNAME/A kayitlari:

- `@` -> public ingress
- `www` -> `loomapos.com`
- `app` -> app ingress
- `api` -> api ingress
- `control` -> control-center ingress
- `status` -> status ingress
- `downloads` -> artifact/download ingress

## 3) Repo env degiskenleri (zorunlu)

Root `.env` / deployment secrets:

- `LOOMAPOS_DOMAIN=loomapos.com`
- `LOOMAPOS_PUBLIC_WEB_URL=https://loomapos.com`
- `LOOMAPOS_WEB_ADMIN_URL=https://app.loomapos.com`
- `LOOMAPOS_API_BASE_URL=https://api.loomapos.com`
- `LOOMAPOS_CONTROL_CENTER_URL=https://control.loomapos.com`
- `NEXT_PUBLIC_SITE_URL=https://loomapos.com`
- `NEXT_PUBLIC_API_BASE_URL=https://api.loomapos.com`
- `LOOMA_DOTNET_API_BASE_URL=https://api.loomapos.com`
- `LOOMAPOS_WEB_BASE=https://app.loomapos.com`
- `LOOMAPOS_API_BASE=https://api.loomapos.com`
- `Cors__AllowedOrigins=https://loomapos.com,https://app.loomapos.com,https://control.loomapos.com,https://status.loomapos.com`

## 4) TLS / guvenlik

- Tum hostlar icin HTTPS zorunlu.
- API tarafinda sadece `Cors__AllowedOrigins` listesindeki originler acik olmali.
- Internal endpointler (`/internal/*`) public edilmemeli; auth + network katmani ile sinirlandirilmali.

## 5) Smoke test komutlari

```bash
curl -sS https://api.loomapos.com/health/live
curl -sS https://api.loomapos.com/health/ready
curl -I https://loomapos.com
curl -I https://app.loomapos.com
curl -I https://control.loomapos.com
```

Beklenen:
- `health/live` -> 200
- `health/ready` -> 200 (DB/Redis ayakta ise)
- Web hostlari -> 200/3xx (TLS valid)

## 6) Cutover sonrasi kritik kontroller

- Portal login calisiyor.
- Desktop login + activation `api.loomapos.com` uzerinden calisiyor.
- Mobile login `api.loomapos.com` uzerinden calisiyor.
- Control center internal gate/auth beklenen sekilde calisiyor.
