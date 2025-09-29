import Link from "next/link";
import { deleteContractById, fetchContracts } from "@/lib/contracts";
import type { Contract } from "@/lib/schemas/contract";
import SearchContracts from "@/app/components/search-contracts";
import IndexingFilters from "@/app/components/indexing-filters";
import DeleteButton from "@/app/components/delete-button";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/mongodb";
import { getDailyEurRon } from "@/lib/exchange";
import { getDailyBtEurSell } from "@/lib/exchange-bt";
import { getDailyRaiEurSell } from "@/lib/exchange-rai";
import { revalidatePath } from "next/cache";
import ActionButton from "@/app/components/action-button";

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

  const nextRelevantDate = (c: Contract): Date | null => {
    const nextIdx = nextIndexing(c.indexingDates);
    const candidates: Date[] = [];
    if (nextIdx) candidates.push(new Date(nextIdx));
    if (c.endDate) candidates.push(new Date(c.endDate));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.getTime() - b.getTime());
    return candidates[0];
  };

  // Only consider an upcoming (today or future) indexing date for sorting precedence
  const upcomingIndexingDate = (c: Contract): Date | null => {
    const n = nextIndexing(c.indexingDates);
    if (!n) return null;
    const d = new Date(n);
    return d >= startOfToday ? d : null;
  };

  const fmtEUR = (n: number) =>
    n.toLocaleString("ro-RO", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    });
  const fmtRON = (n: number) =>
    n.toLocaleString("ro-RO", {
      style: "currency",
      currency: "RON",
      maximumFractionDigits: 2,
    });

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

  // Sorting: expired to the end; among active, upcoming indexing date prevails; fallback to endDate
  contracts.sort((a, b) => {
    const expiredA = new Date(a.endDate) < now;
    const expiredB = new Date(b.endDate) < now;
    if (expiredA !== expiredB) return expiredA ? 1 : -1; // push expired to the end

    const ai = upcomingIndexingDate(a);
    const bi = upcomingIndexingDate(b);
    if (ai && bi) return ai.getTime() - bi.getTime();
    if (ai && !bi) return -1;
    if (!ai && bi) return 1;

    // Fallback: sort by end date ascending
    const ad = new Date(a.endDate).getTime();
    const bd = new Date(b.endDate).getTime();
    return ad - bd;
  });

  // Totals for the currently displayed list
  const totals = contracts.reduce(
    (acc, c) => {
      if (typeof c.amountEUR === "number") acc.eur += c.amountEUR;
      if (
        typeof c.amountEUR === "number" &&
        typeof c.exchangeRateRON === "number"
      ) {
        const baseRon = c.amountEUR * c.exchangeRateRON;
        const corrPct =
          typeof c.correctionPercent === "number" ? c.correctionPercent : 0;
        const corrected = baseRon * (1 + corrPct / 100);
        const tvaPct = typeof c.tvaPercent === "number" ? c.tvaPercent : 0;
        const tvaAmt = corrected * (tvaPct / 100);
        acc.ronBase += corrected;
        acc.tva += tvaAmt;
        acc.ronWithTva += corrected + tvaAmt;
      }
      return acc;
    },
    { eur: 0, ronBase: 0, tva: 0, ronWithTva: 0 }
  );

  // Fetch BT daily EUR selling rate (cached in DB by date)
  let bt: { rate: number; date: string } | null = null;
  try {
    const res = await getDailyBtEurSell({ forceRefresh: false });
    bt = { rate: res.rate, date: res.date };
  } catch {}

  let rai: { rate: number; date: string } | null = null;
  try {
    const res = await getDailyRaiEurSell({ forceRefresh: false });
    rai = { rate: res.rate, date: res.date };
  } catch {}

  async function refreshBtRate() {
    "use server";
    try {
      await getDailyBtEurSell({ forceRefresh: true });
    } catch {
      // swallow errors to avoid client "unexpected response"; we still revalidate
    }
    revalidatePath("/");
  }

  async function refreshRaiRate() {
    "use server";
    try {
      await getDailyRaiEurSell({ forceRefresh: true });
    } catch {
      // swallow errors to avoid client "unexpected response"; we still revalidate
    }
    revalidatePath("/");
  }

  async function updateAllExchangeRates() {
    "use server";
    if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
      return;
    }
    const { rate } = await getDailyEurRon({ forceRefresh: true });
    const db = await getDb();
    await db
      .collection("contracts")
      .updateMany(
        { amountEUR: { $exists: true } },
        { $set: { exchangeRateRON: rate } }
      );
    revalidatePath("/");
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-screen-2xl">
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Contracte
            </h1>
            <p className="text-foreground/70 text-sm sm:text-base">
              Placeholder-e pentru fiecare contract din baza de date
            </p>
          </div>
          <div className="w-full sm:w-auto">
            {/* Exchange rates moved above the search bar */}
            <div className="mt-2 rounded-lg bg-foreground/5 p-3 sm:p-4 text-sm flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-foreground/60">
                Curs BT (vânzare EUR):{" "}
              </span>
              {bt ? (
                <span className="font-medium text-fuchsia-700 dark:text-fuchsia-400">
                  {bt.rate.toFixed(4)} RON/EUR
                </span>
              ) : (
                <span className="text-foreground/60 italic">Indisponibil</span>
              )}
              <span className="text-foreground/50">
                {" "}
                · Data (EET/EEST): {bt ? bt.date : "—"}
              </span>
              <form
                action={refreshBtRate}
                method="POST"
                className="inline-block ml-auto"
              >
                <ActionButton
                  className="rounded-md border border-foreground/20 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold hover:bg-foreground/5"
                  title="Actualizează cursul BT (vânzare EUR)"
                  successMessage="Cursul BT a fost actualizat"
                >
                  Actualizează cursul BT
                </ActionButton>
              </form>
            </div>

            <div className="mt-2 rounded-lg bg-foreground/5 p-3 sm:p-4 text-sm flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-foreground/60">
                Curs Raiffeisen (vânzare EUR):{" "}
              </span>
              {rai ? (
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  {rai.rate.toFixed(4)} RON/EUR
                </span>
              ) : (
                <span className="text-foreground/60 italic">Indisponibil</span>
              )}
              <span className="text-foreground/50">
                {" "}
                · Data (EET/EEST): {rai ? rai.date : "—"}
              </span>
              <form
                action={refreshRaiRate}
                method="POST"
                className="inline-block ml-auto"
              >
                <ActionButton
                  className="rounded-md border border-foreground/20 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold hover:bg-foreground/5"
                  title="Actualizează cursul Raiffeisen (vânzare EUR)"
                  successMessage="Cursul Raiffeisen a fost actualizat"
                >
                  Actualizează cursul RAI
                </ActionButton>
              </form>
            </div>

            <div className="flex items-center gap-3 w-full">
              <SearchContracts initialQuery={q} />
              <IndexingFilters />
            </div>
            <form
              action={updateAllExchangeRates}
              method="POST"
              className="mt-2"
            >
              <ActionButton
                className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs sm:text-sm font-semibold hover:bg-foreground/5 disabled:opacity-60"
                title={
                  !(process.env.MONGODB_URI && process.env.MONGODB_DB)
                    ? "MongoDB nu este configurat"
                    : "Actualizează cursul pentru toate contractele"
                }
                successMessage="Cursul a fost actualizat pentru toate contractele"
              >
                Actualizează cursul (toate contractele)
              </ActionButton>
            </form>
            <div className="text-right sm:text-left">
              <div className="text-sm sm:text-base text-foreground/60 shrink-0">
                Total: {contracts.length}
              </div>
              <div className="text-xs sm:text-sm text-foreground/60">
                {"EUR: "}
                <span className="font-medium text-indigo-700 dark:text-indigo-400">
                  {fmtEUR(totals.eur)}
                </span>
                {" · RON: "}
                <span className="font-medium text-sky-700 dark:text-sky-400">
                  {fmtRON(totals.ronBase)}
                </span>
                {" · RON (cu TVA): "}
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {fmtRON(totals.ronWithTva)}
                </span>
                {totals.tva > 0 ? (
                  <>
                    {" "}
                    <span className="text-rose-700 dark:text-rose-400">
                      (TVA: {fmtRON(totals.tva)})
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-5">
          {contracts.map((c) => (
            <article
              key={c.id}
              className="rounded-xl border border-foreground/15 p-5 sm:p-6 hover:border-foreground/30 transition-colors text-base font-mono bg-background/60 shadow-sm space-y-3 sm:space-y-4 overflow-hidden"
            >
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <h2
                  className="text-base font-semibold truncate tracking-tight flex-1 min-w-0"
                  title={c.name}
                >
                  <Link href={`/contracts/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                </h2>
                <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                  {new Date(c.endDate) < now ? (
                    <span className="shrink-0 text-[10px] sm:text-xs uppercase tracking-wide rounded-full px-2 py-1 ring-1 ring-red-500/20 text-red-600 dark:text-red-400">
                      Expirat
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] sm:text-xs uppercase tracking-wide rounded-full px-2 py-1 ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      Activ
                    </span>
                  )}
                  {process.env.MONGODB_URI && process.env.MONGODB_DB ? (
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/contracts/${c.id}/edit`}
                        className="rounded-sm border border-foreground/20 p-1 hover:bg-foreground/5"
                        aria-label="Editează"
                        title="Editează"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3 w-3"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </Link>
                      <DeleteButton
                        label="Șterge"
                        iconOnly
                        className="rounded-sm border border-red-500/30 bg-red-500/10 p-1 text-red-600 hover:bg-red-500/15"
                        action={async () => {
                          "use server";
                          const ok = await deleteContractById(c.id);
                          if (!ok)
                            throw new Error("Nu am putut șterge contractul.");
                          redirect("/");
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              <p
                className="text-base text-foreground/80 truncate break-words"
                title={c.partner}
              >
                Partener: {c.partner}
              </p>
              <p
                className="text-base text-foreground/70 truncate break-words"
                title={c.owner}
              >
                Proprietar: {c.owner ?? "Markov Services s.r.l."}
              </p>

              {typeof c.amountEUR === "number" &&
              typeof c.exchangeRateRON === "number" ? (
                <>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-md bg-foreground/5 p-3">
                      <dt className="text-foreground/60">EUR</dt>
                      <dd className="font-semibold text-base text-indigo-700 dark:text-indigo-400">
                        {fmtEUR(c.amountEUR)}
                      </dd>
                    </div>
                    <div className="rounded-md bg-foreground/5 p-3">
                      <dt className="text-foreground/60">Curs</dt>
                      <dd className="font-semibold text-base text-cyan-700 dark:text-cyan-400">
                        {c.exchangeRateRON.toFixed(4)} RON/EUR
                      </dd>
                    </div>
                    <div className="rounded-md bg-foreground/5 p-3 sm:col-span-2">
                      <dt className="text-foreground/60">
                        {typeof c.tvaPercent === "number" && c.tvaPercent > 0
                          ? `RON (cu TVA ${c.tvaPercent}%)`
                          : "RON"}
                      </dt>
                      <dd className="font-semibold text-base">
                        {(() => {
                          const baseRon = c.amountEUR! * c.exchangeRateRON!;
                          const corr =
                            typeof c.correctionPercent === "number"
                              ? c.correctionPercent
                              : 0;
                          const corrected = baseRon * (1 + corr / 100);
                          const tva =
                            typeof c.tvaPercent === "number" ? c.tvaPercent : 0;
                          const withTva = corrected * (1 + tva / 100);
                          const tvaAmt = corrected * (tva / 100);
                          return (
                            <>
                              <div className="text-emerald-700 dark:text-emerald-400">
                                {fmtRON(withTva)}
                              </div>
                              {typeof c.correctionPercent === "number" ? (
                                <div className="text-xs text-sky-700 dark:text-sky-400">
                                  RON (după corecție): {fmtRON(corrected)}
                                </div>
                              ) : null}
                              {corr > 0 ? (
                                <div className="text-xs text-amber-700 dark:text-amber-400">
                                  Corecție {corr}%:{" "}
                                  {fmtRON(corrected - baseRon)}
                                </div>
                              ) : null}
                              {tva > 0 && tvaAmt > 0 ? (
                                <div className="text-xs text-rose-700 dark:text-rose-400">
                                  TVA {tva}%: {fmtRON(tvaAmt)}
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </dd>
                    </div>
                  </dl>
                  {(() => {
                    const next = nextIndexing(c.indexingDates);
                    if (!next) return null;
                    const nd = new Date(next);
                    let cls = "text-foreground/70";
                    if (nd >= startOfToday) {
                      const diffDays = Math.ceil(
                        (nd.getTime() - startOfToday.getTime()) /
                          (1000 * 60 * 60 * 24)
                      );
                      if (diffDays < 15) cls = "text-red-600";
                      else if (diffDays <= 60) cls = "text-yellow-600";
                    }
                    return (
                      <p className={`mt-2 text-xs truncate ${cls}`}>
                        Indexare: {fmt(next)}
                      </p>
                    );
                  })()}
                </>
              ) : null}

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-foreground/5 p-3">
                  <dt className="text-xs text-foreground/60">Semnat</dt>
                  <dd className="font-medium text-base">{fmt(c.signedAt)}</dd>
                </div>
                <div className="rounded-md bg-foreground/5 p-3">
                  <dt className="text-xs text-foreground/60">Început</dt>
                  <dd className="font-medium text-base">{fmt(c.startDate)}</dd>
                </div>
                <div className="rounded-md bg-foreground/5 p-3">
                  <dt className="text-xs text-foreground/60">Expiră</dt>
                  <dd className="font-medium text-base">{fmt(c.endDate)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
