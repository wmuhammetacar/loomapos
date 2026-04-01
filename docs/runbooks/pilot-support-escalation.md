# Pilot Support Escalation (L1/L2/L3)

Bu runbook pilot sirasinda en sik 6 ariza tipi icin hizli karar akisini tanimlar.

## Roller

- L1: Pilot operasyon sorumlusu
- L2: Uygulama muhendisligi (backend + desktop/mobile)
- L3: Platform/altyapi (DB, deploy, network)

## Her incidentte zorunlu veri

- `tenantId`
- `deviceId` (varsa)
- `eventId` (sync/checkout olaylarinda)
- UTC zaman damgasi
- Ekran goruntusu + hata metni

## 1) Failed activation

1. L1: Desktop aktivasyon ekrani hatasini kaydet.
2. L1: `/tenants/{id}` ve `/devices` ekranlarindan tenant/device durumunu kontrol et.
3. L2: `/commerce/auth/desktop-login` ve aktivasyon endpoint loglarini incele.
4. L2: Lisans durumu `invalid/suspended` ise musteriyi dogru lifecycle mesaji ile yonlendir.
5. L3: API readiness veya deployment sorunu varsa rollback runbookunu tetikle.

## 2) Failed sync

1. L1: `/sync` ekraninda issue satirini tenant ve cihaz bazinda filtrele.
2. L1: `retrying` vs `failed/dead_letter` ayrimini not et.
3. L2: event bazli idempotency ve apply loglarini kontrol et.
4. L2: Gecici hata ise retry, kalici hata ise root-cause ile ticket ac.
5. L3: Altyapi kaynakli hata (DB/queue/network) varsa incident seviyesi yukseltilir.

## 3) Expired trial

1. L1: `/subscriptions` ekraninda tenant lifecycle durumunu dogrula.
2. L1: Musteriye read-only davranisinin beklenen oldugunu acikla.
3. L2: Gerekirse portal subscription akisina yonlendirme baglantisini paylas.
4. L2: Yanlis blok davranisi varsa lifecycle mapping regression kontrolu yap.

## 4) Suspended tenant

1. L1: Tenant durumunu `/tenants/{id}` ve `/subscriptions` uzerinden dogrula.
2. L1: Operasyon yazma akislarinin bloklu oldugunu standart mesajla ilet.
3. L2: Askida olma sebebini (policy/billing/security) backendden teyit et.
4. L3: Yanlis suspend dalgasinda rollout freeze + rollback degerlendirmesi yap.

## 5) Failed/unfinished checkout

1. L1: Checkout durumunu `created/pending/failed/canceled/expired` olarak netlestir.
2. L1: Musteriyi fake success yerine portaldaki dogru aksiyona yonlendir.
3. L2: Gerekirse `reconcile` akisiyla provider sonucu tekrar eslestir.
4. L2: Duplicate callback veya idempotency loglarini kontrol et.

## 6) Onboarding confusion/block

1. L1: Kullanici hangi adimda kaldigini not et (welcome/demo/first-sale/finish).
2. L1: Aktivasyon tam mi ve session kalici mi kontrol et.
3. L2: Onboarding flag persistence ve demo seed durumunu dogrula.
4. L2: Ilk satis adimi gercek checkout akisina ulasiyor mu kontrol et.

## Escalation thresholds

- P1: Birden fazla pilot tenant satis yapamiyor -> L3 aninda dahil.
- P2: Tek tenant bloklu, workaround var -> L2 ilk 30 dk.
- P3: Egitim/yonlendirme kaynakli onboarding sorunu -> L1 + L2 asenkron.

## Kapanis kosullari

- Incident root-cause tek cumle ile yazildi.
- Kalici duzeltme aksiyonu issue olarak acildi.
- Pilot checklist dokumaninda ilgili satir guncellendi.
