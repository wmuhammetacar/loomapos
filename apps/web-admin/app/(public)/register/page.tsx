import { RegisterForm } from "@/components/forms/register-form";
import { PageHero } from "@/components/site/page-hero";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Customer registration",
  description:
    "Portal hesap olusturma, checkout hizlandirma ve lisans teslim akisi icin musteri kaydi.",
  path: "/register"
});

export default function RegisterPage() {
  return (
    <>
      <PageHero
        eyebrow="Customer registration"
        title="Musteri hesabinizi olusturun"
        description="Kayit sonrasi planlara gecebilir, checkout'u hizlandirabilir ve portalinizi kullanabilirsiniz."
      />
      <RegisterForm />
    </>
  );
}
