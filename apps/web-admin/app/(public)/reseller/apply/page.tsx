import { ResellerApplyForm } from "@/components/forms/reseller-apply-form";
import { PageHero } from "@/components/site/page-hero";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Reseller apply",
  description:
    "LoomaPOS bayi programi basvuru formu. Sirket bilgileri, deneyim ve sosyal kanit ile partner talebi birakin.",
  path: "/reseller/apply"
});

export default function ResellerApplyPage() {
  return (
    <>
      <PageHero
        eyebrow="Reseller apply"
        title="Bayi basvurunuzu birakin"
        description="Full name, company name, city, phone, email, website/social proof, experience ve message alanlari ile basvurunuzu tamamlayin."
      />
      <ResellerApplyForm />
    </>
  );
}
