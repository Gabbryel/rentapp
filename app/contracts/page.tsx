import { effectiveEndDate, fetchContracts } from "@/lib/contracts";
import type { Contract } from "@/lib/schemas/contract";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import ActionButton from "@/app/components/action-button";
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

  // indexing removed

  // inflation & indexing removed

  // refreshInflationFor removed

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
      className="rounded-xl border border-foreground/15 p-4 sm:p-5 hover:border-foreground/30 transition-colors text-base bg-background/60 shadow-sm space-y-3 sm:space-y-4 overflow-hidden"
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
          {(c as any).invoiceMonthMode === "next" &&
          c.rentType === "monthly" ? (
            <span className="shrink-0 text-[10px] sm:text-xs uppercase tracking-wide rounded-full px-2 py-1 ring-1 ring-blue-500/20 text-blue-600 dark:text-blue-400">
              În avans
            </span>
          ) : null}
          {new Date(effectiveEndDate(c)) < now ? (
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
        className="text-base text-foreground/80 truncate break-words leading-tight"
        title={c.partner}
      >
        Partener: {c.partner}
      </p>
      <p
        className="text-base text-foreground/70 truncate break-words leading-tight"
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
            <p className="text-sm text-foreground/70 leading-tight">
              Chirie anuală · {count} factur{count === 1 ? "ă" : "i"} · total{" "}
              {fmtEUR(total)}
            </p>
          );
        }
        if (typeof c.monthlyInvoiceDay === "number") {
          return (
            <p className="text-sm text-foreground/70 leading-tight">
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
            <div className="rounded-md bg-foreground/5 p-2 space-y-0.5">
              <div className="font-semibold text-base leading-tight text-indigo-700 dark:text-indigo-400">
                {eurLabel}: {fmtEUR(eur)}
              </div>
              {hasRate ? (
                <div className="font-semibold text-base leading-tight text-cyan-700 dark:text-cyan-400">
                  Curs: {(c.exchangeRateRON as number).toFixed(4)} RON/EUR
                </div>
              ) : null}
              {typeof baseRon === "number" ? (
                <div className="font-semibold text-base leading-tight">
                  RON: {fmtRON(baseRon)}
                </div>
              ) : null}
              {typeof ronAfterCorrection === "number" ? (
                <div className="font-semibold text-base leading-tight text-sky-700 dark:text-sky-400">
                  RON după corecție{corrPct ? ` (${corrPct}%)` : ""}:{" "}
                  {fmtRON(ronAfterCorrection)}
                </div>
              ) : null}
              {typeof ronAfterCorrectionTva === "number" ? (
                <div className="font-semibold text-base leading-tight text-emerald-700 dark:text-emerald-400">
                  RON după corecție + TVA{tvaPct ? ` (${tvaPct}%)` : ""}:{" "}
                  {fmtRON(ronAfterCorrectionTva)}
                </div>
              ) : null}
            </div>
            {(() => {
              return null; // indexing removed
            })()}
          </>
        );
      })()}

      {/* Inflation section removed */}

      <dl className="grid grid-cols-1 gap-2">
        <div className="rounded-md bg-foreground/5 p-2">
          <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
            <dt className="text-xs text-foreground/60 shrink-0">Semnat</dt>
            <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
              {fmt(c.signedAt)}
            </dd>
          </div>
        </div>
        <div className="rounded-md bg-foreground/5 p-2">
          <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
            <dt className="text-xs text-foreground/60 shrink-0">Început</dt>
            <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
              {fmt(c.startDate)}
            </dd>
          </div>
        </div>
        <div className="rounded-md bg-foreground/5 p-2">
          <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
            <dt className="text-xs text-foreground/60 shrink-0">Expiră</dt>
            <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
              {fmt(effectiveEndDate(c))}
            </dd>
          </div>
        </div>
        {c.extensionDate ? (
          <div className="rounded-md bg-foreground/5 p-2">
            <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
              <dt className="text-xs text-foreground/60 shrink-0">
                Prelungire până la
              </dt>
              <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
                {fmt(String(c.extensionDate))}
              </dd>
            </div>
          </div>
        ) : null}
        {(c as any).extendedAt ? (
          <div className="rounded-md bg-foreground/5 p-2">
            <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
              <dt className="text-xs text-foreground/60 shrink-0">
                Extins la data
              </dt>
              <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
                {fmt(String((c as any).extendedAt))}
              </dd>
            </div>
          </div>
        ) : null}
        {typeof c.paymentDueDays === "number" ? (
          <div className="rounded-md bg-foreground/5 p-2">
            <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
              <dt className="text-xs text-foreground/60 shrink-0">
                Termen plată
              </dt>
              <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
                {c.paymentDueDays} zile
              </dd>
            </div>
          </div>
        ) : null}
        {c.rentType === "monthly" && typeof c.monthlyInvoiceDay === "number" ? (
          <div className="rounded-md bg-foreground/5 p-2">
            <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
              <dt className="text-xs text-foreground/60 shrink-0">Facturare</dt>
              <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
                Lunar, ziua {c.monthlyInvoiceDay}
              </dd>
            </div>
          </div>
        ) : null}
        {c.rentType === "yearly" && (c.yearlyInvoices?.length ?? 0) > 0 ? (
          <div className="rounded-md bg-foreground/5 p-2">
            <dt className="text-xs text-foreground/60">Facturi anuale</dt>
            <dd className="font-medium text-sm mt-0.5">
              <ul className="space-y-0.5">
                {(c.yearlyInvoices || []).map((r, i) => (
                  <li key={i}>
                    {`${String(r.day).padStart(2, "0")}/${String(
                      r.month
                    ).padStart(2, "0")} – ${fmtEUR(r.amountEUR)}`}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {typeof c.amountEUR === "number" ||
        typeof c.exchangeRateRON === "number" ? (
          <div className="rounded-md bg-foreground/5 p-2">
            <dt className="text-xs text-foreground/60">Financiar</dt>
            <dd className="font-medium text-sm mt-0.5 space-y-0.5">
              {typeof c.amountEUR === "number" ? (
                <div className="text-indigo-700 dark:text-indigo-400 leading-tight">
                  EUR: {fmtEUR(c.amountEUR)}
                </div>
              ) : null}
              {typeof c.exchangeRateRON === "number" ? (
                <div className="text-cyan-700 dark:text-cyan-400 leading-tight">
                  Curs: {c.exchangeRateRON.toFixed(4)} RON/EUR
                </div>
              ) : null}
              {typeof c.correctionPercent === "number" ? (
                <div className="text-amber-700 dark:text-amber-400 leading-tight">
                  Corecție: {c.correctionPercent}%
                </div>
              ) : null}
              {typeof c.tvaPercent === "number" ? (
                <div className="text-emerald-700 dark:text-emerald-400 leading-tight">
                  TVA: {c.tvaPercent}%
                </div>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );

  // Sorting
  if (sort === "exp") {
    // Order by closest expiring date (actives first by endDate asc, then expired by endDate asc)
    contracts.sort((a, b) => {
      const expiredA = new Date(effectiveEndDate(a)) < now;
      const expiredB = new Date(effectiveEndDate(b)) < now;
      if (expiredA !== expiredB) return expiredA ? 1 : -1;
      const ad = new Date(effectiveEndDate(a)).getTime();
      const bd = new Date(effectiveEndDate(b)).getTime();
      return ad - bd;
    });
  } else {
    // Default: order by effective end date (indexing removed)
    contracts.sort((a, b) => {
      const expiredA = new Date(effectiveEndDate(a)) < now;
      const expiredB = new Date(effectiveEndDate(b)) < now;
      if (expiredA !== expiredB) return expiredA ? 1 : -1;
      const ad = new Date(effectiveEndDate(a)).getTime();
      const bd = new Date(effectiveEndDate(b)).getTime();
      return ad - bd;
    });
  }

  const active = contracts.filter((c) => new Date(effectiveEndDate(c)) >= now);
  const expired = contracts.filter((c) => new Date(effectiveEndDate(c)) < now);

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
