import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { PageHero } from "@/components/site/page-hero";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Forgot password",
  description:
    "Commercial customer portal icin sifre sifirlama talebi olusturma ekrani.",
  path: "/forgot-password"
});

export default function ForgotPasswordPage() {
  return (
    <>
      <PageHero
        eyebrow="Forgot password"
        title="Portal sifrenizi sifirlayin"
        description="Sifirlama kodu e-posta kuyruguna alinir; web katmaninda POS operasyonu acilmaz."
      />
      <ForgotPasswordForm />
    </>
  );
}
