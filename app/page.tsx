import Link from "next/link";
import { fetchContracts } from "@/lib/contracts";
import type { Contract } from "@/lib/schemas/contract";
import SearchContracts from "@/app/components/search-contracts";
import IndexingFilters from "@/app/components/indexing-filters";
// import DeleteButton from "@/app/components/delete-button";
// import { redirect } from "next/navigation";
import { getDb } from "@/lib/mongodb";
import { getDailyEurRon } from "@/lib/exchange";
import { getDailyBtEurSell } from "@/lib/exchange-bt";
import ActionButton from "@/app/components/action-button";
import { getEuroInflationPercent } from "@/lib/inflation";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import InflationVerify from "@/app/components/inflation-verify";
import { logAction } from "@/lib/audit";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; range?: string; filterBy?: string }>;
}) {
  // Ensure this page is always rendered dynamically and not cached
  noStore();
  const params = (await searchParams) ?? {};
  const { q = "", range = "", filterBy = "" } = params;

  // Fetch contracts and apply simple text filtering
  const all = await fetchContracts();
  let contracts: Contract[] = all;
  if (q) {
    const qq = String(q).toLowerCase();
    contracts = contracts.filter((c) => {
      return (
        (c.name || "").toLowerCase().includes(qq) ||
        (c.partner || "").toLowerCase().includes(qq) ||
        (c.owner || "").toLowerCase().includes(qq)
      );
    });
  }

  // Dates helpers
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  // Formatting helpers
  const fmt = (d: string | Date) => {
    const dt = typeof d === "string" ? new Date(d) : d;
    return new Intl.DateTimeFormat("ro-RO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(dt);
  };
  const fmtEUR = (n: number) =>
    new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency: "EUR",
    }).format(n);
  const fmtRON = (n: number) =>
    new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency: "RON",
      maximumFractionDigits: 2,
    }).format(n);

  // Indexing helpers
  const nextIndexing = (dates?: Array<string | null | undefined>) => {
    const ds = (dates ?? [])
      .filter((d): d is string => !!d)
      .map((s) => new Date(s))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    for (const d of ds) {
      if (d >= startOfToday) return d.toISOString().slice(0, 10);
    }
    return null;
  };
  const upcomingIndexingDate = (c: Contract) => {
    const n = nextIndexing(c.indexingDates);
    return n ? new Date(n) : null;
  };

  // Helper to get YYYY-MM month key from ISO/date string
  const monthKey = (iso: string) => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  // Optional filter by next indexing within N days
  if (range === "15" || range === "60") {
    const days = range === "15" ? 15 : 60;
    const end = new Date(startOfToday);
    end.setDate(end.getDate() + days);
    if (filterBy === "indexing") {
      contracts = contracts.filter((c) => {
        const n = nextIndexing(c.indexingDates);
        if (!n) return false;
        const d = new Date(n);
        return d >= startOfToday && d <= end;
      });
    } else if (filterBy === "end") {
      contracts = contracts.filter((c) => {
        const d = new Date(c.endDate);
        return d >= startOfToday && d <= end;
      });
    }
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

  // New totals: monthly-equivalent (yearly divided by 12) and total yearly
  const monthlyEqTotals = contracts.reduce(
    (acc, c) => {
      // EUR (monthly equivalent)
      let monthlyEur = 0;
      if (c.rentType === "yearly") {
        const sumYear = (c.yearlyInvoices ?? []).reduce(
          (s, r) => s + (r.amountEUR || 0),
          0
        );
        monthlyEur = sumYear > 0 ? sumYear / 12 : 0;
      } else if (typeof c.amountEUR === "number") {
        monthlyEur = c.amountEUR;
      }
      acc.eur += monthlyEur;
      // RON before and after correction (no VAT)
      if (monthlyEur > 0 && typeof c.exchangeRateRON === "number") {
        const baseRon = monthlyEur * c.exchangeRateRON;
        const corrPct =
          typeof c.correctionPercent === "number" ? c.correctionPercent : 0;
        const corrected = baseRon * (1 + corrPct / 100);
        acc.ronBase += baseRon;
        acc.ronCorrected += corrected;
      }
      return acc;
    },
    { eur: 0, ronBase: 0, ronCorrected: 0 }
  );

  const yearlyTotals = contracts.reduce(
    (acc, c) => {
      // EUR (yearly total)
      let yearlyEur = 0;
      if (c.rentType === "yearly") {
        yearlyEur = (c.yearlyInvoices ?? []).reduce(
          (s, r) => s + (r.amountEUR || 0),
          0
        );
      } else if (typeof c.amountEUR === "number") {
        yearlyEur = c.amountEUR * 12;
      }
      acc.eur += yearlyEur;
      // RON before and after correction (no VAT)
      if (yearlyEur > 0 && typeof c.exchangeRateRON === "number") {
        const baseRon = yearlyEur * c.exchangeRateRON;
        const corrPct =
          typeof c.correctionPercent === "number" ? c.correctionPercent : 0;
        const corrected = baseRon * (1 + corrPct / 100);
        acc.ronBase += baseRon;
        acc.ronCorrected += corrected;
      }
      return acc;
    },
    { eur: 0, ronBase: 0, ronCorrected: 0 }
  );

  // Precompute Euro inflation by baseline month to avoid repeated fetches
  // Baseline = last indexing date not after today (if any) else startDate, truncated to YYYY-MM
  const uniqueFromMonths = new Set<string>();
  for (const c of contracts) {
    const idxPast = (c.indexingDates ?? [])
      .filter((d) => !!d && new Date(d) <= startOfToday)
      .sort();
    const from = idxPast.length > 0 ? idxPast[idxPast.length - 1] : c.startDate;
    uniqueFromMonths.add(monthKey(from));
  }
  const inflationByFromMonth: Record<
    string,
    { percent: number; fromMonth: string; toMonth: string }
  > = {};
  for (const fm of uniqueFromMonths) {
    try {
      const res = await getEuroInflationPercent({ from: `${fm}-01` });
      inflationByFromMonth[fm] = {
        percent: res.percent,
        fromMonth: res.fromMonth,
        toMonth: res.toMonth,
      };
    } catch {
      // ignore missing inflation for this month
    }
  }

  // Fetch BT daily EUR selling rate (cached in DB by date)
  let bt: { rate: number; date: string } | null = null;
  try {
    const res = await getDailyBtEurSell({ forceRefresh: false });
    bt = { rate: res.rate, date: res.date };
  } catch {}

  // Fetch BNR official EUR/RON rate (cached by date)
  let bnr: { rate: number; date: string } | null = null;
  try {
    const res = await getDailyEurRon({ forceRefresh: false });
    bnr = { rate: res.rate, date: res.date };
  } catch {}

  // Raiffeisen rate removed

  async function refreshBtRate() {
    "use server";
    try {
      const r = await getDailyBtEurSell({ forceRefresh: true });
      try {
        await logAction({
          action: "exchange.refresh",
          targetType: "system",
          targetId: "BT",
          meta: { rate: r.rate, date: r.date },
        });
      } catch {}
    } catch {
      // swallow errors to avoid client "unexpected response"; we still revalidate
    }
    revalidatePath("/");
  }

  async function refreshBnrRate() {
    "use server";
    try {
      const r = await getDailyEurRon({ forceRefresh: true });
      try {
        await logAction({
          action: "exchange.refresh",
          targetType: "system",
          targetId: "BNR",
          meta: { rate: r.rate, date: r.date },
        });
      } catch {}
    } catch {
      // swallow errors to avoid client "unexpected response"; we still revalidate
    }
    revalidatePath("/");
  }

  // Raiffeisen refresh removed

  async function updateAllExchangeRates() {
    "use server";
    if (!process.env.MONGODB_URI) {
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
    try {
      await logAction({
        action: "exchange.refreshAll",
        targetType: "system",
        targetId: "contracts",
        meta: { rate },
      });
    } catch {}
    revalidatePath("/");
  }

  // Per-card inflation refresh (uses baseline month from the card)
  async function refreshInflationFor(formData: FormData) {
    "use server";
    try {
      const fromMonth = String(formData.get("fromMonth") || "").trim();
      const from = fromMonth ? `${fromMonth}-01` : "2000-01-01";
      await getEuroInflationPercent({ from, forceRefresh: true });
    } catch {}
    revalidatePath("/");
  }

  // Render a contract card (shared for active/expired lists)
  const renderCard = (c: Contract) => (
    <article
      key={c.id}
      className="rounded-xl border border-foreground/15 p-6 sm:p-7 hover:border-foreground/30 transition-colors text-base font-mono bg-background/60 shadow-sm space-y-4 sm:space-y-5 overflow-hidden"
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

      {/* Rent structure summary */}
      {(() => {
        if (c.rentType === "yearly") {
          const total = (c.yearlyInvoices ?? []).reduce(
            (s, r) => s + (r.amountEUR || 0),
            0
          );
          const count = (c.yearlyInvoices ?? []).length;
          if (count === 0) return null;
          return (
            <p className="text-sm text-foreground/70">
              Chirie anuală · {count} factur{count === 1 ? "ă" : "i"} · total{" "}
              {fmtEUR(total)}
            </p>
          );
        }
        if (typeof c.monthlyInvoiceDay === "number") {
          return (
            <p className="text-sm text-foreground/70">
              Chirie lunară · facturare ziua {c.monthlyInvoiceDay}
            </p>
          );
        }
        return <p className="text-sm text-foreground/60">Chirie lunară</p>;
      })()}

      {(() => {
        const eur =
          c.rentType === "yearly"
            ? (c.yearlyInvoices ?? []).reduce(
                (s, r) => s + (r.amountEUR || 0),
                0
              )
            : typeof c.amountEUR === "number"
            ? c.amountEUR
            : undefined;
        if (typeof eur !== "number") return null;
        const eurLabel =
          c.rentType === "yearly" ? "EUR (anual)" : "EUR (lunar)";
        const hasRate = typeof c.exchangeRateRON === "number";
        const corrPct =
          typeof c.correctionPercent === "number" ? c.correctionPercent : 0;
        const tvaPct = typeof c.tvaPercent === "number" ? c.tvaPercent : 0;
        const baseRon = hasRate
          ? eur * (c.exchangeRateRON as number)
          : undefined;
        const ronAfterCorrection =
          typeof baseRon === "number"
            ? baseRon * (1 + corrPct / 100)
            : undefined;
        const ronAfterCorrectionTva =
          typeof ronAfterCorrection === "number"
            ? ronAfterCorrection * (1 + tvaPct / 100)
            : undefined;
        return (
          <>
            <div className="rounded-md bg-foreground/5 p-3 space-y-1">
              <div className="font-semibold text-base text-indigo-700 dark:text-indigo-400">
                {eurLabel}: {fmtEUR(eur)}
              </div>
              {hasRate ? (
                <div className="font-semibold text-base text-cyan-700 dark:text-cyan-400">
                  Curs: {(c.exchangeRateRON as number).toFixed(4)} RON/EUR
                </div>
              ) : null}
              {typeof baseRon === "number" ? (
                <div className="font-semibold text-base">
                  RON: {fmtRON(baseRon)}
                </div>
              ) : null}
              {typeof ronAfterCorrection === "number" ? (
                <div className="font-semibold text-base text-sky-700 dark:text-sky-400">
                  RON după corecție{corrPct ? ` (${corrPct}%)` : ""}:{" "}
                  {fmtRON(ronAfterCorrection)}
                </div>
              ) : null}
              {typeof ronAfterCorrectionTva === "number" ? (
                <div className="font-semibold text-base text-emerald-700 dark:text-emerald-400">
                  RON după corecție + TVA{tvaPct ? ` (${tvaPct}%)` : ""}:{" "}
                  {fmtRON(ronAfterCorrectionTva)}
                </div>
              ) : null}
            </div>
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
        );
      })()}

      {/* Inflation */}
      {(() => {
        const idxPast = (c.indexingDates ?? [])
          .filter((d) => !!d && new Date(d) <= startOfToday)
          .sort();
        const from =
          idxPast.length > 0 ? idxPast[idxPast.length - 1] : c.startDate;
        const inf = inflationByFromMonth[monthKey(from)];
        if (!inf) {
          return (
            <p className="mt-1 text-xs truncate text-foreground/60">
              Inflație EUR (HICP): <span className="italic">Indisponibil</span>
            </p>
          );
        }
        const signColor =
          inf.percent >= 0
            ? "text-amber-700 dark:text-amber-400"
            : "text-emerald-700 dark:text-emerald-400";
        return (
          <div className="mt-1 text-xs text-foreground/70 flex items-center gap-2 flex-wrap">
            <span>
              Inflație EUR (HICP):{" "}
              <span className={`font-medium ${signColor}`}>
                {inf.percent.toFixed(2)}%
              </span>{" "}
              <span className="text-foreground/50">
                ({inf.fromMonth} → {inf.toMonth})
              </span>
            </span>
            {(() => {
              const badge = (() => {
                if (
                  c.inflationVerified === true &&
                  c.inflationFromMonth === inf.fromMonth &&
                  c.inflationToMonth === inf.toMonth
                ) {
                  return (
                    <span className="px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                      Confirmat
                    </span>
                  );
                }
                if (
                  c.inflationVerified === false &&
                  c.inflationFromMonth === inf.fromMonth &&
                  c.inflationToMonth === inf.toMonth
                ) {
                  return (
                    <span className="px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-700 dark:text-amber-400">
                      Nealiniat
                    </span>
                  );
                }
                return null;
              })();
              return badge;
            })()}
            <span className="ml-1">
              <InflationVerify
                contractId={c.id}
                fromMonth={inf.fromMonth}
                toMonth={inf.toMonth}
              />
            </span>
            <form action={refreshInflationFor} className="ml-1 inline-block">
              <input type="hidden" name="fromMonth" value={inf.fromMonth} />
              <ActionButton
                className="rounded-md border border-foreground/20 px-2 py-1 text-[11px] font-semibold hover:bg-foreground/5"
                title="Actualizează seria de inflație EUR (HICP)"
                successMessage="Seria de inflație a fost actualizată"
              >
                Actualizează inflația
              </ActionButton>
            </form>
          </div>
        );
      })()}

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
  );

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-12">
      <div className="mx-auto max-w-screen-2xl">
        <h1 className="text-fluid-4xl font-semibold tracking-tight mb-8">
          Contracte
        </h1>
        {/* KPIs */}
        {(() => {
          const activeAll = all.filter(
            (c) => new Date(c.endDate) >= startOfToday
          );
          const within = (days: number) => {
            const end = new Date(startOfToday);
            end.setDate(end.getDate() + days);
            return activeAll.filter((c) => {
              const n = nextIndexing(c.indexingDates);
              if (!n) return false;
              const d = new Date(n);
              return d >= startOfToday && d <= end;
            }).length;
          };
          const upcoming15 = within(15);
          const upcoming60 = within(60);
          return (
            <section className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
              <div className="rounded-xl border border-foreground/10 bg-background/70 p-6">
                <div className="text-xs uppercase tracking-wide text-foreground/60">
                  Contracte
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {contracts.length}
                </div>
              </div>
              <div className="rounded-xl border border-foreground/10 bg-background/70 p-6">
                <div className="text-xs uppercase tracking-wide text-foreground/60">
                  EUR
                </div>
                <div className="mt-1 text-xl font-semibold text-indigo-700 dark:text-indigo-400">
                  {fmtEUR(totals.eur)}
                </div>
              </div>
              <div className="rounded-xl border border-foreground/10 bg-background/70 p-6">
                <div className="text-xs uppercase tracking-wide text-foreground/60">
                  RON
                </div>
                <div className="mt-1 text-xl font-semibold text-sky-700 dark:text-sky-400">
                  {fmtRON(totals.ronBase)}
                </div>
                {totals.tva > 0 && (
                  <div className="text-[11px] text-foreground/60">
                    TVA: {fmtRON(totals.tva)}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-foreground/10 bg-background/70 p-6">
                <div className="text-xs uppercase tracking-wide text-foreground/60">
                  RON cu TVA
                </div>
                <div className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-400">
                  {fmtRON(totals.ronWithTva)}
                </div>
              </div>
              <div className="rounded-xl border border-foreground/10 bg-background/70 p-6">
                <div className="text-xs uppercase tracking-wide text-foreground/60">
                  Indexări
                </div>
                <div className="mt-1 text-sm">
                  <span className="font-semibold">{upcoming15}</span> în 15 zile
                </div>
                <div className="text-sm">
                  <span className="font-semibold">{upcoming60}</span> în 60 zile
                </div>
              </div>
            </section>
          );
        })()}

        {/* Totals for contracts: monthly equivalent and yearly (EUR, RON before/after correction, no VAT) */}
        <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div className="rounded-xl border border-foreground/10 bg-background/70 p-6">
            <div className="text-xs uppercase tracking-wide text-foreground/60">
              Lunar (echivalent)
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div>
                <span className="text-foreground/60">EUR:</span>{" "}
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                  {fmtEUR(monthlyEqTotals.eur)}
                </span>
              </div>
              <div>
                <span className="text-foreground/60">RON (fără corecție):</span>{" "}
                <span className="font-semibold">
                  {fmtRON(monthlyEqTotals.ronBase)}
                </span>
              </div>
              <div>
                <span className="text-foreground/60">RON după corecție:</span>{" "}
                <span className="font-semibold text-sky-700 dark:text-sky-400">
                  {fmtRON(monthlyEqTotals.ronCorrected)}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-foreground/10 bg-background/70 p-6">
            <div className="text-xs uppercase tracking-wide text-foreground/60">
              Total anual
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div>
                <span className="text-foreground/60">EUR:</span>{" "}
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                  {fmtEUR(yearlyTotals.eur)}
                </span>
              </div>
              <div>
                <span className="text-foreground/60">RON (fără corecție):</span>{" "}
                <span className="font-semibold">
                  {fmtRON(yearlyTotals.ronBase)}
                </span>
              </div>
              <div>
                <span className="text-foreground/60">RON după corecție:</span>{" "}
                <span className="font-semibold text-sky-700 dark:text-sky-400">
                  {fmtRON(yearlyTotals.ronCorrected)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Exchange rates */}
        <section className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-5 sm:p-6 text-sm flex items-center gap-3 flex-wrap">
            <span className="text-foreground/60">Curs BT (vânzare EUR): </span>
            {bt ? (
              <span className="font-medium text-fuchsia-700 dark:text-fuchsia-400">
                {bt.rate.toFixed(4)} RON/EUR
              </span>
            ) : (
              <span className="text-foreground/60 italic">Indisponibil</span>
            )}
            <span className="text-foreground/50">
              · Data (EET/EEST): {bt ? bt.date : "—"}
            </span>
            <form action={refreshBtRate} className="inline-block ml-auto">
              <ActionButton
                className="rounded-md border border-foreground/20 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold hover:bg-foreground/5"
                title="Actualizează cursul BT (vânzare EUR)"
                successMessage="Cursul BT a fost actualizat"
              >
                Actualizează cursul BT
              </ActionButton>
            </form>
          </div>
          <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-5 sm:p-6 text-sm flex items-center gap-3 flex-wrap">
            <span className="text-foreground/60">Curs BNR (EUR/RON): </span>
            {bnr ? (
              <span className="font-medium text-blue-700 dark:text-blue-400">
                {bnr.rate.toFixed(4)} RON/EUR
              </span>
            ) : (
              <span className="text-foreground/60 italic">Indisponibil</span>
            )}
            <span className="text-foreground/50">
              · Data (EET/EEST): {bnr ? bnr.date : "—"}
            </span>
            {bnr && bt
              ? (() => {
                  const diff = ((bt.rate - bnr.rate) / bnr.rate) * 100;
                  const sign = diff >= 0 ? "+" : "";
                  const color =
                    diff >= 0
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-emerald-700 dark:text-emerald-400";
                  return (
                    <span className="text-foreground/60">
                      · Diferență BT vs BNR:{" "}
                      <span className={`font-medium ${color}`}>
                        {sign}
                        {diff.toFixed(2)}%
                      </span>
                    </span>
                  );
                })()
              : null}
            <form action={refreshBnrRate} className="inline-block ml-auto">
              <ActionButton
                className="rounded-md border border-foreground/20 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold hover:bg-foreground/5"
                title="Actualizează cursul BNR (EUR/RON)"
                successMessage="Cursul BNR a fost actualizat"
              >
                Actualizează cursul BNR
              </ActionButton>
            </form>
          </div>
        </section>

        {/* Toolbar: search + filters + bulk update */}
        <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-5">
          <div className="flex items-center gap-3 flex-1">
            <SearchContracts initialQuery={q} />
            <IndexingFilters />
          </div>
          {(q || range) && (
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-medium hover:bg-foreground/5"
            >
              Reset filtre
            </Link>
          )}
          <form action={updateAllExchangeRates} className="sm:ml-auto">
            <ActionButton
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5 disabled:opacity-60"
              title={
                !process.env.MONGODB_URI
                  ? "MongoDB nu este configurat"
                  : "Actualizează cursul pentru toate contractele"
              }
              successMessage="Cursul a fost actualizat pentru toate contractele"
            >
              Actualizează cursul (toate contractele)
            </ActionButton>
          </form>
        </div>

        {contracts.length === 0 ? (
          <div className="mt-6 rounded-xl border border-foreground/15 p-8 text-center text-foreground/60">
            Nu există contracte de afișat.
          </div>
        ) : (
          <section className="mt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-8">
            {(() => {
              const active = contracts.filter(
                (c) => new Date(c.endDate) >= now
              );
              const expired = contracts.filter(
                (c) => new Date(c.endDate) < now
              );
              return (
                <>
                  {active.map(renderCard)}
                  {expired.length > 0 && (
                    <div className="col-span-full mt-10 mb-3 text-xs uppercase tracking-wide text-foreground/50 flex items-center gap-2">
                      <span className="h-px flex-1 bg-foreground/15" />
                      Expirate
                      <span className="h-px flex-1 bg-foreground/15" />
                    </div>
                  )}
                  {expired.map(renderCard)}
                </>
              );
            })()}
          </section>
        )}
      </div>
    </main>
  );
}
