import Link from "next/link";
import { notFound } from "next/navigation";
import StatsCards from "@/app/components/stats-cards";
import { fetchOwnerById } from "@/lib/owners";
import { fetchContracts, effectiveEndDate, currentRentAmount } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmt(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}.${m}.${y}`;
}

export default async function OwnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  // Try loading owner record (Mongo only)
  const ownerDoc = await fetchOwnerById(decodedId).catch(() => null);

  // Find contracts for this owner (by id or by name fallback)
  const contractsAll = await fetchContracts();
  const contracts = contractsAll.filter((c: any) => {
    const okById = c.ownerId && String(c.ownerId) === decodedId;
    const okByName = String(c.owner || "") === decodedId;
    return okById || okByName;
  });
  if (!ownerDoc && contracts.length === 0) return notFound();

  const ownerName = ownerDoc?.name || (contracts[0] as any)?.owner || decodedId;

  // Split contracts by active vs. expired
  const today = new Date();
  const active: typeof contracts = [] as any;
  const expired: typeof contracts = [] as any;
  for (const c of contracts) {
    const end = new Date(effectiveEndDate(c));
    if (end >= today) active.push(c);
    else expired.push(c);
  }

  const fmtEUR = (n: number) =>
    new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" }).format(n);

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-10">
      <div className="mx-auto max-w-screen-2xl space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <Link href="/" className="text-sm text-foreground/70 hover:underline">
              ← Înapoi la listă
            </Link>
            <h1 className="text-fluid-4xl font-bold leading-tight">{ownerName}</h1>
            {ownerDoc ? (
              <div className="text-sm text-foreground/70 space-y-1">
                <div>
                  <span className="text-foreground/60">CUI: </span>
                  <span className="font-medium">{ownerDoc.vatNumber}</span>
                </div>
                <div>
                  <span className="text-foreground/60">Nr. ORC: </span>
                  <span className="font-medium">{ownerDoc.orcNumber}</span>
                </div>
                <div>
                  <span className="text-foreground/60">Sediu: </span>
                  <span className="font-medium">{ownerDoc.headquarters}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Stats for this owner (prognosis + actual) */}
        <section>
          <div className="rounded-xl border border-foreground/10 bg-background/70 p-4">
            <div className="mb-2 text-sm font-semibold text-foreground/70">Statistici</div>
            <StatsCards owner={ownerName} ownerId={ownerDoc?.id} />
          </div>
        </section>

        {/* Linked contracts */}
        <section>
          <h2 className="text-xl font-semibold tracking-tight mb-3">Contracte active</h2>
          {active.length === 0 ? (
            <div className="rounded-lg border border-foreground/10 bg-background/60 p-4 text-foreground/60">
              Niciun contract activ.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {active
                .slice()
                .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
                .map((c) => {
                  const eur = currentRentAmount(c as any);
                  const endIso = String(effectiveEndDate(c));
                  return (
                    <div key={c.id} className="rounded-lg border border-foreground/10 bg-background/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="text-sm text-foreground/70">
                            {String((c as any).partner || "").trim() || "—"}
                          </div>
                          <Link href={`/contracts/${c.id}`} className="text-base font-semibold hover:underline">
                            {c.name}
                          </Link>
                          <div className="text-xs text-foreground/60">
                            {fmt(c.startDate)} → {fmt(endIso)}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-foreground/60">Chirie</div>
                          <div className="font-medium text-indigo-700 dark:text-indigo-400">
                            {typeof eur === "number" ? fmtEUR(eur) : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight mb-3">Contracte expirate</h2>
          {expired.length === 0 ? (
            <div className="rounded-lg border border-foreground/10 bg-background/60 p-4 text-foreground/60">
              Niciun contract expirat.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {expired
                .slice()
                .sort((a, b) => String(effectiveEndDate(b)).localeCompare(String(effectiveEndDate(a))))
                .map((c) => {
                  const eur = currentRentAmount(c as any);
                  const endIso = String(effectiveEndDate(c));
                  return (
                    <div key={c.id} className="rounded-lg border border-foreground/10 bg-background/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="text-sm text-foreground/70">
                            {String((c as any).partner || "").trim() || "—"}
                          </div>
                          <Link href={`/contracts/${c.id}`} className="text-base font-semibold hover:underline">
                            {c.name}
                          </Link>
                          <div className="text-xs text-foreground/60">
                            {fmt(c.startDate)} → {fmt(endIso)}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-foreground/60">Chirie</div>
                          <div className="font-medium text-indigo-700 dark:text-indigo-400">
                            {typeof eur === "number" ? fmtEUR(eur) : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
