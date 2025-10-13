import Link from "next/link";
import { fetchPartners } from "@/lib/partners";
import CardsGrid from "@/app/components/ui/cards-grid";
import Card from "@/app/components/ui/card";

export default async function AdminPartnersPage() {
  const partners = await fetchPartners();
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">
          Parteneri
        </h1>
        <Link
          href="/admin/partners/new"
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5"
        >
          Adaugă partener
        </Link>
      </div>
      {/* Cards (show up to <2xl) */}
      <CardsGrid className="mt-6 2xl:hidden">
        {partners.length === 0 && (
          <div className="col-span-full rounded-lg border border-foreground/15 p-6 text-center text-foreground/60">
            Niciun partener.
          </div>
        )}
        {partners.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/partners/${p.id}`}
                className="font-semibold hover:underline truncate"
              >
                {p.name}
              </Link>
              <Link
                href={`/admin/partners/${p.id}`}
                className="shrink-0 rounded border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
              >
                Editează
              </Link>
            </div>
            <dl className="text-xs text-foreground/70 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-foreground/60">CUI</dt>
                <dd className="font-medium">{p.vatNumber}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-foreground/60">Nr. ORC</dt>
                <dd className="font-medium">{p.orcNumber}</dd>
              </div>
              {(p.phone || p.email) && (
                <div className="flex flex-col gap-0.5">
                  {p.phone && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground/60">Tel</dt>
                      <dd className="font-medium truncate max-w-[10rem]">
                        {p.phone}
                      </dd>
                    </div>
                  )}
                  {p.email && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground/60">Email</dt>
                      <dd className="font-medium truncate max-w-[10rem]">
                        {p.email}
                      </dd>
                    </div>
                  )}
                </div>
              )}
              <div>
                <dt className="text-foreground/60">Sediu</dt>
                <dd className="font-medium break-words">{p.headquarters}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </CardsGrid>

      {/* Desktop table (2xl and up) */}
      <div className="mt-6 overflow-x-auto rounded-lg border border-foreground/15 hidden 2xl:block">
        <table className="min-w-full text-sm">
          <thead className="bg-foreground/5 text-foreground/60">
            <tr>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">Nume</th>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">CUI</th>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">Nr. ORC</th>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">Telefon</th>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">Email</th>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">Sediu</th>
              <th className="text-right px-3 py-2 sm:px-4 sm:py-3">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id} className="border-t border-foreground/10">
                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                  <Link href={`/partners/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                  {p.vatNumber}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                  {p.orcNumber}
                </td>
                <td
                  className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap max-w-[8rem] truncate"
                  title={p.phone || ""}
                >
                  {p.phone || "—"}
                </td>
                <td
                  className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap max-w-[12rem] truncate"
                  title={p.email || ""}
                >
                  {p.email || "—"}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 min-w-[16rem]">
                  {p.headquarters}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 text-right">
                  <Link
                    href={`/admin/partners/${p.id}`}
                    className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                  >
                    Editează
                  </Link>
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-foreground/60"
                >
                  Niciun partener.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
