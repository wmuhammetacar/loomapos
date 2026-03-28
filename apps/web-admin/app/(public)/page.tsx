import Link from "next/link";
import { SchemaScript } from "@/components/site/schema-script";
import { SectionHeading } from "@/components/site/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { buildMetadata, buildSoftwareSchema } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Kasada hiz, subede tam kontrol",
  description:
    "LoomaPOS ile kasada islemleri hizlandirin, stok ve personel kontrolunu tek merkezde toplayin. Desktop POS tarafinda satis ve odeme, Mobile'da operasyon takibi ve kontrol, Web'de ise lisans ve hesap yonetimi yapilir.",
  path: "/"
});

const coreFeatures = [
  {
    title: "Satis islemleri",
    description: "Barkod ve odeme adimlarini hizlandirir, kasa bekleme suresini kisaltir."
  },
  {
    title: "Stok yonetimi",
    description: "Kritik stok seviyelerini net gosterir, kayip satisi azaltir."
  },
  {
    title: "Raporlama",
    description: "Gun sonu kararlarini hizlandirir, karlilik takibini netlestirir."
  },
  {
    title: "Personel yonetimi",
    description: "Rol ve yetkileri duzenler, operasyonel hata riskini dusurur."
  },
  {
    title: "Sube yonetimi",
    description: "Cok sube takibini merkezilestirir, daginik yonetimi engeller."
  },
  {
    title: "E-fatura",
    description: "Belge sureclerini duzenli tutar, uyumluluk takibini kolaylastirir."
  }
];

const setupSteps = [
  "Deneme baslat",
  "Uygulamayi indir",
  "Lisans ile aktive et",
  "Satisa basla"
];

const pricingPreview = [
  {
    plan: "Starter",
    price: "₺1.490 / ay",
    note: "Tek sube ile hizli baslangic"
  },
  {
    plan: "Growth",
    price: "₺2.990 / ay",
    note: "Buyuyen ekipler ve cok kasa icin dengeli secim",
    recommended: true
  },
  {
    plan: "Enterprise",
    price: "Ozel teklif",
    note: "Kurumsal ihtiyaclara ozel altyapi"
  }
];

const faqItems = [
  {
    question: "Islemler web'de mi yapiliyor?",
    answer:
      "Hayir. Canli satis, iade ve odeme sadece Desktop POS tarafinda yurur. Mobile uygulama operasyon takibi ve kontrol icindir; web ise tanitim, lisans ve hesap yonetimi icindir."
  },
  {
    question: "Lisans nasil calisiyor?",
    answer:
      "Plan secimi sonrasi lisansiniz aninda olusur. Cihaza giris yaptiginizda sistem otomatik aktivasyon adimina yonlendirir."
  },
  {
    question: "Kurulum zor mu?",
    answer:
      "Hayir. Kurulum adimlari nettir; ekipler genelde ayni gun icinde aktif kullanima gecer."
  },
  {
    question: "Uygulamayi indirmek ucretli mi?",
    answer:
      "Indirmek ucretsizdir. Satisa baslamak icin aktif lisans gerekir; indirme tek basina canli kullanim acmaz."
  },
  {
    question: "Kac cihaz baglanabilir?",
    answer:
      "Cihaz limiti plana gore tanimlidir. Ihtiyac arttiginda yukseltme ile limit hemen genisler ve veri kaybi olmaz."
  }
];

export default function HomePage() {
  return (
    <>
      <SchemaScript schema={buildSoftwareSchema()} />

      <section className="relative overflow-hidden rounded-[36px] border border-line bg-white px-6 py-8 shadow-brand md:px-10 md:py-12">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-warning to-accent" />
        <div className="absolute -left-16 top-10 h-40 w-40 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-accent/15 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">POS SaaS</p>
            <h1 className="mt-4 max-w-3xl font-heading text-4xl leading-tight text-text md:text-6xl">
              Kasada islemleri hizlandir, tum subeleri tek merkezden kontrol et.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-text/75">
              LoomaPOS, gunluk satis hizini artirir ve operasyon hatalarini azaltir. Canli satis ve
              odeme sadece Desktop POS tarafinda calisir. Mobile uygulama operasyon izleme ve kontrol
              icindir; kasiyer checkout akisi mobilde yoktur. Web ise sadece fiyat, indirme, lisans
              ve hesap yonetimi icindir.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className={buttonVariants({ variant: "primary", size: "lg" })}>
                Ucretsiz Deneme Baslat
              </Link>
              <Link href="/demo" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Demo Izle
              </Link>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-text/60">
              Kredi karti gerekmez • Kurulum 5 dakika • Indirmek ucretsiz, kullanmak lisanslidir
            </p>
          </div>

          <Card className="rounded-[28px] border-slate-200 bg-slate-950 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Urun gorunumu</p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold">Desktop POS</p>
              <p className="mt-1 text-xs text-white/70">Kasa, satis, odeme ve fis akisi</p>
              <div className="mt-3 h-20 rounded-xl bg-gradient-to-br from-white/20 to-white/5" />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold">Mobile</p>
                <p className="mt-1 text-[11px] text-white/65">Takip ve kontrol (kasiyer checkout degil)</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold">Web</p>
                <p className="mt-1 text-[11px] text-white/65">Lisans ve hesap yonetimi</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Urun modeli"
          title="Hangi yuzey ne icin kullanilir?"
          description="Dogru yuzey ayrimi ekip hatalarini azaltir ve canliya gecisi hizlandirir."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardTitle>Desktop POS</CardTitle>
            <p className="mt-3 text-sm leading-6 text-text/72">
              Gercek operasyon burada yurur: kasa, satis, iade ve odeme akisi.
            </p>
          </Card>
          <Card>
            <CardTitle>Mobile</CardTitle>
            <p className="mt-3 text-sm leading-6 text-text/72">
              Sube, personel ve performans takibini hareket halindeyken surdurur; kasiyer odeme/checkout akisi mobilde calismaz.
            </p>
          </Card>
          <Card>
            <CardTitle>Web</CardTitle>
            <p className="mt-3 text-sm leading-6 text-text/72">
              Urun tanitimi, fiyatlandirma, indirme, lisans ve hesap yonetimi icindir.
            </p>
          </Card>
        </div>
        <p className="rounded-2xl border border-line bg-muted/35 px-4 py-3 text-sm font-semibold text-text/75">
          Web uzerinde canli satis veya odeme yapilmaz. Satis/odeme Desktop POS tarafinda, Mobile ise operasyon takip/kontrol akisinda kullanilir.
        </p>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Temel ozellikler"
          title="Isinizi buyuten cekirdek moduller"
          description="Bu moduller manuel hatayi dusurur, operasyon ritmini hizlandirir."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {coreFeatures.map((item) => (
            <Card key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{item.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Nasil calisir?"
          title="4 adimda canliya gecin"
          description="Net adimlar sayesinde ekipler genelde ayni gun ilk satisa gecer."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {setupSteps.map((item, index) => (
            <Card key={item}>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Adim {index + 1}</p>
              <p className="mt-3 text-lg font-semibold text-text">{item}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Urun gorselleri"
          title="Gercek kullanim akislarini gorun"
          description="Kullanicinin ekranda ne gordugu nettir: satis, stok, rapor."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <div className="h-48 rounded-[22px] border border-line bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-4">
              <div className="h-5 w-24 rounded bg-white/25" />
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="h-16 rounded bg-white/20" />
                <div className="h-16 rounded bg-white/15" />
                <div className="h-16 rounded bg-white/10" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-text/65">
              <span className="rounded-full border border-line px-2 py-1">Barkod okutma</span>
              <span className="rounded-full border border-line px-2 py-1">Sepet</span>
              <span className="rounded-full border border-line px-2 py-1">Odeme</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-text">Desktop POS satis ekrani</p>
          </Card>

          <Card>
            <div className="h-48 rounded-[22px] border border-line bg-gradient-to-br from-brand/20 to-brand/5 p-4">
              <div className="mx-auto h-full max-w-[140px] rounded-2xl border border-brand/25 bg-white/80 p-3">
                <div className="h-4 rounded bg-brand/25" />
                <div className="mt-3 space-y-2">
                  <div className="h-3 rounded bg-brand/20" />
                  <div className="h-3 rounded bg-brand/15" />
                  <div className="h-3 rounded bg-brand/10" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-text/65">
              <span className="rounded-full border border-line px-2 py-1">Gunluk ciro</span>
              <span className="rounded-full border border-line px-2 py-1">Sube ozeti</span>
              <span className="rounded-full border border-line px-2 py-1">Cihaz durumu</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-text">Mobile kontrol ekrani</p>
          </Card>

          <Card>
            <div className="h-48 rounded-[22px] border border-line bg-gradient-to-br from-accent/20 to-accent/5 p-4">
              <div className="grid h-full grid-cols-2 gap-3">
                <div className="rounded bg-white/70" />
                <div className="rounded bg-white/50" />
                <div className="col-span-2 rounded bg-white/35" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-text/65">
              <span className="rounded-full border border-line px-2 py-1">Satis trendi</span>
              <span className="rounded-full border border-line px-2 py-1">Karlilik</span>
              <span className="rounded-full border border-line px-2 py-1">Sube karsilastirma</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-text">Raporlama ve yonetim gorunumu</p>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Fiyat onizleme"
          title="Ihtiyaciniza gore plan secin"
          description="Plan farklari limit ve kontrol seviyesi uzerinden net ayrilir."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {pricingPreview.map((item) => (
            <Card
              key={item.plan}
              className={item.recommended ? "border-brand bg-brand/[0.04] shadow-brand" : ""}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">
                {item.recommended ? "Onerilen" : "Plan"}
              </p>
              <CardTitle className="mt-3">{item.plan}</CardTitle>
              <p className="mt-3 text-2xl font-bold text-text">{item.price}</p>
              <p className="mt-3 text-sm leading-6 text-text/72">{item.note}</p>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-text/60">
          <span className="rounded-full border border-line px-3 py-1">Istedigin zaman iptal</span>
          <span className="rounded-full border border-line px-3 py-1">Yukseltince veri kaybi olmaz</span>
          <span className="rounded-full border border-line px-3 py-1">Odeme sonrasi aninda aktif</span>
        </div>
        <Link href="/pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Planlari Gor
        </Link>
      </section>

      <section className="rounded-[32px] border border-line bg-white px-6 py-8 md:px-8">
        <SectionHeading
          eyebrow="Indirme"
          title="Indirmek ucretsiz, kullanmak lisanslidir."
          description="Indirme ile satin alma farklidir. Lisans aktivasyonu sonrasi canli operasyona gecilir."
        />
        <p className="mt-2 text-sm font-semibold text-text">
          Uygulamayi indirmeniz ucretsizdir; satisa baslamak icin aktif lisans zorunludur.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/download#windows" className={buttonVariants({ variant: "outline", size: "md" })}>
            Windows Indir
          </Link>
          <Link href="/download#android" className={buttonVariants({ variant: "ghost", size: "md" })}>
            Android Indir
          </Link>
        </div>
      </section>

      <section className="rounded-[32px] border border-line bg-white px-6 py-8 md:px-8">
        <SectionHeading
          eyebrow="Bayi programi"
          title="Musteri getir, tekrar eden gelir kazan"
          description="Partner kanalina kisa ve net giris: lead uret, satisa donustur, komisyon kazan."
        />
        <p className="mt-2 text-sm text-text/72">
          Bayi kanali ana musteri akisini bozmaz; partner akisina net bir gecis sunar.
        </p>
        <Link href="/resellers/apply" className={buttonVariants({ variant: "outline", size: "md" })}>
          Bayi Ol
        </Link>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Sik sorulanlar"
          title="Karar oncesi en kritik sorular"
          description="Kisa ve net cevaplar, satin alma oncesi supheyi azaltir."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {faqItems.map((item) => (
            <Card key={item.question}>
              <p className="font-semibold text-text">{item.question}</p>
              <p className="mt-3 text-sm leading-6 text-text/72">{item.answer}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-[36px] border border-line bg-slate-950 px-6 py-9 text-white md:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Son adim</p>
        <h2 className="mt-3 max-w-2xl font-heading text-3xl leading-tight md:text-4xl">
          Magazanizi bugun kurun, ilk satisa hizli gecin.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">
          14 gun sureli deneme ile baslayin. Deneme bitince sistem salt-okunur moda gecer; kesintisiz
          devam icin aktif plan ve lisans gerekir.
        </p>
        <div className="mt-7">
          <Link href="/register" className={buttonVariants({ variant: "primary", size: "lg" })}>
            Ucretsiz Deneme Baslat
          </Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
            Kredi karti gerekmez • 2 dakikada basla • Istedigin zaman iptal
          </p>
        </div>
      </section>
    </>
  );
}
