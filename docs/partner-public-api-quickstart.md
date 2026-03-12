# LoomaPOS Public API v1 Quickstart

Bu rehber partner/developer ekiplerinin LoomaPOS Public API v1 ile hizli baslamasi icindir.

## 1) API key olusturma

Customer portal:

- `/portal/integrations`
- `API clients` bolumunden yeni client olustur
- scope sec: `products:read` ve/veya `analytics:read`
- uretilen plaintext key yalnizca bir kez gosterilir

## 2) Meta endpoint ile dogrulama

```bash
curl -s "https://YOUR_HOST/public/v1/meta"
```

Bu endpoint auth istemez. Dokuman ve desteklenen endpoint listesini dondurur.

## 3) Urunleri cekme

```bash
curl -s "https://YOUR_HOST/public/v1/products" \
  -H "X-Api-Key: YOUR_API_KEY"
```

Gerekli scope: `products:read`

## 4) Analytics summary cekme

```bash
curl -s "https://YOUR_HOST/public/v1/analytics/summary" \
  -H "X-Api-Key: YOUR_API_KEY"
```

Gerekli scope: `analytics:read`

## 5) Postman ve TypeScript artifactleri

- Postman collection: `GET /public/v1/docs/postman`
- TypeScript SDK snippet: `GET /public/v1/docs/sdk/typescript`
- OpenAPI JSON: `/swagger/v1/swagger.json`

## 6) Guvenlik ve operasyon notlari

- API keyleri loglarda maskeleyin.
- Scope bazli minimum yetki verin.
- Retry yaparken client tarafinda idempotent olmaya dikkat edin.
- 429 veya 503 donuslerinde exponential backoff kullanin.
