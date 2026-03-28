import { PricingConversionPage } from "@/components/site/pricing-conversion-page";
import { SchemaScript } from "@/components/site/schema-script";
import { buildFaqSchema, buildMetadata } from "@/lib/seo";

const pricingFaqSchemaItems = [
  {
    question: "Deneme nasil calisiyor?",
    answer:
      "14 gun boyunca tam urun akisini test edersiniz. Deneme sonunda plani secip lisansi aktif ederek kesintisiz devam edebilirsiniz."
  },
  {
    question: "Kredi karti gerekiyor mu?",
    answer: "Hayir. Denemeyi kredi karti olmadan baslatabilirsiniz."
  },
  {
    question: "Iptal edebilir miyim?",
    answer: "Evet. Planinizi istediginiz zaman iptal edebilirsiniz."
  },
  {
    question: "Lisans nasil aktif edilir?",
    answer:
      "Plan seciminden sonra lisans aninda olusur. Aktivasyonla birlikte satis/odeme Desktop POS tarafinda, Mobile uygulama ise operasyon takip ve kontrol akisinda kullanilir."
  },
  {
    question: "Plan degistirince ne olur?",
    answer:
      "Yukseltme aninda devreye girer. Veri kaybi olmaz, mevcut cihaz ve kayitlar korunur."
  },
  {
    question: "Ek cihaz nasil eklenir?",
    answer: "Planinizi yukseltin veya ek paket tanimlayin; yeni cihazlar hemen aktif edilebilir."
  }
] as const;

export const metadata = buildMetadata({
  title: "Fiyatlar ve Lisans Planlari",
  description:
    "Starter, Growth ve Enterprise planlarini aylik veya yillik secin. Deneme ile hizli baslayin, lisansi aktive edin. Canli satis/odeme Desktop POS tarafinda, Mobile uygulama ise operasyon takip ve kontrol icin kullanilir.",
  path: "/pricing"
});

export default function PricingPage() {
  return (
    <>
      <SchemaScript schema={buildFaqSchema(pricingFaqSchemaItems)} />
      <PricingConversionPage />
    </>
  );
}
