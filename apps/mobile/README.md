# Mobile (`apps/mobile`)

Looma mobile operasyon uygulamasi.

## Urun siniri
- POS checkout/payment uygulamasi degildir.
- Kapsam: saha operasyonu, gorunurluk, stok/satis takibi.

## Aktif kapsam
- Auth + activation-aware shell
- Dashboard / operasyon ozetleri
- Product arama + barcode tarama
- Stock count submit akisi
- Sales / reports / branch gorunumleri
- Cache tabanli read-resilience (fresh/cached/stale)
- Session ve hata disiplini (timeout/network/auth-expired)

## Calistirma
1. `cd apps/mobile`
2. `flutter pub get`
3. `flutter run`

Web preview:
- `flutter run -d web-server --web-hostname 127.0.0.1 --web-port 4200`

## Kalite komutlari
- `flutter analyze`
- `flutter test`

## Sik hata notu
- Backend mobile login endpointi `POST /commerce/auth/mobile-login`.
- Bu endpointi tarayici adres cubugunda acmak (`GET`) `405` ile sonuclanir.
