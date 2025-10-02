import { fetchContracts } from "@/lib/contracts";
import type { Contract } from "@/lib/schemas/contract";
// import DeleteButton from "@/app/components/delete-button";
// import { redirect } from "next/navigation";
import { getDailyEurRon } from "@/lib/exchange";
import { getDailyBtEurSell } from "@/lib/exchange-bt";
import ActionButton from "@/app/components/action-button";
import { getEuroInflationPercent } from "@/lib/inflation";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import InflationVerify from "@/app/components/inflation-verify";
import { logAction } from "@/lib/audit";
import {
  computeInvoiceFromContract,
  findInvoiceByContractAndDate,
  issueInvoiceAndGeneratePdf,
  listInvoicesForMonth,
} from "@/lib/invoices";

export default async function Home() {
  // Ensure this page is always rendered dynamically and not cached
  noStore();
  const all = await fetchContracts();
  const contracts: Contract[] = all;

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

  // Current month window
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const thisMonthStart = `${y}-${m}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = `${String(nextYear).padStart(4, "0")}-${String(
    nextMonth
  ).padStart(2, "0")}-01`;

  // Preload invoices already issued this month for duplicate prevention
  const issuedThisMonth = await listInvoicesForMonth(year, month);
  const issuedByContractAndDate = new Set(
    issuedThisMonth.map((inv) => `${inv.contractId}|${inv.issuedAt}`)
  );

  // Removed filtering by URL on home page

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
  let bt: { rate: number; date: string; source: "db" | "bt" | "cache" } | null =
    null;
  try {
    const res = await getDailyBtEurSell({ forceRefresh: false });
    bt = { rate: res.rate, date: res.date, source: res.source };
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

  // Contract cards removed

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-12">
      <div className="mx-auto max-w-screen-2xl">
        <h1 className="text-fluid-4xl font-semibold tracking-tight mb-8">
          Contracte
        </h1>
        {/* Invoices due this month */}
        {(() => {
          // Compute due list for this month
          type DueItem = {
            contract: Contract;
            issuedAt: string; // YYYY-MM-DD
            amountEUR?: number; // for yearly entries, if any
          };
          const due: DueItem[] = [];
          for (const c of contracts) {
            const start = new Date(c.startDate);
            const end = new Date(c.endDate);
            const monthStart = new Date(thisMonthStart);
            const monthEndExclusive = new Date(nextMonthStart);
            // Skip contracts outside this month entirely
            if (end < monthStart || start >= monthEndExclusive) continue;

            if (c.rentType === "monthly") {
              const day = c.monthlyInvoiceDay ?? 1;
              const lastDay = new Date(year, month, 0).getDate();
              const realDay = Math.min(Math.max(1, day), lastDay);
              const issuedAt = `${y}-${m}-${String(realDay).padStart(2, "0")}`;
              const issuedDate = new Date(issuedAt);
              // Ensure issued date within contract bounds
              if (issuedDate >= start && issuedDate <= end) {
                due.push({ contract: c, issuedAt });
              }
            } else if (c.rentType === "yearly") {
              const items = c.yearlyInvoices ?? [];
              for (const yi of items) {
                if (yi.month === month) {
                  const lastDay = new Date(year, month, 0).getDate();
                  const realDay = Math.min(Math.max(1, yi.day), lastDay);
                  const issuedAt = `${y}-${m}-${String(realDay).padStart(
                    2,
                    "0"
                  )}`;
                  const issuedDate = new Date(issuedAt);
                  if (issuedDate >= start && issuedDate <= end) {
                    due.push({
                      contract: c,
                      issuedAt,
                      amountEUR: yi.amountEUR,
                    });
                  }
                }
              }
            }
          }

          if (due.length === 0) return null;

          async function issueDue(formData: FormData) {
            "use server";
            const cid = String(formData.get("contractId") || "");
            const issuedAt = String(formData.get("issuedAt") || "");
            const amountStr = String(formData.get("amountEUR") || "").trim();
            const amountOverride = amountStr ? Number(amountStr) : undefined;
            if (!cid || !issuedAt) return;
            try {
              // One-time issuance guard
              const existing = await findInvoiceByContractAndDate(
                cid,
                issuedAt
              );
              if (existing) return;
              const contract = contracts.find((c) => c.id === cid);
              if (!contract) return;
              if (
                typeof (amountOverride ?? contract.amountEUR) !== "number" ||
                typeof contract.exchangeRateRON !== "number"
              )
                return;
              const inv = computeInvoiceFromContract({
                contract,
                issuedAt,
                amountEUROverride: amountOverride,
              });
              await issueInvoiceAndGeneratePdf(inv);
            } catch {}
            revalidatePath("/");
          }

          return (
            <section className="mb-8 rounded-xl border border-foreground/10 bg-background/70 p-5">
              <h2 className="text-lg font-semibold mb-3">
                Facturi de emis luna aceasta
              </h2>
              <ul className="divide-y divide-foreground/10">
                {due
                  .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))
                  .map((d) => {
                    const key = `${d.contract.id}|${d.issuedAt}`;
                    const already = issuedByContractAndDate.has(key);
                    // Compute display amounts
                    const amtEUR =
                      typeof d.amountEUR === "number"
                        ? d.amountEUR
                        : typeof d.contract.amountEUR === "number"
                        ? d.contract.amountEUR
                        : undefined;
                    const rate =
                      typeof d.contract.exchangeRateRON === "number"
                        ? d.contract.exchangeRateRON
                        : undefined;
                    const corrPct =
                      typeof d.contract.correctionPercent === "number"
                        ? d.contract.correctionPercent
                        : 0;
                    const tvaPct =
                      typeof d.contract.tvaPercent === "number"
                        ? d.contract.tvaPercent
                        : 0;
                    const correctedEUR =
                      typeof amtEUR === "number"
                        ? amtEUR * (1 + corrPct / 100)
                        : undefined;
                    const netRON =
                      typeof correctedEUR === "number" &&
                      typeof rate === "number"
                        ? correctedEUR * rate
                        : undefined;
                    const vatRON =
                      typeof netRON === "number"
                        ? netRON * (tvaPct / 100)
                        : undefined;
                    const totalRON =
                      typeof netRON === "number"
                        ? netRON + (vatRON ?? 0)
                        : undefined;

                    return (
                      <li
                        key={key}
                        className="py-3 flex items-center gap-3 flex-wrap"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">
                            {d.contract.name}
                          </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-[#E9E294] text-lg">
                                {d.contract.partner}
                              </span>
                              <span className="text-foreground/60">
                                · Data: {fmt(d.issuedAt)}
                              </span>
                            </div>
                            <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[1rem]">
                            <div>
                              <span className="text-foreground/60">EUR:</span>{" "}
                              <span className="font-medium text-indigo-700 dark:text-indigo-400">
                                {typeof amtEUR === "number"
                                  ? fmtEUR(amtEUR)
                                  : "Indisponibil"}
                              </span>
                            </div>
                            <div>
                              <span className="text-foreground/60">Curs:</span>{" "}
                              <span className="font-medium text-cyan-700 dark:text-cyan-400">
                                {typeof rate === "number"
                                  ? `${rate.toFixed(4)} RON/EUR`
                                  : "Indisponibil"}
                              </span>
                            </div>
                            <div>
                              <span className="text-foreground/60">
                                EUR după corecție
                              </span>{" "}
                              {corrPct ? (
                                <span className="text-foreground/60">
                                  ({corrPct}%)
                                </span>
                              ) : null}
                              :{" "}
                              <span className="font-medium text-indigo-700 dark:text-indigo-400">
                                {typeof correctedEUR === "number"
                                  ? fmtEUR(correctedEUR)
                                  : "Indisponibil"}
                              </span>
                            </div>
                            <div>
                              <span className="text-foreground/60">
                                RON după corecție:
                              </span>{" "}
                              <span className="font-medium text-sky-700 dark:text-sky-400">
                                {typeof netRON === "number"
                                  ? fmtRON(netRON)
                                  : "Indisponibil"}
                              </span>
                            </div>
                            <div>
                              <span className="text-foreground/60">
                                TVA{tvaPct ? ` (${tvaPct}%)` : ""}:
                              </span>{" "}
                              <span className="font-medium text-rose-700 dark:text-rose-400">
                                {typeof vatRON === "number"
                                  ? fmtRON(vatRON)
                                  : "Indisponibil"}
                              </span>
                            </div>
                            <div>
                              <span className="text-foreground/60">
                                Total RON:
                              </span>{" "}
                              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                {typeof totalRON === "number"
                                  ? fmtRON(totalRON)
                                  : "Indisponibil"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <form
                          action={issueDue}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="contractId"
                            value={d.contract.id}
                          />
                          <input
                            type="hidden"
                            name="issuedAt"
                            value={d.issuedAt}
                          />
                          {typeof d.amountEUR === "number" ? (
                            <input
                              type="hidden"
                              name="amountEUR"
                              value={String(d.amountEUR)}
                            />
                          ) : null}
                          <ActionButton
                              className={`rounded-md border px-2.5 py-1.5 text-base font-semibold ${
                              already
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 cursor-not-allowed"
                                : "border-foreground/20 hover:bg-foreground/5"
                            }`}
                            title={already ? "Deja emisă" : "Emite factura"}
                            successMessage={
                              already
                                ? "Factura era deja emisă"
                                : "Factura a fost emisă"
                            }
                            disabled={already}
                          >
                            Emite factura
                          </ActionButton>
                          {already ? (
                              <span className="inline-block rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-base">
                              deja emisă
                            </span>
                          ) : null}
                        </form>
                      </li>
                    );
                  })}
              </ul>
            </section>
          );
        })()}
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
            <span className="text-foreground/50 text-[11px]">
              · Sursă:
              {bt ? (
                <span
                  className={
                    bt.source === "db"
                      ? "text-amber-700 dark:text-amber-400 text-[11px]"
                      : bt.source === "bt"
                      ? "text-emerald-700 dark:text-emerald-400 text-[11px]"
                      : "text-foreground/60 text-[11px]"
                  }
                >
                  {" "}
                  {bt.source}
                </span>
              ) : (
                <span className="text-foreground/50 text-[11px]"> —</span>
              )}
            </span>
            <span className="text-[12px] text-foreground/50">
              · Legend:{" "}
              <span className="text-amber-700 dark:text-amber-400">db</span>
              <span className="text-foreground/60"> = from Mongo cache</span>,
              <span className="ml-2 text-emerald-700 dark:text-emerald-400">
                bt
              </span>
              <span className="text-foreground/60">
                {" "}
                = freshly fetched from BT
              </span>
              ,<span className="ml-2">cache</span>
              <span className="text-foreground/60">
                {" "}
                = in-memory fallback (when no DB configured)
              </span>
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

        {/* Search and filtering removed from home page */}

        {/* Contract cards list removed from home; browse them on /contracts */}
      </div>
    </main>
  );
}
