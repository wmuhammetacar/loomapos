# Desktop POS Design System (Bolum 1)

## Hedef
Kasiyerin minimum adimla, minimum hatayla satisi tamamlamasi.

## Renkler
- Primary: `#2563EB`
- Primary Hover: `#1D4ED8`
- Success: `#16A34A`
- Warning: `#F59E0B`
- Danger: `#DC2626`
- Background: `#F8FAFC`
- Surface: `#FFFFFF`
- Border: `#E5E7EB`

## Tipografi
- Font: `Inter` (fallback: Segoe UI, system sans-serif)
- POS ana metin: 16px+
- Urun satiri: 18px
- Genel toplam: 38px (bold)

## Ana Ekran Bolunumu
- Ust bar: sube, kasa, kasiyer, online/offline, saat
- Sol panel: barkod girisi + sepet satirlari + hizli urunlar
- Sag panel: ozet + buyuk odeme CTA + sync + gun sonu
- Alt bar: F1/F2/F3/F4 kisa yol bar

## Klavye Haritasi
- `F1`: Yeni satis
- `F2`: Iade / iptal modal
- `F3`: Iskonto modal
- `F4`: Musteri modal
- `F9`: Nakit odeme
- `F10`: Kart odeme
- `Enter`: Varsayilan odeme (modal disinda)
- `ESC`: Acik modal kapat
- `DEL`: Secili satiri sil
- `+` / `-`: Secili satir miktar degistir

## Modal Akislari
- Nakit: alinan tutar + para ustu hesaplama + satisi tamamla
- Kart: tutar kilitli + POS cekim onayi + satisi tamamla
- Urun bulunamadi: barkod goster, yetkili ise urun ekle butonu

## Dayaniklilik Kurallari
- Yazici hatasi satisi durdurmaz; sadece uyarilir.
- Offline durumda satis devam eder.
- Sync hatalarinda arka plan retry devam eder.
