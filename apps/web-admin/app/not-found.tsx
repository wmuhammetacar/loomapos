import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-6 py-10">
      <Card className="w-full text-center">
        <CardTitle>Sayfa bulunamadi</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/70">
          Aradiginiz route bu Phase 1 web platformunda tanimli degil veya artik kullanilmiyor.
        </p>
        <div className="mt-6 flex justify-center gap-4 text-sm font-semibold">
          <Link href="/" className="text-brand">
            Ana sayfa
          </Link>
          <Link href="/pricing" className="text-text">
            Pricing
          </Link>
        </div>
      </Card>
    </main>
  );
}
