import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { PageHero } from "@/components/site/page-hero";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Reset password",
  description:
    "Commercial customer portal icin token tabanli sifre guncelleme ekrani.",
  path: "/reset-password"
});

export default function ResetPasswordPage() {
  return (
    <>
      <PageHero
        eyebrow="Reset password"
        title="Yeni portal sifrenizi belirleyin"
        description="E-posta ile gelen tokeni kullanarak musteri portal sifresini guncelleyebilirsiniz."
      />
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
