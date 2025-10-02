import { fetchContracts } from "@/lib/contracts";
import type { Contract } from "@/lib/schemas/contract";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import InflationVerify from "@/app/components/inflation-verify";
import ActionButton from "@/app/components/action-button";
import { getEuroInflationPercent } from "@/lib/inflation";
import SearchContracts from "@/app/components/search-contracts";
import Link from "next/link";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; sort?: string }>;
}) {
  noStore();
  const params = (await searchParams) ?? {};
  const { q = "", sort = "idx" } = params;
  const all = await fetchContracts();

  // Filter by query: name, partner, asset
  const query = String(q).toLowerCase();
  const contracts = query
    ? all.filter((c) => {
        const name = (c.name || "").toLowerCase();
        const partner = (c.partner || "").toLowerCase();
        const asset = (c.asset || "").toLowerCase();
        return (
          name.includes(query) ||
          partner.includes(query) ||
          asset.includes(query)
        );
      })
    : all;

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

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

  const monthKey = (iso: string) => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  // Precompute Euro inflation by baseline month (same as on home)
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
    { percent: number; fromMonth: string; toMonth: string } | undefined
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
      // ignore
    }
  }

  async function refreshInflationFor(formData: FormData) {
    "use server";
    try {
      const fromMonth = String(formData.get("fromMonth") || "").trim();
      const from = fromMonth ? `${fromMonth}-01` : "2000-01-01";
      await getEuroInflationPercent({ from, forceRefresh: true });
    } catch {}
    revalidatePath("/contracts");
  }

  // Bulk: update exchange rate for all contracts (same behavior as on home)
  async function updateAllExchangeRates() {
    "use server";
    if (!process.env.MONGODB_URI) {
      return;
    }
    const { rate } = await (
      await import("@/lib/exchange")
    ).getDailyEurRon({ forceRefresh: true });
    const db = await (await import("@/lib/mongodb")).getDb();
    await db
      .collection("contracts")
      .updateMany(
        { amountEUR: { $exists: true } },
        { $set: { exchangeRateRON: rate } }
      );
    try {
      const { logAction } = await import("@/lib/audit");
      await logAction({
        action: "exchange.refreshAll",
        targetType: "system",
        targetId: "contracts",
        meta: { rate },
      });
    } catch {}
    revalidatePath("/contracts");
  }

  // Keep the exact same card UI as on the home page
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

  // Sorting
  if (sort === "exp") {
    // Order by closest expiring date (actives first by endDate asc, then expired by endDate asc)
    contracts.sort((a, b) => {
      const expiredA = new Date(a.endDate) < now;
      const expiredB = new Date(b.endDate) < now;
      if (expiredA !== expiredB) return expiredA ? 1 : -1;
      const ad = new Date(a.endDate).getTime();
      const bd = new Date(b.endDate).getTime();
      return ad - bd;
    });
  } else {
    // Default: order by closest upcoming indexing date (like home)
    contracts.sort((a, b) => {
      const expiredA = new Date(a.endDate) < now;
      const expiredB = new Date(b.endDate) < now;
      if (expiredA !== expiredB) return expiredA ? 1 : -1; // push expired to end
      const ai = (() => {
        const n = nextIndexing(a.indexingDates);
        return n ? new Date(n) : null;
      })();
      const bi = (() => {
        const n = nextIndexing(b.indexingDates);
        return n ? new Date(n) : null;
      })();
      if (ai && bi) return ai.getTime() - bi.getTime();
      if (ai && !bi) return -1;
      if (!ai && bi) return 1;
      const ad = new Date(a.endDate).getTime();
      const bd = new Date(b.endDate).getTime();
      return ad - bd;
    });
  }

  const active = contracts.filter((c) => new Date(c.endDate) >= now);
  const expired = contracts.filter((c) => new Date(c.endDate) < now);

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-12">
      <div className="mx-auto max-w-screen-2xl">
        <h1 className="text-fluid-4xl font-semibold tracking-tight mb-8">
          Contracte
        </h1>
        {/* Toolbar: search + sort */}
        <div className="mt-2 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-5">
          <div className="flex items-center gap-3 flex-1">
            <SearchContracts
              initialQuery={q}
              placeholder="Caută (nume, partener, asset)"
            />
            <div className="inline-flex items-center gap-2 text-xs text-foreground/60">
              <span>Ordonează:</span>
              <Link
                href={`/contracts?${new URLSearchParams({
                  q,
                  sort: "idx",
                }).toString()}`}
                className={`rounded-md border px-2 py-1 font-medium hover:bg-foreground/5 ${
                  sort !== "exp"
                    ? "border-foreground/30"
                    : "border-foreground/15 text-foreground/60"
                }`}
              >
                după indexare
              </Link>
              <Link
                href={`/contracts?${new URLSearchParams({
                  q,
                  sort: "exp",
                }).toString()}`}
                className={`rounded-md border px-2 py-1 font-medium hover:bg-foreground/5 ${
                  sort === "exp"
                    ? "border-foreground/30"
                    : "border-foreground/15 text-foreground/60"
                }`}
              >
                după expirare
              </Link>
            </div>
          </div>
          {(q || sort !== "idx") && (
            <Link
              href="/contracts"
              className="inline-flex items-center justify-center rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-medium hover:bg-foreground/5"
            >
              Reset filtre
            </Link>
          )}
        </div>

        {/* Toolbar: bulk rate update */}
        <div className="mt-4">
          <form action={updateAllExchangeRates}>
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
          <section className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-8">
            {active.map(renderCard)}
            {expired.length > 0 && (
              <div className="col-span-full mt-10 mb-3 text-xs uppercase tracking-wide text-foreground/50 flex items-center gap-2">
                <span className="h-px flex-1 bg-foreground/15" />
                Expirate
                <span className="h-px flex-1 bg-foreground/15" />
              </div>
            )}
            {expired.map(renderCard)}
          </section>
        )}
      </div>
    </main>
  );
}
