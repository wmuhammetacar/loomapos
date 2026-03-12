# LoomaPOS Bolum 4 Smoke Checklist

Bu liste, Tasarim Bolum 4 kapsamini (raporlar + cok subeli yonetim + kullanici/rol + sistem ayarlari + lisanslama) hizli dogrulamak icindir.

## 0) Hazirlik

- [ ] API ayakta (`http://127.0.0.1:5000/swagger` aciliyor).
- [ ] Web Admin ayakta (`http://127.0.0.1:3100` aciliyor).
- [ ] `NEXT_PUBLIC_AUTH_MODE=mock` veya gecerli OIDC session ile giris yapildi.

## 1) Rapor Sistemi

- [ ] `Raporlar` ekraninda 6 sekme gorunuyor:
  - Gunluk Satis, Urun Satis, Sube Satis, Kasa Raporu, Stok Raporu, Iade Raporu
- [ ] Gunluk Satis sekmesinde `Tarih + Sube + Kasiyer` filtreleri calisiyor.
- [ ] Urun Satis sekmesinde urun/adet/ciro tablosu doluyor.
- [ ] Sube Satis sekmesinde sube/satis/islem tablosu doluyor.
- [ ] Kasa Raporu sekmesinde kasiyer/nakit/kart/toplam verisi gorunuyor.
- [ ] Stok Raporu sekmesinde urun/sube/stok/min/durum verisi gorunuyor.
- [ ] Iade Raporu sekmesinde iade/iptal satirlari gorunuyor.

## 2) Rapor Export

- [ ] Her raporda `CSV indir` dosyasi aciliyor/iniyor.
- [ ] Her raporda `Excel indir` dosyasi aciliyor/iniyor.
- [ ] Her raporda `PDF indir` tetiklenince yazdirma penceresi aciliyor.

## 3) Cok Subeli Yonetim

- [ ] `Ayarlar > Cok Subeli Yonetim` alaninda mevcut subeler listeleniyor.
- [ ] Yeni sube eklenebiliyor (ad, adres, telefon, vergi no).
- [ ] Sube duzenle ile fis basligi, varsayilan KDV, kasa baslangic guncellenebiliyor.

## 4) Kullanici / Rol Sistemi

- [ ] Kullanici ekleme formu calisiyor (ad, email, telefon, sifre, rol, sube).
- [ ] Kullanici listesinde ad/rol/sube/durum kolonlari doluyor.
- [ ] Kullanici `Aktif/Pasif` gecisi calisiyor.
- [ ] Rol ekleme calisiyor.
- [ ] `Varsayilan Rolleri Olustur` butonu Admin/Sube Yoneticisi/Kasiyer rollerini olusturuyor (yoksa).
- [ ] Rol yetki matrisi tabloda gorunuyor.

## 5) Sistem Ayarlari

- [ ] Firma bilgileri kaydediliyor (ad, vergi no, adres, telefon).
- [ ] POS ayarlari kaydediliyor (fis yazici, para birimi, varsayilan odeme).
- [ ] Logo yukleme calisiyor ve onizleme gorunuyor.
- [ ] `Veritabani Yedegi Al` butonu backup donusu uretiyor (`fileUrl`).

## 6) Lisanslama

- [ ] Lisans plani secilebiliyor (`Starter/Pro/Enterprise`).
- [ ] Son odeme tarihi kaydedilebiliyor.
- [ ] Kullanim verisi gorunuyor:
  - Sube: `kullanim / limit`
  - Kullanici: `kullanim / limit`
  - POS: `kullanim / limit`

## 7) API Kisa Kontrol

- [ ] `GET /license/me` cevap donuyor.
- [ ] `PUT /license/me` plan guncelliyor.
- [ ] `POST /maintenance/database-backup` backup objesi donuyor.
- [ ] `GET /reports/daily-sales/list` cevap donuyor.
- [ ] `GET /reports/branch-sales`, `GET /reports/cash-report`, `GET /reports/stock`, `GET /reports/refunds` cevap donuyor.

