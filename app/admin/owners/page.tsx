import Link from "next/link";
import { fetchOwners } from "@/lib/owners";
import CardsGrid from "@/app/components/ui/cards-grid";
import Card from "@/app/components/ui/card";

export default async function AdminOwnersPage() {
  const owners = await fetchOwners();
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">
          Proprietari
        </h1>
        <Link
          href="/admin/owners/new"
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5"
        >
          Adaugă proprietar
        </Link>
      </div>
      {/* Cards (show up to <2xl) */}
      <CardsGrid className="mt-6 2xl:hidden">
        {owners.length === 0 && (
          <div className="col-span-full rounded-lg border border-foreground/15 p-6 text-center text-foreground/60">
            Niciun proprietar.
          </div>
        )}
        {owners.map((o) => (
          <Card key={o.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold truncate">{o.name}</div>
              <Link
                href={`/admin/owners/${o.id}`}
                className="shrink-0 rounded border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
              >
                Editează
              </Link>
            </div>
            <dl className="text-xs text-foreground/70 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-foreground/60">CUI</dt>
                <dd className="font-medium">{o.vatNumber}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-foreground/60">Nr. ORC</dt>
                <dd className="font-medium">{o.orcNumber}</dd>
              </div>
              <div>
                <dt className="text-foreground/60">Sediu</dt>
                <dd className="font-medium break-words">{o.headquarters}</dd>
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
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">Sediu</th>
              <th className="text-right px-3 py-2 sm:px-4 sm:py-3">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((o) => (
              <tr key={o.id} className="border-t border-foreground/10">
                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                  {o.name}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                  {o.vatNumber}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                  {o.orcNumber}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 min-w-[16rem]">
                  {o.headquarters}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 text-right">
                  <Link
                    href={`/admin/owners/${o.id}`}
                    className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                  >
                    Editează
                  </Link>
                </td>
              </tr>
            ))}
            {owners.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-foreground/60"
                >
                  Niciun proprietar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
