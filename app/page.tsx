import Link from "next/link";
import { deleteContractById, fetchContracts } from "@/lib/contracts";
import SearchContracts from "@/app/components/search-contracts";
import IndexingFilters from "@/app/components/indexing-filters";
import DeleteButton from "@/app/components/delete-button";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/mongodb";
import { getDailyEurRon } from "@/lib/exchange";
import { revalidatePath } from "next/cache";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; range?: string }>;
}) {
  const { q = "", range = "" } = (await searchParams) ?? {};
  const all = await fetchContracts();
  const query = q.trim().toLowerCase();
  let contracts = query
    ? all.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.partner.toLowerCase().includes(query) ||
          (c.owner?.toLowerCase?.().includes(query) ?? false)
      )
    : all;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("ro-RO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const nextIndexing = (dates?: string[]) => {
    if (!dates || dates.length === 0) return null;
    const sorted = [...dates].sort();
    const next = sorted.find((d) => new Date(d) >= startOfToday);
    return next ?? sorted[sorted.length - 1];
  };

  const fmtEUR = (n: number) =>
    n.toLocaleString("ro-RO", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  const fmtRON = (n: number) =>
    n.toLocaleString("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 2 });

  // Optional filter by next indexing within N days
  if (range === "15" || range === "60") {
    const days = range === "15" ? 15 : 60;
    const end = new Date(startOfToday);
    end.setDate(end.getDate() + days);
    contracts = contracts.filter((c) => {
      const n = nextIndexing(c.indexingDates);
      if (!n) return false;
      const d = new Date(n);
      return d >= startOfToday && d <= end;
    });
  }

  // Totals for the currently displayed list
  const totals = contracts.reduce(
    (acc, c) => {
      if (typeof c.amountEUR === "number") acc.eur += c.amountEUR;
      if (typeof c.amountEUR === "number" && typeof c.exchangeRateRON === "number") {
        const baseRon = c.amountEUR * c.exchangeRateRON;
        const tvaPct = typeof (c as any).tvaPercent === "number" ? (c as any).tvaPercent : 0;
        const tvaAmt = baseRon * (tvaPct / 100);
        acc.ronBase += baseRon;
        acc.tva += tvaAmt;
        acc.ronWithTva += baseRon + tvaAmt;
      }
      return acc;
    },
    { eur: 0, ronBase: 0, tva: 0, ronWithTva: 0 }
  );

  async function updateAllExchangeRates() {
    "use server";
    if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
      return;
    }
    const { rate } = await getDailyEurRon({ forceRefresh: true });
    const db = await getDb();
    await db.collection("contracts").updateMany({ amountEUR: { $exists: true } }, { $set: { exchangeRateRON: rate } });
    revalidatePath("/");
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Contracte</h1>
          <p className="text-foreground/70">
            Placeholder-e pentru fiecare contract din baza de date
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <div className="flex items-center gap-3 w-full">
            <SearchContracts initialQuery={q} />
            <IndexingFilters />
          </div>
          <form action={updateAllExchangeRates} className="mt-2">
            <button
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/5"
              disabled={!(process.env.MONGODB_URI && process.env.MONGODB_DB)}
              title={!(process.env.MONGODB_URI && process.env.MONGODB_DB) ? "MongoDB nu este configurat" : "Actualizează cursul pentru toate contractele"}
            >
              Actualizează cursul (toate contractele)
            </button>
          </form>
          <div className="text-right sm:text-left">
            <div className="text-sm text-foreground/60 shrink-0">Total: {contracts.length}</div>
            <div className="text-xs text-foreground/60">
              {"EUR: "}
              <span className="font-medium text-foreground/80">{fmtEUR(totals.eur)}</span>
              {" · RON: "}
              <span className="font-medium text-foreground/80">{fmtRON(totals.ronBase)}</span>
              {" · RON (cu TVA): "}
              <span className="font-medium text-foreground/80">{fmtRON(totals.ronWithTva)}</span>
              {totals.tva > 0 ? (
                <>
                  {" "}
                  <span className="text-foreground/60">(TVA: {fmtRON(totals.tva)})</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {contracts.map((c) => (
          <article
            key={c.id}
            className="rounded-lg border border-foreground/15 p-4 hover:border-foreground/30 transition-colors text-[105%]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold truncate" title={c.name}>
                <Link href={`/contracts/${c.id}`} className="hover:underline">
                  {c.name}
                </Link>
              </h2>
              <div className="flex items-center gap-2">
                {process.env.MONGODB_URI && process.env.MONGODB_DB ? (
                  <Link
                    href={`/contracts/${c.id}/edit`}
                    className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] font-semibold hover:bg-foreground/5"
                  >
                    Edit
                  </Link>
                ) : null}
                {new Date(c.endDate) < now ? (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ring-1 ring-red-500/20 text-red-600 dark:text-red-400">
                    Expirat
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    Activ
                  </span>
                )}
                {process.env.MONGODB_URI && process.env.MONGODB_DB ? (
                  <DeleteButton
                    label="Șterge"
                    action={async () => {
                      "use server";
                      const ok = await deleteContractById(c.id);
                      if (!ok)
                        throw new Error("Nu am putut șterge contractul.");
                      redirect("/");
                    }}
                  />
                ) : null}
              </div>
            </div>
            <p
              className="mt-1 text-sm text-foreground/70 truncate"
              title={c.partner}
            >
              Partener: {c.partner}
            </p>
            <p
              className="mt-1 text-xs text-foreground/60 truncate"
              title={c.owner}
            >
              Proprietar: {c.owner ?? "Markov Services s.r.l."}
            </p>
            {(() => {
              const next = nextIndexing(c.indexingDates);
              if (!next) return null;
              const nd = new Date(next);
              let cls = "text-foreground/80";
              if (nd >= startOfToday) {
                const diffDays = Math.ceil(
                  (nd.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
                );
                if (diffDays < 15) cls = "text-red-600 flash-red";
                else if (diffDays <= 60) cls = "text-yellow-600";
              }
              return (
                <p className={`mt-1 text-[11px] truncate ${cls}`}>
                  Indexare: {fmt(next)}
                </p>
              );
            })()}

            {typeof c.amountEUR === "number" && typeof c.exchangeRateRON === "number" ? (
              <>
                <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md bg-foreground/5 p-3">
                    <dt className="text-foreground/60">EUR</dt>
                    <dd className="font-medium">{fmtEUR(c.amountEUR)}</dd>
                  </div>
                  <div className="rounded-md bg-foreground/5 p-3">
                    <dt className="text-foreground/60">Curs</dt>
                    <dd className="font-medium">{c.exchangeRateRON.toFixed(4)} RON/EUR</dd>
                  </div>
                  <div className="rounded-md bg-foreground/5 p-3">
                    <dt className="text-foreground/60">{
                      typeof (c as any).tvaPercent === "number" && (c as any).tvaPercent > 0
                        ? `RON (cu TVA ${(c as any).tvaPercent}%)`
                        : "RON"
                    }</dt>
                    <dd className="font-medium">
                      {(() => {
                        const baseRon = c.amountEUR! * c.exchangeRateRON!;
                        const tva = typeof (c as any).tvaPercent === "number" ? (c as any).tvaPercent : 0;
                        const withTva = baseRon * (1 + tva / 100);
                        const tvaAmt = baseRon * (tva / 100);
                        return (
                          <>
                            <div>{fmtRON(withTva)}</div>
                            {tva > 0 && tvaAmt > 0 ? (
                              <div className="text-xs text-foreground/60">TVA {tva}%: {fmtRON(tvaAmt)}</div>
                            ) : null}
                          </>
                        );
                      })()}
                    </dd>
                  </div>
                </dl>
                
              </>
            ) : null}

            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-md bg-foreground/5 p-3">
                <dt className="text-foreground/60">Semnat</dt>
                <dd className="font-medium">{fmt(c.signedAt)}</dd>
              </div>
              <div className="rounded-md bg-foreground/5 p-3">
                <dt className="text-foreground/60">Început</dt>
                <dd className="font-medium">{fmt(c.startDate)}</dd>
              </div>
              <div className="rounded-md bg-foreground/5 p-3">
                <dt className="text-foreground/60">Expiră</dt>
                <dd className="font-medium">{fmt(c.endDate)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </main>
  );
}
