import {
  effectiveEndDate,
  fetchContracts,
  currentRentAmount,
} from "@/lib/contracts";
import type { Contract } from "@/lib/schemas/contract";
import { unstable_noStore as noStore } from "next/cache";
import SearchContracts from "@/app/components/search-contracts";
import PartnerFilter from "@/app/components/partner-filter";
import { fetchOwners } from "@/lib/owners";
import OwnerFilter from "@/app/components/owner-filter";
import { listIndexingNotices } from "@/lib/audit";
import type { IndexingNotice } from "@/lib/audit";
import Link from "next/link";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; sort?: string; partner?: string; ownerId?: string }>;
}) {
  noStore();
  const params = (await searchParams) ?? {};
  const { q = "", sort = "idx", partner: partnerId = "", ownerId = "" } = params;
  
  // Fetch owners and determine selected owner
  const owners = await fetchOwners();
  const selectedOwnerId = ownerId || owners[0]?.id || "";
  const selectedOwner = owners.find((o) => o.id === selectedOwnerId) ?? owners[0];
  
  const all = await fetchContracts();

  // Filter by owner first
  const byOwner = all.filter((c: any) => {
    const okById = c.ownerId && String(c.ownerId) === selectedOwnerId;
    const okByName = String(c.owner || "") === selectedOwner?.name;
    return okById || okByName;
  });

  // Filter by query: name, partner, asset
  const query = String(q).toLowerCase();
  const byQuery = query
    ? byOwner.filter((c) => {
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
    : byOwner;
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

  // Fetch indexing notices for all contracts
  const noticesMap = new Map<string, IndexingNotice | null>();
  if (process.env.MONGODB_URI) {
    await Promise.all(
      contracts.map(async (c) => {
        const notices = await listIndexingNotices(c.id);
        if (notices.length > 0) {
          // Get the most recent notice
          const latestNotice = notices.sort((a, b) =>
            String(b.at || "").localeCompare(String(a.at || ""))
          )[0];
          noticesMap.set(c.id, latestNotice);
        } else {
          noticesMap.set(c.id, null);
        }
      })
    );
  }

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
  const renderCard = (c: Contract) => {
    const isExpired = new Date(effectiveEndDate(c)) < now;
    const isAdvance = (c as any).invoiceMonthMode === "next" && c.rentType === "monthly";
    
    return (
      <article
        key={c.id}
        id={`contract-card-${c.id}`}
        className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-background via-background to-foreground/5 p-6 shadow-lg backdrop-blur hover:shadow-xl transition-all duration-200"
      >
        {/* Header with title and status badges */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2
            id={`contract-card-${c.id}-title`}
            className="text-xl font-bold tracking-tight flex-1 min-w-0"
          >
            <Link href={`/contracts/${c.id}`} className="hover:underline break-words">
              {c.name}
            </Link>
          </h2>
          <div className="flex flex-col gap-2 items-end shrink-0">
            {isAdvance && (
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
                În avans
              </span>
            )}
            {isExpired ? (
              <span className="inline-flex items-center rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 ring-1 ring-red-500/20">
                Expirat
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                Activ
              </span>
            )}
          </div>
        </div>

        {/* Partner and Owner */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 text-foreground/80">
            <svg className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium truncate" title={c.partner}>
              {c.partner}
            </span>
          </div>
          <div className="flex items-center gap-2 text-foreground/70">
            <svg className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm truncate" title={c.owner}>
              {c.owner ?? "Markov Services s.r.l."}
            </span>
          </div>
        </div>

        {/* Financial Info - Prominent */}
        {(() => {
          const eur =
            c.rentType === "yearly"
              ? (((c as any).irregularInvoices ?? []) as any[]).reduce(
                  (s, r) => s + (r.amountEUR || 0),
                  0
                )
              : currentRentAmount(c);
          if (typeof eur !== "number") return null;
          
          const hasRate = typeof c.exchangeRateRON === "number";
          const corrPct = typeof c.correctionPercent === "number" ? c.correctionPercent : 0;
          const tvaPct = typeof c.tvaPercent === "number" ? c.tvaPercent : 0;
          const baseRon = hasRate ? eur * (c.exchangeRateRON as number) : undefined;
          const ronAfterCorrection = typeof baseRon === "number" ? baseRon * (1 + corrPct / 100) : undefined;
          const ronAfterCorrectionTva = typeof ronAfterCorrection === "number" ? ronAfterCorrection * (1 + tvaPct / 100) : undefined;
          
          return (
            <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-4 mb-4 border border-indigo-500/20">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-wide text-foreground/60 font-semibold">
                    {c.rentType === "yearly" ? "Chirie anuală" : "Chirie lunară"}
                  </span>
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {fmtEUR(eur)}
                  </span>
                </div>
                {hasRate && (
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-foreground/60">Curs RON/EUR</span>
                    <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                      {(c.exchangeRateRON as number).toFixed(4)}
                    </span>
                  </div>
                )}
                {typeof baseRon === "number" && (
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-foreground/60">RON</span>
                    <span className="font-semibold">{fmtRON(baseRon)}</span>
                  </div>
                )}
                {corrPct !== 0 && typeof ronAfterCorrection === "number" && (
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-foreground/60">După corecție ({corrPct}%)</span>
                    <span className="font-semibold text-sky-600 dark:text-sky-400">{fmtRON(ronAfterCorrection)}</span>
                  </div>
                )}
                {tvaPct !== 0 && typeof ronAfterCorrectionTva === "number" && (
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-foreground/60">Cu TVA ({tvaPct}%)</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{fmtRON(ronAfterCorrectionTva)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Indexing Info - Next indexing date and future rent */}
        {(() => {
          const indexingDates = ((c as any).indexingDates || []) as Array<{
            forecastDate: string;
            newRentAmount?: number;
            done?: boolean;
          }>;
          const todayISO = now.toISOString().slice(0, 10);
          const nextIndexing = indexingDates
            .filter((d) => !d.done && d.forecastDate >= todayISO)
            .sort((a, b) => a.forecastDate.localeCompare(b.forecastDate))[0];
          
          // Get the most recent indexing notice for this contract
          const latestNotice = noticesMap.get(c.id);
          const newRentEUR = latestNotice?.sendHistory?.[latestNotice.sendHistory.length - 1]?.newRentEUR;
          const validFrom = latestNotice?.sendHistory?.[latestNotice.sendHistory.length - 1]?.validFrom;
          
          if (!nextIndexing && !newRentEUR) return null;
          
          const daysUntil = nextIndexing ? (() => {
            try {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const target = new Date(nextIndexing.forecastDate);
              target.setHours(0, 0, 0, 0);
              const diffMs = target.getTime() - today.getTime();
              return Math.floor(diffMs / (1000 * 60 * 60 * 24));
            } catch {
              return null;
            }
          })() : null;
          
          return (
            <div className="rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 p-4 mb-4 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-xs uppercase tracking-wide text-foreground/60 font-semibold">
                  Indexare Programată
                </span>
              </div>
              <div className="space-y-2">
                {nextIndexing && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-foreground/70">Data indexării</span>
                    <span className="text-sm font-semibold">
                      {fmt(nextIndexing.forecastDate)}
                      {daysUntil !== null && (
                        <span className={`ml-2 text-xs ${
                          daysUntil < 0 ? 'text-red-600 dark:text-red-400' :
                          daysUntil === 0 ? 'text-orange-600 dark:text-orange-400' :
                          daysUntil < 20 ? 'text-orange-600 dark:text-orange-400' :
                          'text-foreground/60'
                        }`}>
                          ({daysUntil < 0 ? `depășită cu ${Math.abs(daysUntil)} zile` :
                            daysUntil === 0 ? 'astăzi' :
                            `în ${daysUntil} zile`})
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {typeof newRentEUR === "number" && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-foreground/70">
                      {validFrom ? `Chirie din ${fmt(validFrom)}` : "Chirie viitoare"}
                    </span>
                    <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      {fmtEUR(newRentEUR)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Billing Info */}
        {c.rentType === "monthly" && typeof c.monthlyInvoiceDay === "number" ? (
          <div className="rounded-xl bg-foreground/5 p-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-foreground/60 font-semibold">Facturare</span>
              <span className="text-sm font-medium">Ziua {c.monthlyInvoiceDay}</span>
            </div>
            {typeof c.paymentDueDays === "number" && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-foreground/50">Termen plată</span>
                <span className="text-sm text-foreground/70">{c.paymentDueDays} zile</span>
              </div>
            )}
          </div>
        ) : null}

        {c.rentType === "yearly" && ((c as any).irregularInvoices?.length ?? 0) > 0 ? (
          <div className="rounded-xl bg-foreground/5 p-3 mb-4">
            <div className="text-xs uppercase tracking-wide text-foreground/60 font-semibold mb-2">
              Facturi anuale
            </div>
            <div className="space-y-1">
              {(((c as any).irregularInvoices || []) as { month: number; day: number; amountEUR: number }[])
                .map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-foreground/70">
                      {`${String(r.day).padStart(2, "0")}/${String(r.month).padStart(2, "0")}`}
                    </span>
                    <span className="font-medium">{fmtEUR(r.amountEUR)}</span>
                  </div>
                ))}
            </div>
            {typeof c.paymentDueDays === "number" && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-foreground/10">
                <span className="text-xs text-foreground/50">Termen plată</span>
                <span className="text-sm text-foreground/70">{c.paymentDueDays} zile</span>
              </div>
            )}
          </div>
        ) : null}

        {/* Dates Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-foreground/5 p-3">
            <div className="text-xs text-foreground/60 mb-1">Semnat</div>
            <div className="text-sm font-semibold">{fmt(c.signedAt)}</div>
          </div>
          <div className="rounded-lg bg-foreground/5 p-3">
            <div className="text-xs text-foreground/60 mb-1">Început</div>
            <div className="text-sm font-semibold">{fmt(c.startDate)}</div>
          </div>
          <div className={`rounded-lg p-3 ${isExpired ? 'bg-red-500/10 ring-1 ring-red-500/20' : 'bg-foreground/5'}`}>
            <div className="text-xs text-foreground/60 mb-1">Expiră</div>
            <div className={`text-sm font-semibold ${isExpired ? 'text-red-600 dark:text-red-400' : ''}`}>
              {fmt(effectiveEndDate(c))}
            </div>
          </div>
          {(() => {
            const arr = Array.isArray((c as any).contractExtensions)
              ? ((c as any).contractExtensions as Array<{ extendedUntil?: string }>)
                  .map((r) => String(r.extendedUntil || ""))
                  .filter(Boolean)
                  .sort()
              : [];
            const latest = arr.length > 0 ? arr[arr.length - 1] : undefined;
            return latest ? (
              <div className="rounded-lg bg-orange-500/10 p-3 ring-1 ring-orange-500/20">
                <div className="text-xs text-foreground/60 mb-1">Prelungit până</div>
                <div className="text-sm font-semibold text-orange-600 dark:text-orange-400">{fmt(latest)}</div>
              </div>
            ) : null;
          })()}
        </div>

        {/* Additional financial details as tags */}
        {(typeof c.correctionPercent === "number" || typeof c.tvaPercent === "number") && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-foreground/10">
            {typeof c.correctionPercent === "number" && (
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                Corecție {c.correctionPercent}%
              </span>
            )}
            {typeof c.tvaPercent === "number" && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                TVA {c.tvaPercent}%
              </span>
            )}
          </div>
        )}
      </article>
    );
  };

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
  } else if (sort === "indexing") {
    // Order by proximity to next indexing date
    const todayISO = now.toISOString().slice(0, 10);
    contracts.sort((a, b) => {
      const getNextIndexingDate = (c: Contract) => {
        const dates = ((c as any).indexingDates || []) as Array<{
          forecastDate: string;
          done?: boolean;
        }>;
        const nextDate = dates
          .filter((d) => !d.done && d.forecastDate >= todayISO)
          .map((d) => d.forecastDate)
          .sort()[0];
        return nextDate ? new Date(nextDate).getTime() : Infinity;
      };

      const aNext = getNextIndexingDate(a);
      const bNext = getNextIndexingDate(b);

      // Contracts with no future indexing go to the end
      if (aNext === Infinity && bNext === Infinity) return 0;
      if (aNext === Infinity) return 1;
      if (bNext === Infinity) return -1;

      return aNext - bNext;
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

  // Helper to build clean URLs without empty parameters
  const buildUrl = (sortParam: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sortParam !== "idx") params.set("sort", sortParam);
    if (partnerId) params.set("partner", partnerId);
    if (ownerId) params.set("ownerId", ownerId);
    const queryString = params.toString();
    return queryString ? `/contracts?${queryString}` : "/contracts";
  };

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

        {/* Owner Filter */}
        <OwnerFilter
          owners={owners}
          selectedOwnerId={selectedOwnerId}
          contractCount={contracts.length}
          basePath="/contracts"
        />

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
                href={buildUrl("idx")}
                className={`rounded-md border px-2 py-1 font-medium hover:bg-foreground/5 ${
                  sort !== "exp" && sort !== "indexing"
                    ? "border-foreground/30"
                    : "border-foreground/15 text-foreground/60"
                }`}
                id="contracts-toolbar-sort-default"
              >
                implicit
              </Link>
              <Link
                href={buildUrl("exp")}
                className={`rounded-md border px-2 py-1 font-medium hover:bg-foreground/5 ${
                  sort === "exp"
                    ? "border-foreground/30"
                    : "border-foreground/15 text-foreground/60"
                }`}
                id="contracts-toolbar-sort-expire"
              >
                după expirare
              </Link>
              <Link
                href={buildUrl("indexing")}
                className={`rounded-md border px-2 py-1 font-medium hover:bg-foreground/5 ${
                  sort === "indexing"
                    ? "border-foreground/30"
                    : "border-foreground/15 text-foreground/60"
                }`}
                id="contracts-toolbar-sort-indexing"
              >
                după indexare
              </Link>
            </div>
          </div>
          {(q || sort !== "idx" || partnerId) && (
            <Link
              id="contracts-toolbar-reset"
              href={ownerId ? `/contracts?ownerId=${ownerId}` : "/contracts"}
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
