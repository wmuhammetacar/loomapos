import { ResellerApplyForm } from "@/components/forms/reseller-apply-form";
import { PageHero } from "@/components/site/page-hero";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Reseller application",
  description:
    "Apply to the LoomaPOS reseller program and submit partner details for follow-up and approval.",
  path: "/resellers/apply"
});

export default function ResellersApplyPage() {
  return (
    <>
      <PageHero
        eyebrow="Reseller application"
        title="Apply to become a LoomaPOS reseller"
        description="Share your company profile, field experience and proof of reach so the sales team can review your partner application."
      />
      <ResellerApplyForm />
    </>
  );
}
