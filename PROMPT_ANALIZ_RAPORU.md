# LoomaPOS Prompt Analiz Raporu

Tarih: 2026-03-05

Bu rapor, gonderilen tum prompt setlerinin (urun spesifikasyonu + tasarim bolumleri + rol matrisi) kod bazli durumunu ozetler.

## Prompt Setleri

1. Urun Spesifikasyonu (Cloud API + Web Admin + Desktop POS + Mobil)
2. Tasarim Bolum 1 (Global tasarim sistemi + Desktop POS ana ekran)
3. Tasarim Bolum 2 (Iade + Gun Sonu X/Z + Web Admin Dashboard + Yetki matrisi)
4. Tasarim Bolum 3 (Urun + Stok + Cari + Gelir/Gider + POS musteri ekrani + Web menu)
5. Tasarim Bolum 4 (Rapor sistemi + cok subeli yonetim + kullanici/rol + sistem ayarlari + lisanslama)
6. Marka standardi (BenimPOS -> LoomaPOS)

## Durum Ozeti

- Tamamlanan ana kalemler: 58
- Kismen tamamlanan kalemler: 0
- Acik kalan kritik bloklayici kalem: 0

## 1) Urun Spesifikasyonu

- [x] Monorepo yapisi (`apps/api`, `apps/web-admin`, `apps/desktop-pos`, `apps/mobile`, `packages/*`)
- [x] Backend stack: .NET + PostgreSQL + EF Core + Redis + RabbitMQ + Hangfire + Keycloak + OTel + Swagger/NSwag
- [x] Modular monolith modulleri ve tenant scoped veri modeli
- [x] `tenant_id` temelli filtreleme ve tenant middleware
- [x] Immutable stock/sale hareket mantigi (silme yerine iade/void/event)
- [x] Audit log yazimi (kritik endpointlerde)
- [x] Desktop offline-first outbox + sync worker + idempotent server-side `processed_events`
- [x] Sync retry/backoff + sync durum gosterimi
- [x] ESC/POS yazdirma + cash drawer kick + ikinci ekran
- [x] Web admin modulleri (dashboard, urun, satis, stok, cari, kasa, rapor, ayarlar)
- [x] API MVP endpoint seti
- [x] Docker compose altyapi, CI/CD workflowlari, backup workflow
- [x] Backend/web/mobile kalite kapisi (test/lint/build akislari)

## 2) Tasarim Bolum 1

- [x] Global renk/kontrast/typography temasi (desktop tarafinda uygulandi)
- [x] POS ust bar (sube, kasa, kasiyer, online/offline, saat)
- [x] Barkod odakli hizli satis akisi
- [x] Buyuk toplam + buyuk odeme CTA (`NAKIT`, `KART`)
- [x] Klavye kisayollari (`F1/F2/F3/F4/F7/F9/F10`, `ESC`, `DEL`, `+/-`, `Enter`)
- [x] Odeme modal akislari (nakit/kart)
- [x] Satis tamamlandi davranisi (toast, reset, refocus)

## 3) Tasarim Bolum 2

- [x] Iade ekrani (fis bazli + yetkili direkt urun iadesi)
- [x] Iade odeme tipi secimi (nakit/kart/ayni yontem)
- [x] Iade fis akisi ve `SALE_REFUND_CREATED` eventi
- [x] Gun sonu `X` raporu
- [x] Gun sonu `Z` raporu + kasa kapatma akisi
- [x] Web admin dashboard KPI + saatlik satis + top urun + sube karsilastirma + son satislar
- [x] Yetki matrisi hizalamasi (policy alias + endpoint yetki dagilimi)

## 4) Tasarim Bolum 3

- [x] Web Admin urun listesi (arama + barkod + filtre + durum + hizli aksiyon)
- [x] Web Admin yeni urun formu (temel/fiyat/stok/durum alanlari)
- [x] Urun kurallari:
  - Barkod unique (DB filtered unique index + API kontrol)
  - Fiyat > 0 (API validation)
  - Stok takibi kapali urunlerde stok dusmeme (sync processor kurali)
- [x] Web Admin stok durumu tablosu (urun/sube/stok/min/durum)
- [x] Stok duzeltme formu + `STOCK_ADJUSTMENT` event donusu
- [x] Web Admin cari listesi (ad/telefon/bakiye/son islem)
- [x] Web Admin cari detay (bakiye + hareketler + tahsilat/borc/satisa ekle)
- [x] Web Admin finans (gelir/gider liste + ekleme formu)
- [x] API alias endpointleri: `GET/POST /finance/transactions`
- [x] POS ikinci monitor musteri ekrani:
  - Hos geldiniz + satirlar + buyuk toplam
  - Satis bitisinde `TESEKKURLER` ekranina gecis
  - Minimal animasyon + logo/marka basligi
- [x] Web Admin sol navigasyon menusu:
  - Dashboard, Satislar, Urunler, Stok, Cari, Finans, Raporlar, Ayarlar

## 5) Tasarim Bolum 4

- [x] Rapor menusu 6 rapor sekmesiyle tamamlandi:
  - Gunluk Satis, Urun Satis, Sube Satis, Kasa Raporu, Stok Raporu, Iade Raporu
- [x] Gunluk satis satir raporu + filtreler:
  - Tarih, Sube, Kasiyer
- [x] Urun satis raporu (adet + ciro)
- [x] Sube satis raporu (satis + islem)
- [x] Kasa raporu (kasiyer bazli nakit/kart/toplam)
- [x] Stok raporu (urun/sube/stok/min/durum)
- [x] Iade raporu (iade/iptal satirlari)
- [x] Tum raporlarda export butonlari:
  - CSV indir, Excel indir, PDF indir
- [x] Cok subeli yonetim:
  - Sube listesi tabloya alindi
  - Sube ekleme/guncelleme formu eklendi
  - Sube ayarlari (fis basligi, varsayilan KDV, kasa baslangic) eklendi
- [x] Kullanici/rol sistemi:
  - Kullanici listesi (ad/rol/sube/durum)
  - Kullanici ekleme formu (ad/email/telefon/sifre/rol/sube)
  - Kullanici aktif/pasif guncelleme
  - Rol ekleme + varsayilan roller endpointi
  - Rol yetki matrisi ekrani
- [x] Sistem ayarlari:
  - Firma bilgileri
  - POS ayarlari (fis yazici, para birimi, varsayilan odeme)
  - Veritabani yedegi al endpointi + UI butonu
- [x] Lisanslama sistemi:
  - Planlar (Starter/Pro/Enterprise)
  - Plan limitleri + anlik kullanim (sube/kullanici/POS)
  - Son odeme tarihi yonetimi

## 6) Marka Standardi

- [x] BenimPOS adlandirmalari LoomaPOS olarak guncellendi (uygulama metinleri ve dokumantasyonlar)

## Bu Tur Kapatilan Eksikler

- [x] RBAC matrisi hizasi guclendirildi:
  - Rol alias normalizasyonu eklendi (`admin/tenant_admin`, `branch_manager/sube_yoneticisi`, `cashier/kasiyer`)
  - Contacts endpointleri `ManagerOrAdmin`
  - Cashbook endpointleri `AdminOnly`
- [x] Satis liste/detay endpointleri kasiyer seviyesinden alindi, `ManagerOrAdmin` seviyesine tasindi.
- [x] Web Admin satis detay ekrani eklendi (`/sales/[id]`)
- [x] Satis listesine "Detay" aksiyonu eklendi
- [x] Mobil widget testi mevcut uygulamaya uygun hale getirildi
- [x] Sync isleme tarafinda domain seviyesinde audit kayitlari eklendi:
  - `SALE_CREATED`, `SALE_VOIDED`, `SALE_REFUND_CREATED`, `STOCK_ADJUSTED`, `PAYMENT_ADDED`
- [x] Desktop manuel operasyon checklist dokumani eklendi:
  - Dosya: `apps/desktop-pos/MANUAL_TEST_CHECKLIST.md`
- [x] API compile kirigi giderildi:
  - `ContactsEndpoints` tuple deconstruction duzeltmesi
- [x] Web compile kirigi giderildi:
  - `app/shell.tsx` typed route (`Route`) duzeltmesi
- [x] Playwright stabilitesi guclendirildi:
  - `reuseExistingServer: false`
  - testte mevcut oturum durumuna dayanıklı login akisi

## Son Tamamlanan Kalemler

- [x] Mobil local DB beklentisi:
  - Native platformda Drift + SQLite kalici store aktif (`local_store_native.dart`).
  - Web'de derleme/stabilite icin kosullu memory store aktif (`local_store_web.dart`).
- [x] Tasarim handoff teslimi:
  - Desktop POS Design 1 + Design 2 frame/style/shortcut handoff dokumani eklendi.
  - Dosya: `apps/desktop-pos/FIGMA_HANDOFF.md`
- [x] Tasarim Bolum 4 icin hizli smoke checklist eklendi:
  - Dosya: `apps/web-admin/BOLUM4_SMOKE_CHECKLIST.md`

## Dogrulama Sonuclari (Bu Tur)

- [x] `dotnet build apps/api/src/LoomaPos.Api/LoomaPos.Api.csproj -c Release`
- [x] `dotnet test apps/api/tests/LoomaPos.UnitTests/LoomaPos.UnitTests.csproj -c Release`
- [x] `dotnet test apps/api/tests/LoomaPos.IntegrationTests/LoomaPos.IntegrationTests.csproj -c Release`
- [x] `npm run build` (`apps/web-admin`)
- [x] `npm run lint` (`apps/web-admin`)
- [ ] `npm run test:e2e` (`apps/web-admin`) -> ortamda `ERR_NETWORK_IO_SUSPENDED` nedeni ile gecmedi
- [x] `npm run build` (`apps/desktop-pos`)
- [x] `npm run smoke` (`apps/desktop-pos`)
- [x] `flutter analyze` (`apps/mobile`)
- [x] `flutter test` (`apps/mobile`)
- [x] `flutter build web --release` (`apps/mobile`)
- [x] `dart format --set-exit-if-changed lib` duzeyi uygulandi (`apps/mobile/lib` dosyalari formatlandi)
