# Pilot Launch Readiness (Controlled Rollout)

Bu dokuman, Looma'nin ilk pilot musterilerini kontrollu sekilde canliya almak icin operasyonel hazirlik kapisidir.

## Pilot gate (hepsi zorunlu)

- [ ] API `health/live` ve `health/ready` 200 donuyor.
- [ ] Desktop login + activation akisi pilot tenant icin dogrulandi.
- [ ] Onboarding wizard tamamlanip ilk test satisi alinabildi.
- [ ] Control Center'da tenant/device/sync/support/subscription gorunurlugu aktif.
- [ ] Pilot destek nobetcisi ve eskalasyon sorumlusu atandi.

## 1) Launch checklist

- [ ] `loomapos.com` DNS ve TLS tamamlandi.
- [ ] `api.loomapos.com`, `app.loomapos.com`, `control.loomapos.com` resolve oluyor.
- [ ] Production env degiskenleri domain-cutover runbookuna gore guncellendi.
- [ ] CORS allowlist sadece kanonik originleri iceriyor.
- [ ] Pilot tenant listesi ve lisans durumu final onay aldi.

## 2) Install checklist

- [ ] Musteri, public web uzerinden dogru download yuzeyine yonlendirildi.
- [ ] Desktop paket surumu pilot notlariyla paylasildi.
- [ ] Kurulum sonrasi uygulama acilisi ve update channel dogrulandi.
- [ ] Minimum cihaz gereksinimleri (OS, disk, saat senkronu) kontrol edildi.

## 3) Activation checklist

- [ ] Musteri hesabiyla login basarili.
- [ ] Cihaz aktivasyonu `active` durumuna geciyor.
- [ ] Lisans/trial durumu desktopta dogru gorunuyor.
- [ ] Aktivasyon basarisiz olursa operator runbooku (asagidaki support dokumani) uygulanabilir.

## 4) Onboarding checklist

- [ ] Ilk acilista onboarding adimlari tetikleniyor.
- [ ] Demo veri yukleme adimi idempotent calisiyor.
- [ ] Gercek checkout akisiyla ilk test satisi yapilabiliyor.
- [ ] Onboarding tamamlaninca tekrar acilista POS ana ekrani geliyor.

## 5) First-sale checklist

- [ ] Vardiya/oturum gereksinimi karsilanmis durumda.
- [ ] Urun sepete ekleme, odeme alma, satis tamamla adimlari calisiyor.
- [ ] Stok dusumu ve kayit olusumu dogrulandi.
- [ ] Sync outbox kuyruguna olay dusup backend'e tasindi.
- [ ] Satis kaydi kontrol-center veya ilgili ops logunda gorulebiliyor.

## 6) Support escalation checklist

- [ ] L1 (Operasyon) kisi atandi.
- [ ] L2 (Backend/Desktop) kisi atandi.
- [ ] L3 (Platform/DB) kisi atandi.
- [ ] Pilot surecinde kullanilacak tek incident kanali belirlendi.
- [ ] Her incident icin tenantId, deviceId, eventId toplama zorunlulugu ekipte net.

Ayrintili eskalasyon akisi: `docs/runbooks/pilot-support-escalation.md`

## 7) Rollback / fallback checklist

- [ ] Sorunlu deployda `failed-deployment-rollback.md` uygulanabilir durumda.
- [ ] Saglayici kaynakli kesintide `provider-outage.md` uygulanabilir durumda.
- [ ] Desktop lokal-first fallback senaryosu ekip tarafindan biliniyor.
- [ ] Pilot tenant icin gecici operasyon karari (duraklat/devam) tek sorumlu tarafindan veriliyor.

## Pilot operator command set

```bash
curl -sS https://api.loomapos.com/health/live
curl -sS https://api.loomapos.com/health/ready
curl -I https://loomapos.com
curl -I https://app.loomapos.com
curl -I https://control.loomapos.com
```

## Pilot support visibility (Control Center)

- Tenant durumu: `/tenants`
- Tenant detay: `/tenants/{id}`
- Device durumu: `/devices`
- Sync issue: `/sync`
- Support case: `/support`
- Subscription/lifecycle: `/subscriptions`
- Audit izleme: `/audit`

## Exit criteria (pilot musteri acilisi)

- [ ] Musteri A: kurulum -> aktivasyon -> onboarding -> ilk satis tamam.
- [ ] Ic ekip ayni musteri icin tenant/device/sync/support ekranlarindan durumu takip etti.
- [ ] En az 1 kontrollu ariza tatbikati (ornek: sync failure) runbook ile cozuldu.
