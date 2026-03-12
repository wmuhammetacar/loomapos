# LoomaPOS Desktop POS - Handoff (Design 1 + Design 2)

Bu belge, Figma teslim beklentisindeki ana frame ve style sisteminin kod-handoff karsiligidir.

## Frame Set

1. `POS / Main / Sale`
- Ust bar: `Sube`, `Kasa`, `Kasiyer`, `Online/Offline`, `Saat`
- Sol panel: barkod + sepet + hizli urunlar
- Sag panel: ozet + buyuk odeme CTA + sync + gun sonu
- Alt bar: `F1`, `F2`, `F3`, `F4`, `F7`

2. `POS / Modal / Payment / Cash`
- Alinan tutar
- Para ustu hesap
- `Satisi Tamamla`

3. `POS / Modal / Payment / Card`
- Sabit tutar
- "POS cekim onayi alindi"
- `Satisi Tamamla`

4. `POS / Modal / Refund`
- Fis uzerinden iade
- Direkt urun iadesi (yetki kontrollu)
- Odeme tipi secimi
- Toplam iade

5. `POS / Modal / Day End`
- `X Raporu`: toplam satis, nakit, kart, islem, iade
- `Z Raporu`: acilis, beklenen kasa, girilen kasa, fark

## Style Guide

- Primary: `#2563EB`
- Primary Hover: `#1D4ED8`
- Success: `#16A34A`
- Warning: `#F59E0B`
- Danger: `#DC2626`
- Background: `#F8FAFC`
- Surface: `#FFFFFF`
- Border: `#E5E7EB`
- Font: `Inter`
- Body: `16px`
- Product line: `18px`
- Grand total: `38px` bold

## Keyboard Map

- `F1` Yeni satis
- `F2` Iade
- `F3` Iskonto
- `F4` Musteri
- `F7` Gun sonu
- `F9` Nakit
- `F10` Kart
- `Enter` Varsayilan odeme
- `ESC` Modal kapat
- `DEL` Satir sil
- `+ / -` Miktar arttir/azalt

## Source of Truth

- UI kodu: `apps/desktop-pos/src/renderer/App.tsx`
- Stil tokenlari: `apps/desktop-pos/src/renderer/styles.css`
- Davranis/IPC: `apps/desktop-pos/src/main/ipc/pos-ipc.ts`
