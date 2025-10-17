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
              <div className="min-w-0">
                <Link
                  href={`/partners/${p.id}`}
                  className="font-semibold hover:underline truncate"
                  title={p.name}
                >
                  {p.name}
                </Link>
                <div className="mt-1 text-[11px] text-foreground/60 font-mono">
                  ID: {p.id}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    p.isVatPayer
                      ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                      : "bg-foreground/10 text-foreground/70 border border-foreground/20"
                  }`}
                >
                  TVA: {p.isVatPayer ? "Da" : "Nu"}
                </span>
                <Link
                  href={`/admin/partners/${p.id}`}
                  className="shrink-0 rounded border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                >
                  Editează
                </Link>
              </div>
            </div>
            <dl className="mt-2 text-xs text-foreground/80 space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-foreground/60">CUI</dt>
                  <dd className="font-medium">{p.vatNumber}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-foreground/60">Nr. ORC</dt>
                  <dd className="font-medium">{p.orcNumber}</dd>
                </div>
              </div>
              <div>
                <dt className="text-foreground/60">Sediu</dt>
                <dd className="font-medium break-words">{p.headquarters}</dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-foreground/60">Creat</div>
                <div className="text-right font-medium">{p.createdAt}</div>
                <div className="text-foreground/60">Actualizat</div>
                <div className="text-right font-medium">{p.updatedAt}</div>
              </div>
              <div className="pt-1">
                <dt className="text-foreground/60">Reprezentanți</dt>
                {p.representatives?.length ? (
                  <ul className="mt-1 space-y-1">
                    {p.representatives.map((r, i) => (
                      <li
                        key={i}
                        className="rounded border border-foreground/15 p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium truncate">
                            {r.fullname || "—"}
                          </div>
                          {r.primary && (
                            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-700">
                              Primar
                            </span>
                          )}
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2 text-foreground/70">
                          <div
                            className="truncate"
                            title={r.phone ?? undefined}
                          >
                            Tel: {r.phone || "—"}
                          </div>
                          <div
                            className="truncate"
                            title={r.email ?? undefined}
                          >
                            Email: {r.email || "—"}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-foreground/60">—</div>
                )}
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
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">Rep. Tel</th>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">
                Rep. Email
              </th>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">Sediu</th>
              <th className="text-right px-3 py-2 sm:px-4 sm:py-3">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => {
              const primary = Array.isArray(p.representatives)
                ? p.representatives.find((r) => (r as any).primary) ||
                  p.representatives[0]
                : undefined;
              const pPhone = (primary as any)?.phone as string | undefined;
              const pEmail = (primary as any)?.email as string | undefined;
              return (
                <tr key={p.id} className="border-t border-foreground/10">
                  <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                    <Link
                      href={`/partners/${p.id}`}
                      className="hover:underline"
                    >
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
                    title={pPhone || ""}
                  >
                    {pPhone || "—"}
                  </td>
                  <td
                    className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap max-w-[12rem] truncate"
                    title={pEmail || ""}
                  >
                    {pEmail || "—"}
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
              );
            })}
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
