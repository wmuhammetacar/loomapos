import { ResellerApplyForm } from "@/components/forms/reseller-apply-form";
import { PageHero } from "@/components/site/page-hero";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Reseller application",
  description:
    "Apply to the LoomaPOS reseller program with your region and business profile for partner onboarding.",
  path: "/resellers/apply"
});

export default function ResellersApplyPage() {
  return (
    <>
      <PageHero
        eyebrow="Reseller application"
        title="Apply to become a LoomaPOS reseller"
        description="Submit your business model, regional coverage and sales experience. Approved partners get referral tracking, lead assignment and commission tools."
      />
      <ResellerApplyForm />
    </>
  );
}
