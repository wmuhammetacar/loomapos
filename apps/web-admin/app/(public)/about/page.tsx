import { PageHero } from "@/components/site/page-hero";
import { Card } from "@/components/ui/card";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "About",
  description:
    "LoomaPOS Phase 1 web platformunun urun konumlandirmasi, ticari hedefi ve dagitim modeli.",
  path: "/about"
});

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="LoomaPOS bir brochure site degil, commercial growth engine"
        description="Bu web platformu ziyaretciyi urune ikna eden, plan secimini kolaylastiran, lisans teslim eden ve uygulama aktivasyonuna hazirlayan ticari merkezdir."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>Trustworthy, professional, enterprise-ready ve retail-friendly bir ton uzerine kuruldu.</Card>
        <Card>Website asla operasyonel POS davranisi sunmaz; sadece subscription, licensing ve downloads yonetir.</Card>
        <Card>Desktop ve Mobile istemciler gercek retail workflow icin ayrildi.</Card>
      </div>
    </>
  );
}
