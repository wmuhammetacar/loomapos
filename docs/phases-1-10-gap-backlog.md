# Phases 1-10 Gap Backlog

## Progress update

- `2026-03-10`: `Item 1 - Internal auth + approval hardening` repo icinde tamamlandi.
- `2026-03-10`: `Item 2 - Ops/admin migrations` repo icinde tamamlandi.
- `2026-03-10`: `Item 3 - Real commerce auth/billing hardening` repo icinde temel production sertlestirme seviyesinde tamamlandi.
- `2026-03-10`: `Item 4 - Persisted analytics warehouse split` repo icinde tamamlandi.
- `2026-03-10`: `Item 5 - Real provider adapter implementations` repo icinde generic REST + SMTP seviyesinde tamamlandi.
- `2026-03-10`: `Item 6 - Real cloud/secret/deploy infrastructure apply path` secret-reference aware runtime env render, CI infra validation ve Terraform ops-policy IaC seviyesinde ileri tasindi; cloud apply halen acik.
- `2026-03-10`: `Item 6 - AWS OIDC plan workflow + AWS Secrets Manager reference pattern` eklendi.
- `2026-03-10`: `Item 6 - AWS OIDC apply workflow + remote backend render` eklendi.
- `2026-03-10`: `Item 6 - apply-ready AWS foundation` (backend render + OIDC plan/apply + strict runtime secret guard) tamamlandi; live apply credential bagimli.
- `2026-03-11`: `Item 2 - Support/case lifecycle deepening` explicit support case model + internal lifecycle actions seviyesinde tamamlandi.
- `2026-03-11`: `Item 3 - Desktop cashier identity separation` local operational cashier profile snapshot modeli ile tamamlandi.
- `2026-03-11`: `Item 4 - Mobile release/signing/background-sync hardening` android+ios platform scaffold, Android release signing guard ve adaptive sync scheduler ile ileri tasindi.
- `2026-03-11`: `Item 5 - Partner/public API docs and advanced mapping/replay tooling` mapping preview endpoint, dead-letter replay endpoint ve portal/admin UI entegrasyonu ile ileri tasindi.
- `2026-03-11`: `Item 4 - Mobile release/signing/background-sync hardening` signing secret validation, Android signing bootstrap ve mobile release workflow ile repo-ici tamamlandi.
- `2026-03-11`: `Item 6 - Real cloud/secret/deploy infrastructure apply path` AWS plan/apply preflight validation ve production apply confirmation guard ile repo-ici sertlestirme ilerletildi.
- `2026-03-11`: `Item 6 - Real cloud/secret/deploy infrastructure apply path` terraform plan summary/artifact + change-threshold/destroy guard ile apply workflow sertlestirildi.
- `2026-03-11`: `Item 2 - Support/case lifecycle deepening` customer+reseller case reply endpointleri ve internal support message flow ile guvenli lifecycle bir adim daha derinlestirildi.
- `2026-03-11`: `Item 7 - Internal support access foundation` support-access session baslat/bitir/listele endpointleri + admin security panel aksiyonlari ile ilerletildi.
- `2026-03-11`: `P1 - Phase 8 scheduled reports/email delivery and saved views hardening` tenant analytics schedule/saved-view persistence + API + portal UI foundation seviyesinde ilerletildi.
- `2026-03-11`: `P1 - Phase 9 public API docs/sdk generation and partner onboarding artifacts` quickstart dokumani, Postman koleksiyonu, `/public/v1/docs/*` artifact endpointleri ve TypeScript public SDK foundation ile ilerletildi.
- `2026-03-11`: `P1 - Phase 10 operational telemetry wiring + alert/dashboard deepening` alert listesi + ack, incident create/status update, dependency upsert ve capacity snapshot aksiyonlari endpoint+UI ile ilerletildi.
- `2026-03-11`: `P1 - Phase 10 backup/restore timeline ownership deepening + ops audit viewer` restore validation timeline, backup/restore run create endpointleri ve ops audit log viewer endpoint+UI ile ilerletildi.
- Siradaki aktif is: `EXT - live cloud/provider/app-store/signing cutover` (dis credential bagimli adimlar).

Bu belge, Phase 1-10 arasinda repo icinde halen acik kalan veya production-final sayilmayacak alanlari oncelik sirasiyla toplar.

Oncelik seviyeleri:
- `P0`: canli sistem guvenligi, veri butunlugu, auth, odeme, gizli anahtar, rollback, restore gibi kritik bosluklar
- `P1`: dogrudan operasyonel guven ve destek verimliligi etkileyen ama sistemi tamamen durdurmayan bosluklar
- `P2`: product-completeness ve enterprise hardening alanlari
- `EXT`: dis credential, vendor hesabi veya cloud erisimi olmadan tamamen kapatilamayacak alan

## Global cross-phase

### P0
- Secret manager entegrasyonu referans seviyesinde; gercek secret vault/provider baglantisi yok.

### P1
- Merkezi config invalidation / stale cache busting mekanizmasi net uygulanmadi.
- Production incident/postmortem lifecycle persistence UI seviyesinde tam degil.
- Runtime feature-flag expiration / temporary support override cleanup otomasyonu yok.

### EXT
- Canli payment, mail, SMS, e-invoice, fiscal, object storage, CDN, auth provider credential'lari.
- Gercek cloud infra apply ve managed service provisioning.
- Desktop code signing, mobile signing key/store release erisimi.

## Phase 1 - Commercial website

### P1
- Public content ve screenshot bloklari halen placeholder agirlikli.
- Blog/docs/FAQ bilgi mimarisi var, ama gercek editorial icerik ve SEO content depth sinirli.

### P2
- Analytics/cookie consent ve marketing attribution production-grade consent management seviyesinde degil.

## Phase 2 - Commerce backend and customer account core

### P0
- Gercek payment provider adapter implementation yok; `mock` ve placeholder adapter modeli var.
- Mail dispatch provider'i pickup/foundation seviyesinde; gercek SMTP/provider delivery yok.

### P1
- Invoice PDF ve billing dokumanlari var ama production provider reconciliation derinligi sinirli.
- Trial/coupon/promo tarafi foundation seviyesinde; tam redemption policy ve abuse controls eksik.
- Support ticketing hala intake/foundation seviyesinde.

### EXT
- Stripe/Iyzico/PayTR live keys ve webhook endpoints.
- SMTP/mail provider / transactional mail domain setup.

## Phase 3 - Desktop POS foundation

### P0
- Ayri operational cashier identity domain'i tamamlanmadi; commerce identity handoff ile calisiyor.
- Secure OS credential/token storage daha ileri sertlestirme istiyor.

### P1
- Cloud catalog bootstrap ve branch/device assignment backend-managed final modele tam gecmedi.
- Tailwind/Zustand kullanimi prompttaki stackle birebir hizalanmis degil; mevcut uygulama alternatif state/CSS ile calisiyor.

### EXT
- Desktop installer signing certificate ve gercek update hosting.

## Phase 4 - Desktop operational engine

### P0
- Sync engine credible durumda ama gercek multi-tenant production traffic altinda soak/load validation yok.

### P1
- Printer/cash drawer/customer display adapterlari structure olarak var; vendor-specific real adapters yok.
- Cloud-side stock/pricing/config payloadlari placeholder/foundation seviyesinde.

### EXT
- Gercek fiscal/payment terminal vendor SDK baglantilari.
- Gercek saha cihaz testleri.

## Phase 5 - Mobile operational core

### P0
- APK/IPA production build and signing validation pipeline foundation repo icinde tamamlandi.

### P1
- Product create/edit conflict review flow foundation var; daha derin merge/review tooling eksik.
- Push notification provider entegrasyonu yok; local storage/routing foundation var.
- Background sync mobile OS policy seviyesinde daha fazla sertlestirme istiyor.

### EXT
- Android/iOS signing keys, store pipelines, crash reporting SaaS credentials.

## Phase 6 - Customer and reseller portals

### P1
- Support ticket lifecycle foundation seviyesinde; tam ticketing/SLA/case workflow derin degil.
- Reseller payout/commission accounting production-final derinlikte degil; gorunurluk iyi ama odeme operasyonu tam degil.

## Phase 7 - Internal operations platform

### P1
- Support case, internal note, dead-letter, queue health, impersonation session modelleri explicit ama tam uretim derinliginde persist edilmedi veya dar kaldi.
- Internal shadow-view / impersonation gercek kontrollu session sistemi olarak bitmedi.

## Phase 8 - Analytics and AI intelligence

### P1
- Warehouse aggregate'lari persistence seviyesinde ayrildi, ancak ayri fiziksel analytics datastore/ETL worker topolojisi sonraki cloud fazinda tamamlanacak.
- Scheduled reports/email delivery ve saved views placeholder seviyesinde.
- Forecasting arayuzleri var ama gercek model pipeline/training yok.
- Data quality checks kismen service-layer'da; ETL/warehouse job orchestration yok.

## Phase 9 - Integrations and extensibility

### P0
- Vendor-specific provider adapters halen eksik; generic REST ve SMTP adapterleri eklendi.
- Secret rotation ve provider reconnect lifecycle production-final degil.

### P1
- Public API docs/sdk generation tamamlandi; sonraki adim partner onboarding video/interactive sandbox materyalleri.

### EXT
- E-invoice, fiscal, ERP, ecommerce, SMS/email vendor hesaplari ve test ortamlari.

## Phase 10 - Production readiness

### P0
- Gercek cloud apply edilmis IaC yok.
- Restore validation gercek environment rehearsal seviyesinde uygulanmadi.

### P1
- Canary/staged rollout otomasyonu ve deployment record persistence daha ileri seviyeye tasinmali.
- Alert rules eklendi ama telemetry kaynaklari ve dashboard wiring tamamlanmali.
- Cost/capacity snapshots gercek metrics pipeline ile beslenmiyor.
- Backup/restore status internal admin'de daha derin timeline/ownership bilgisiyle tamamlanabilir.

### EXT
- Gercek secret manager, cloud monitoring, CDN/WAF, autoscaling, managed DB/cache, signed artifact storage.

## Ordered execution plan

1. `P0` Real cloud/secret/deploy infrastructure apply path
   - Phase 10
2. `P1` Mobile release/signing/background-sync hardening
5. `P1` Partner/public API docs and advanced mapping/replay tooling

## Recommended next item

Ilk uygulanmasi gereken repo-ici is:

`Item 6: Real cloud/secret/deploy infrastructure apply path`

Sebep:
- Phase 10'un en buyuk acik alani
- Repo ici scaffold hazir, ama gercek deploy/secret/apply yolu hala eksik
- Kalan production-grade farkin buyuk bolumu burada
