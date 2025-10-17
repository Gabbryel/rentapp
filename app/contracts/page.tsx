import { effectiveEndDate, fetchContracts, currentRentAmount } from "@/lib/contracts";
import type { Contract } from "@/lib/schemas/contract";
import { unstable_noStore as noStore } from "next/cache";
import SearchContracts from "@/app/components/search-contracts";
import PartnerFilter from "@/app/components/partner-filter";
import Link from "next/link";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; sort?: string; partner?: string }>;
}) {
  noStore();
  const params = (await searchParams) ?? {};
  const { q = "", sort = "idx", partner: partnerId = "" } = params;
  const all = await fetchContracts();

  // Filter by query: name, partner, asset
  const query = String(q).toLowerCase();
  const byQuery = query
    ? all.filter((c) => {
        const name = (c.name || "").toLowerCase();
        const legacyPartner = (c.partner || "").toLowerCase();
        const partnersArr = ((c as any).partners || []) as Array<{
          name?: string;
        }>;
        const partnerNames = [
          legacyPartner,
          ...partnersArr.map((p) => (p.name || "").toLowerCase()),
        ];
        const asset = (c.asset || "").toLowerCase();
        return (
          name.includes(query) ||
          partnerNames.some((p) => p.includes(query)) ||
          asset.includes(query)
        );
      })
    : all;
  // Filter by partner selection: match by partnerId or within partners[]; fallback to legacy name match if no ids
  const contracts = partnerId
    ? byQuery.filter((c) => {
        if ((c as any).partners && Array.isArray((c as any).partners)) {
          const ps = (c as any).partners as Array<{
            id?: string;
            name: string;
          }>;
          if (ps.some((p) => p.id && p.id === partnerId)) return true;
          // Fallback: if none have id, try exact-name match against primary legacy partner if available
          if (!ps.some((p) => p.id)) {
            return ps.some((p) => p.name && p.name === c.partner);
          }
          return false;
        }
        // Legacy single partner
        return c.partnerId ? c.partnerId === partnerId : false;
      })
    : byQuery;

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

  // Removed manual bulk exchange rate update; contracts now rely on exchange_rates persisted values.

  // Keep the exact same card UI as on the home page
  const renderCard = (c: Contract) => (
    <article
      key={c.id}
      id={`contract-card-${c.id}`}
      className="rounded-xl border border-foreground/15 p-4 sm:p-5 hover:border-foreground/30 transition-colors text-base bg-background/60 shadow-sm space-y-3 sm:space-y-4 overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <h2
          id={`contract-card-${c.id}-title`}
          className="text-base font-semibold truncate tracking-tight flex-1 min-w-0"
          title={c.name}
        >
          <Link href={`/contracts/${c.id}`} className="hover:underline">
            {c.name}
          </Link>
        </h2>
        <div
          className="flex items-center gap-2 flex-wrap justify-end shrink-0"
          id={`contract-card-${c.id}-status`}
        >
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
        id={`contract-card-${c.id}-partner`}
        className="text-base text-foreground/80 truncate break-words leading-tight"
        title={c.partner}
      >
        Partener: {c.partner}
      </p>
      <p
        id={`contract-card-${c.id}-owner`}
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
            <p
              id={`contract-card-${c.id}-yearly`}
              className="text-sm text-foreground/70 leading-tight"
            >
              Chirie anuală · {count} factur{count === 1 ? "ă" : "i"} · total{" "}
              {fmtEUR(total)}
            </p>
          );
        }
        if (typeof c.monthlyInvoiceDay === "number") {
          return (
            <p
              id={`contract-card-${c.id}-monthly`}
              className="text-sm text-foreground/70 leading-tight"
            >
              Chirie lunară · facturare ziua {c.monthlyInvoiceDay}
            </p>
          );
        }
        return (
          <p
            id={`contract-card-${c.id}-monthly-generic`}
            className="text-sm text-foreground/60"
          >
            Chirie lunară
          </p>
        );
      })()}

      {(() => {
        const eur =
          c.rentType === "yearly"
            ? (c.yearlyInvoices ?? []).reduce((s, r) => s + (r.amountEUR || 0), 0)
            : currentRentAmount(c);
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
            <div
              id={`contract-card-${c.id}-finance`}
              className="rounded-md bg-foreground/5 p-2 space-y-0.5"
            >
              <div
                id={`contract-card-${c.id}-finance-eur`}
                className="font-semibold text-base leading-tight text-indigo-700 dark:text-indigo-400"
              >
                {eurLabel}: {fmtEUR(eur)}
              </div>
              {hasRate ? (
                <div
                  id={`contract-card-${c.id}-finance-rate`}
                  className="font-semibold text-base leading-tight text-cyan-700 dark:text-cyan-400"
                >
                  Curs: {(c.exchangeRateRON as number).toFixed(4)} RON/EUR
                </div>
              ) : null}
              {typeof baseRon === "number" ? (
                <div
                  id={`contract-card-${c.id}-finance-ron`}
                  className="font-semibold text-base leading-tight"
                >
                  RON: {fmtRON(baseRon)}
                </div>
              ) : null}
              {typeof ronAfterCorrection === "number" ? (
                <div
                  id={`contract-card-${c.id}-finance-ron-corr`}
                  className="font-semibold text-base leading-tight text-sky-700 dark:text-sky-400"
                >
                  RON după corecție{corrPct ? ` (${corrPct}%)` : ""}:{" "}
                  {fmtRON(ronAfterCorrection)}
                </div>
              ) : null}
              {typeof ronAfterCorrectionTva === "number" ? (
                <div
                  id={`contract-card-${c.id}-finance-ron-corr-tva`}
                  className="font-semibold text-base leading-tight text-emerald-700 dark:text-emerald-400"
                >
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

      <dl id={`contract-card-${c.id}-dates`} className="grid grid-cols-1 gap-2">
        <div
          id={`contract-card-${c.id}-date-signed`}
          className="rounded-md bg-foreground/5 p-2"
        >
          <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
            <dt className="text-xs text-foreground/60 shrink-0">Semnat</dt>
            <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
              {fmt(c.signedAt)}
            </dd>
          </div>
        </div>
        <div
          id={`contract-card-${c.id}-date-start`}
          className="rounded-md bg-foreground/5 p-2"
        >
          <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
            <dt className="text-xs text-foreground/60 shrink-0">Început</dt>
            <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
              {fmt(c.startDate)}
            </dd>
          </div>
        </div>
        <div
          id={`contract-card-${c.id}-date-expire`}
          className="rounded-md bg-foreground/5 p-2"
        >
          <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
            <dt className="text-xs text-foreground/60 shrink-0">Expiră</dt>
            <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
              {fmt(effectiveEndDate(c))}
            </dd>
          </div>
        </div>
        {(() => {
          const arr = Array.isArray((c as any).contractExtensions)
            ? (
                (c as any).contractExtensions as Array<{
                  extendedUntil?: string;
                }>
              )
                .map((r) => String(r.extendedUntil || ""))
                .filter(Boolean)
                .sort()
            : [];
          const latest = arr.length > 0 ? arr[arr.length - 1] : undefined;
          return latest ? (
            <div
              id={`contract-card-${c.id}-date-extension`}
              className="rounded-md bg-foreground/5 p-2"
            >
              <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
                <dt className="text-xs text-foreground/60 shrink-0">
                  Prelungire până la
                </dt>
                <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
                  {fmt(latest)}
                </dd>
              </div>
            </div>
          ) : null;
        })()}
        {/* Termen plată moved into the Facturare block below */}
        {c.rentType === "monthly" && typeof c.monthlyInvoiceDay === "number" ? (
          <div
            id={`contract-card-${c.id}-billing`}
            className="rounded-md bg-foreground/5 p-2"
          >
            <div className="flex items-baseline justify-between gap-3 min-w-0 w-full">
              <dt className="text-xs text-foreground/60 shrink-0">Facturare</dt>
              <dd className="font-medium text-base leading-tight truncate flex-1 text-right">
                <div className="leading-tight">
                  Lunar, ziua {c.monthlyInvoiceDay}
                </div>
                {typeof c.paymentDueDays === "number" ? (
                  <div className="text-sm text-foreground/70 mt-0.5">
                    Termen plată: {c.paymentDueDays} zile
                  </div>
                ) : null}
              </dd>
            </div>
          </div>
        ) : null}
        {c.rentType === "yearly" && (c.yearlyInvoices?.length ?? 0) > 0 ? (
          <div
            id={`contract-card-${c.id}-yearly-invoices`}
            className="rounded-md bg-foreground/5 p-2"
          >
            <dt className="text-xs text-foreground/60">Facturi anuale</dt>
            <dd className="font-medium text-sm mt-0.5">
              <ul
                id={`contract-card-${c.id}-yearly-invoices-list`}
                className="space-y-0.5"
              >
                {(c.yearlyInvoices || []).map((r, i) => (
                  <li id={`contract-card-${c.id}-yearly-invoice-${i}`} key={i}>
                    {`${String(r.day).padStart(2, "0")}/${String(
                      r.month
                    ).padStart(2, "0")} – ${fmtEUR(r.amountEUR)}`}
                  </li>
                ))}
              </ul>
              {typeof c.paymentDueDays === "number" ? (
                <div className="text-sm text-foreground/70 mt-2">
                  Termen plată: {c.paymentDueDays} zile
                </div>
              ) : null}
            </dd>
          </div>
        ) : null}
        {typeof currentRentAmount(c) === "number" || typeof c.exchangeRateRON === "number" ? (
          <div
            id={`contract-card-${c.id}-finance-compact`}
            className="rounded-md bg-foreground/5 p-2"
          >
            <dt className="text-xs text-foreground/60">Financiar</dt>
            <dd className="font-medium text-sm mt-0.5 space-y-0.5">
              {typeof currentRentAmount(c) === "number" ? (
                <div
                  id={`contract-card-${c.id}-finance-compact-eur`}
                  className="text-indigo-700 dark:text-indigo-400 leading-tight"
                >
                  EUR: {fmtEUR(currentRentAmount(c) as number)}
                </div>
              ) : null}
              {typeof c.exchangeRateRON === "number" ? (
                <div
                  id={`contract-card-${c.id}-finance-compact-rate`}
                  className="text-cyan-700 dark:text-cyan-400 leading-tight"
                >
                  Curs: {c.exchangeRateRON.toFixed(4)} RON/EUR
                </div>
              ) : null}
              {typeof c.correctionPercent === "number" ? (
                <div
                  id={`contract-card-${c.id}-finance-compact-corr`}
                  className="text-amber-700 dark:text-amber-400 leading-tight"
                >
                  Corecție: {c.correctionPercent}%
                </div>
              ) : null}
              {typeof c.tvaPercent === "number" ? (
                <div
                  id={`contract-card-${c.id}-finance-compact-tva`}
                  className="text-emerald-700 dark:text-emerald-400 leading-tight"
                >
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
    <main
      id="contracts-page"
      className="min-h-screen px-4 sm:px-6 lg:px-8 py-12"
    >
      <div className="mx-auto max-w-screen-2xl">
        <h1
          id="contracts-title"
          className="text-fluid-4xl font-semibold tracking-tight mb-8"
        >
          Contracte
        </h1>
        {/* Toolbar: search + partner + sort */}
        <div
          id="contracts-toolbar"
          className="mt-2 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-5"
        >
          <div
            id="contracts-toolbar-left"
            className="flex items-center gap-3 flex-1"
          >
            <SearchContracts
              initialQuery={q}
              placeholder="Caută (nume, partener, asset)"
            />
            <PartnerFilter />
            <div
              id="contracts-toolbar-sort"
              className="inline-flex items-center gap-2 text-xs text-foreground/60"
            >
              <span>Ordonează:</span>
              <Link
                href={`/contracts?${new URLSearchParams({
                  q,
                  sort: "idx",
                  partner: partnerId,
                }).toString()}`}
                className={`rounded-md border px-2 py-1 font-medium hover:bg-foreground/5 ${
                  sort !== "exp"
                    ? "border-foreground/30"
                    : "border-foreground/15 text-foreground/60"
                }`}
                id="contracts-toolbar-sort-default"
              >
                implicit
              </Link>
              <Link
                href={`/contracts?${new URLSearchParams({
                  q,
                  sort: "exp",
                  partner: partnerId,
                }).toString()}`}
                className={`rounded-md border px-2 py-1 font-medium hover:bg-foreground/5 ${
                  sort === "exp"
                    ? "border-foreground/30"
                    : "border-foreground/15 text-foreground/60"
                }`}
                id="contracts-toolbar-sort-expire"
              >
                după expirare
              </Link>
            </div>
          </div>
          {(q || sort !== "idx" || partnerId) && (
            <Link
              id="contracts-toolbar-reset"
              href="/contracts"
              className="inline-flex items-center justify-center rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-medium hover:bg-foreground/5"
            >
              Reset filtre
            </Link>
          )}
        </div>

        {contracts.length === 0 ? (
          <div
            id="contracts-empty"
            className="mt-6 rounded-xl border border-foreground/15 p-8 text-center text-foreground/60"
          >
            Nu există contracte de afișat.
          </div>
        ) : (
          <section
            id="contracts-grid"
            className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-8"
          >
            {active.map(renderCard)}
            {expired.length > 0 && (
              <div
                id="contracts-expired-separator"
                className="col-span-full mt-10 mb-3 text-xs uppercase tracking-wide text-foreground/50 flex items-center gap-2"
              >
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
