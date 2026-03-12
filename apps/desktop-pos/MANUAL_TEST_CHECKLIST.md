# LoomaPOS Desktop Manual Test Checklist

Bu liste smoke test'e ek olarak operasyonda kritik akislari elle dogrulamak icindir.

## 1) Baslangic

- [ ] Uygulama acilirken `Sube`, `Kasa`, `Kasiyer` alanlari dolu geliyor.
- [ ] Barkod input otomatik focus aliyor.
- [ ] Offline/online durumu status barda gorunuyor.

## 2) Hizli Satis Akisi

- [ ] Barkod okutunca urun sepete ekleniyor.
- [ ] Bulunamayan barkodda "Urun bulunamadi" modal'i aciliyor.
- [ ] `DEL` secili satiri siliyor.
- [ ] `+` / `-` secili satir miktarini degistiriyor.
- [ ] `F9` nakit odeme, `F10` kart odeme modal'ini aciyor.
- [ ] Nakit odemede para ustu otomatik hesaplaniyor.
- [ ] Kart odemede onay checkbox'i olmadan satis tamamlanamiyor.
- [ ] Satis tamamlaninca toast gorunuyor, sepet sifirlaniyor, barkod input tekrar focus aliyor.

## 3) Iade Akisi

- [ ] `F2` ile iade modal'i aciliyor.
- [ ] Fis no ile satis bulunup satir bazli miktar secilerek iade tamamlanabiliyor.
- [ ] Direkt urun iadesi yetkisiz kullanicida engelleniyor.
- [ ] Iade odeme yontemi secilip iade fis ciktisi uretiliyor.

## 4) Gun Sonu X/Z

- [ ] `F7` ile gun sonu modal'i aciliyor.
- [ ] X raporu tutarlari (`toplam`, `nakit`, `kart`, `islem`, `iade`) gorunuyor.
- [ ] "Yazdir" X raporu fisini olusturuyor.
- [ ] Z raporunda beklenen kasa / girilen kasa / fark hesaplari dogru.
- [ ] "KASAYI KAPAT" sonrasi basari mesaji ve Z rapor fis ciktisi uretiliyor.

## 5) Offline + Sync

- [ ] Internet yokken satis yapilabiliyor.
- [ ] Offline satislar `outbox_events` tablosunda `PENDING/FAILED` gorunuyor.
- [ ] Internet geri geldiginde sync calisip kayitlari `SENT` yapiyor.
- [ ] Sync hatasinda UI'da uyari metni gorunuyor, satis akisi durmuyor.

## 6) Yazici ve Cekmece

- [ ] Yazici bagliyken fis ciktisi alinabiliyor (ESC/POS network veya device path).
- [ ] Yazici bagli degilken satis engellenmeden warning gosteriliyor.
- [ ] `LOOMAPOS_CASHDRAWER_KICK=true` ile cekmece tetikleniyor.

## 7) Mali Cihaz / Fiscal

- [ ] `LOOMAPOS_FISCAL_MODE=BEST_EFFORT` ve endpoint acikken satis sonrasi `fiscal_jobs` kaydi `SENT` oluyor.
- [ ] Fiscal endpoint gecici kapaliyken satis engellenmeden tamamlanip warning veriyor.
- [ ] Endpoint geri geldiginde sync dongusu `fiscal_jobs` kayitlarini tekrar deneyip `SENT` yapiyor.
