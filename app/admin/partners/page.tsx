import Link from "next/link";
import { fetchPartners } from "@/lib/partners";
import Breadcrumb from "@/app/components/breadcrumb";
import { PartnersClient } from "./partners-client";

export const dynamic = "force-dynamic";

export default async function AdminPartnersPage() {
  const partners = await fetchPartners();
  const vatPayers = partners.filter((p) => p.isVatPayer).length;

  return (
    <div className="max-w-7xl pt-4">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Parteneri" },
        ]}
      />

      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
            Parteneri
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            {partners.length} parteneri · {vatPayers} plătitori TVA
          </p>
        </div>
        <Link
          href="/admin/partners/new"
          className="rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background hover:bg-foreground/90 transition-colors"
        >
          + Partener nou
        </Link>
      </div>

      <PartnersClient partners={partners} />
    </div>
  );
}
