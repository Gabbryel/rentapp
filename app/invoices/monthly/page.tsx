import {
  fetchContracts,
  effectiveEndDate,
  rentAmountAtDate,
  resolveBilledPeriodDate,
} from "@/lib/contracts";
import {
  computeInvoiceFromContract,
  issueInvoiceAndGeneratePdf,
  listInvoicesForMonth,
  deleteInvoiceById,
  invalidateYearInvoicesCache,
} from "@/lib/contracts";
import { computeNextMonthProration } from "@/lib/advance-billing";
import { getDailyEurRon, getEurRonForDate } from "@/lib/exchange";
import type { Contract as ContractType } from "@/lib/schemas/contract";
import type { Invoice } from "@/lib/schemas/invoice";
import { publishToast } from "@/lib/sse";
import { logAction } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import ActionButton from "@/app/components/action-button";
import ConfirmSubmit from "@/app/components/confirm-submit";
import PdfModal from "@/app/components/pdf-modal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BILLING_TIMEZONE = process.env.BILLING_TIMEZONE || "Europe/Bucharest";

function fmt(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    return d.toLocaleDateString("ro-RO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateIso;
  }
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" }).format(
    n
  );
const fmtRON = (n: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" }).format(
    n
  );

type RateSelection =
  | Awaited<ReturnType<typeof getDailyEurRon>>
  | NonNullable<Awaited<ReturnType<typeof getEurRonForDate>>>;

type ContractPartner = NonNullable<ContractType["partners"]>[number];

type DueItem = {
  contract: ContractType;
  issuedAt: string;
  amountEUR?: number;
  partnerId?: string;
  partnerName?: string;
  sharePercent?: number;
  exchangeRateOverride?: number;
  exchangeRateDate?: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizePartnerToken = (value: unknown): string => {
  if (!isNonEmptyString(value)) return "";
  return value.trim().toLowerCase();
};

const makeIssuedKey = (
  contractId: string,
  issuedAt: string,
  partnerToken?: unknown
): string => {
  const normalizedDate =
    typeof issuedAt === "string" ? issuedAt.trim() : String(issuedAt ?? "");
  return `${contractId}|${normalizedDate}|${normalizePartnerToken(
    partnerToken
  )}`;
};

function calendarDateInTimezone(tz: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date());
    const getPart = (type: "year" | "month" | "day") =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    if (year > 0 && month > 0 && day > 0) {
      return { year, month, day };
    }
  } catch {
    // ignore and fall back to server timezone
  }
  const fallback = new Date();
  return {
    year: fallback.getFullYear(),
    month: fallback.getMonth() + 1,
    day: fallback.getDate(),
  };
}

export default async function MonthlyInvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[]>>;
}) {
  const { year, month } = calendarDateInTimezone(BILLING_TIMEZONE);
  const resolvedParams = searchParams ? await searchParams : undefined;
  const rateParamRaw = resolvedParams?.rateDate;
  const requestedRateDate =
    typeof rateParamRaw === "string"
      ? rateParamRaw
      : Array.isArray(rateParamRaw)
      ? rateParamRaw[0]
      : undefined;
  const validRateDate =
    typeof requestedRateDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedRateDate)
      ? requestedRateDate
      : undefined;
  let rateSelection: RateSelection | null = null;
  if (validRateDate) {
    rateSelection = await getEurRonForDate(validRateDate, {
      fallbackToPrevious: true,
    });
  }
  if (!rateSelection) {
    rateSelection = await getDailyEurRon({ forceRefresh: false });
  }
  const rateOverride =
    typeof rateSelection?.rate === "number" &&
    Number.isFinite(rateSelection.rate)
      ? rateSelection.rate
      : undefined;
  const rateEffectiveDate = rateSelection?.date;
  const rateSource = rateSelection?.source ?? "bnr";
  const isOverrideActive = Boolean(validRateDate);
  const contracts: ContractType[] = await fetchContracts();

  // Invoices issued this month (for duplication prevention only)
  const issuedThisMonth: Invoice[] = await listInvoicesForMonth(year, month);
  const issuedByKey = new Set<string>();
  const issuedInvoiceMap = new Map<string, Invoice>();
  const issuedCountsByBase = new Map<string, number>();
  for (const invoice of issuedThisMonth) {
    const baseKey = makeIssuedKey(invoice.contractId, invoice.issuedAt, "");
    issuedCountsByBase.set(baseKey, (issuedCountsByBase.get(baseKey) ?? 0) + 1);
    const tokenSet = new Set<string>();
    if (isNonEmptyString(invoice.partnerId)) {
      tokenSet.add(invoice.partnerId);
    }
    if (isNonEmptyString(invoice.partner)) {
      tokenSet.add(invoice.partner);
    }
    tokenSet.add("");
    for (const token of tokenSet) {
      const key = makeIssuedKey(invoice.contractId, invoice.issuedAt, token);
      issuedByKey.add(key);
      if (!issuedInvoiceMap.has(key)) {
        issuedInvoiceMap.set(key, invoice);
      }
    }
  }

  // Build list of due invoices (contract occurrences expected this month & not yet issued)
  const due: DueItem[] = [];
  const rateProps =
    isOverrideActive && typeof rateOverride === "number"
      ? {
          exchangeRateOverride: rateOverride,
          exchangeRateDate: rateEffectiveDate,
        }
      : {};

  const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const monthDays = daysInMonth(year, month);

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, monthDays);

  for (const c of contracts) {
    if (!c.startDate) continue;
    const start = new Date(c.startDate);
    const end = new Date(effectiveEndDate(c));
    // Skip if contract not active during this month window
    if (end < monthStart || start > monthEnd) continue;

    if (c.rentType === "monthly") {
      // Determine if this contract uses advance (next month) billing
      const mode = c.invoiceMonthMode === "next" ? "next" : "current";
      // Determine the invoice day for this month: use monthlyInvoiceDay, else fallback to startDate day
      const baseDay =
        typeof c.monthlyInvoiceDay === "number"
          ? c.monthlyInvoiceDay
          : new Date(c.startDate).getDate();
      const day = Math.min(Math.max(1, baseDay), monthDays);
      const issuedAt = `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const issuedDate = new Date(issuedAt);
      // Ensure the invoice day itself lies within contract active range (for first/last months) *for current-mode billing*
      // For next-mode we only require contract active at some point this current month (already ensured above) and active in the next month window.
      if (mode === "current" && (issuedDate < start || issuedDate > end))
        continue;

      let amountEUROverride: number | undefined = undefined;
      if (mode === "next") {
        // Apply stricter advance billing rules with potential proration.
        const { include, fraction } = computeNextMonthProration(c, year, month);
        if (!include) {
          continue; // suppressed by rules (no overlap, ends day 1/2, etc.)
        }
        // Use next month base even when fraction === 1 to have a concrete override
        const nextYearVal = month === 12 ? year + 1 : year;
        const nextMonthVal = month === 12 ? 1 : month + 1;
        const nextIso = `${nextYearVal}-${String(nextMonthVal).padStart(
          2,
          "0"
        )}-01`;
        const base = rentAmountAtDate(c, nextIso);
        if (typeof base === "number") {
          amountEUROverride =
            base *
            (typeof fraction === "number" && fraction > 0 ? fraction : 1);
        }
      } else {
        // For current-mode, precompute the base amount for this issued date
        const base = rentAmountAtDate(c, issuedAt);
        if (typeof base === "number") {
          amountEUROverride = base;
        }
      }

      const partners: ContractPartner[] = Array.isArray(c.partners)
        ? c.partners
        : [];
      const sumShares = partners.reduce(
        (total, partner) =>
          total +
          (typeof partner.sharePercent === "number" ? partner.sharePercent : 0),
        0
      );
      if (partners.length > 1 && sumShares > 0) {
        for (const partner of partners) {
          const share =
            typeof partner.sharePercent === "number"
              ? partner.sharePercent / 100
              : 0;
          if (share <= 0) continue;
          const partAmount =
            typeof amountEUROverride === "number"
              ? amountEUROverride * share
              : undefined;
          due.push({
            contract: c,
            issuedAt,
            amountEUR: partAmount,
            partnerId: partner.id ?? undefined,
            partnerName: partner.name,
            sharePercent: partner.sharePercent,
            ...rateProps,
          });
        }
      } else {
        // Attach primary partner info so issued-key matching works for single-partner contracts
        const extra: Pick<DueItem, "partnerId" | "partnerName"> = {};
        if (c.partnerId) extra.partnerId = c.partnerId;
        if (c.partner) extra.partnerName = c.partner;
        due.push({
          contract: c,
          issuedAt,
          amountEUR: amountEUROverride,
          ...extra,
          ...rateProps,
        });
      }
    } else if (c.rentType === "yearly") {
      const entries =
        Array.isArray(c.irregularInvoices) && c.irregularInvoices.length > 0
          ? c.irregularInvoices
          : Array.isArray(c.yearlyInvoices) && c.yearlyInvoices.length > 0
          ? c.yearlyInvoices
          : undefined;
      if (!entries) continue;
      for (const yi of entries) {
        if (yi.month !== month) continue;
        const day = Math.min(Math.max(1, yi.day), monthDays);
        const issuedAt = `${year}-${String(month).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        const issuedDate = new Date(issuedAt);
        if (issuedDate < start || issuedDate > end) continue;
        const partners: ContractPartner[] = Array.isArray(c.partners)
          ? c.partners
          : [];
        const sumShares = partners.reduce(
          (total, partner) =>
            total +
            (typeof partner.sharePercent === "number"
              ? partner.sharePercent
              : 0),
          0
        );
        if (partners.length > 1 && sumShares > 0) {
          for (const partner of partners) {
            const share =
              typeof partner.sharePercent === "number"
                ? partner.sharePercent / 100
                : 0;
            if (share <= 0) continue;
            due.push({
              contract: c,
              issuedAt,
              amountEUR: yi.amountEUR * share,
              partnerId: partner.id ?? undefined,
              partnerName: partner.name,
              sharePercent: partner.sharePercent,
              ...rateProps,
            });
          }
        } else {
          due.push({
            contract: c,
            issuedAt,
            amountEUR: yi.amountEUR,
            ...rateProps,
          });
        }
      }
    }
  }

  // Count how many due items exist per (contractId, issuedAt) base key.
  const dueCountsByBase = new Map<string, number>();
  for (const item of due) {
    const baseKey = makeIssuedKey(item.contract.id, item.issuedAt, "");
    dueCountsByBase.set(baseKey, (dueCountsByBase.get(baseKey) ?? 0) + 1);
  }

  async function issueDue(formData: FormData) {
    "use server";
    const contractIdRaw = formData.get("contractId");
    const issuedAtRaw = formData.get("issuedAt");
    const partnerIdRaw = formData.get("partnerId");
    const partnerNameRaw = formData.get("partnerName");
    const sharePercentRaw = formData.get("sharePercent");
    const rateOverrideRaw = formData.get("exchangeRateRON");

    const contractId =
      typeof contractIdRaw === "string" ? contractIdRaw.trim() : "";
    const issuedAt = typeof issuedAtRaw === "string" ? issuedAtRaw.trim() : "";

    if (!contractId || !issuedAt) {
      publishToast(
        "Nu am primit datele necesare pentru emiterea facturii.",
        "error"
      );
      return;
    }

    const c = await fetchContracts().then((all) =>
      all.find((x) => x.id === contractId)
    );
    if (!c) {
      publishToast("Contractul nu a fost găsit.", "error");
      return;
    }

    const rateOverride =
      typeof rateOverrideRaw === "string" && rateOverrideRaw.trim()
        ? Number(rateOverrideRaw.trim())
        : undefined;

    const sharePercent =
      typeof sharePercentRaw === "string" && sharePercentRaw.trim()
        ? Number(sharePercentRaw.trim())
        : undefined;

    const partnerId =
      typeof partnerIdRaw === "string" && partnerIdRaw.trim()
        ? partnerIdRaw.trim()
        : undefined;

    const partnerName =
      typeof partnerNameRaw === "string" && partnerNameRaw.trim()
        ? partnerNameRaw.trim()
        : undefined;

    try {
      const invoice = await computeInvoiceFromContract({
        contract: c,
        issuedAt,
        amountEUROverride:
          typeof sharePercent === "number"
            ? (rentAmountAtDate(c, issuedAt) ?? 0) * (sharePercent / 100)
            : undefined,
      });

      // Apply partner info and rate override to the invoice
      if (partnerId) invoice.partnerId = partnerId;
      if (partnerName) invoice.partner = partnerName;
      if (typeof rateOverride === "number") {
        invoice.exchangeRateRON = rateOverride;
        // Recalculate RON amounts with new rate
        const correctedEUR = invoice.correctedAmountEUR || invoice.amountEUR;
        invoice.netRON = correctedEUR * rateOverride;
        invoice.vatRON = invoice.netRON * ((invoice.tvaPercent || 0) / 100);
        invoice.totalRON = invoice.netRON + invoice.vatRON;
      }

      await issueInvoiceAndGeneratePdf(invoice);
      await logAction({
        action: "invoice.issued",
        targetType: "invoice",
        targetId: invoice.id,
        meta: { invoiceId: invoice.id, issuedAt },
      });
      publishToast(
        `Factura #${invoice.number || invoice.id} a fost emisă cu succes.`,
        "success"
      );
    } catch (err) {
      console.error("Issue invoice error:", err);
      publishToast(
        err instanceof Error ? err.message : "Eroare la emiterea facturii.",
        "error"
      );
    }
    revalidatePath("/invoices/monthly");
  }

  async function deleteIssued(formData: FormData) {
    "use server";
    try {
      const contractId = String(formData.get("contractId"));
      const issuedAt = String(formData.get("issuedAt"));
      const y = Number(issuedAt.slice(0, 4));
      const m = Number(issuedAt.slice(5, 7));
      const monthInvs = await listInvoicesForMonth(y, m);
      const all = monthInvs.filter(
        (it) => it.contractId === contractId && it.issuedAt === issuedAt
      );
      for (const inv of all) {
        await deleteInvoiceById(inv.id);
      }
      try {
        invalidateYearInvoicesCache();
      } catch {}
    } catch {}
    revalidatePath("/invoices/monthly");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <h1 className="text-fluid-4xl font-semibold tracking-tight mb-8">
          Facturi de emis luna aceasta
        </h1>
        <section className="mb-8 rounded-xl border border-foreground/10 bg-background/70 p-5">
          <form
            method="get"
            className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
          >
            <label className="flex flex-col gap-2 text-sm font-medium text-foreground/80">
              Data pentru curs EUR/RON (BNR)
              <input
                type="date"
                name="rateDate"
                defaultValue={validRateDate ?? rateEffectiveDate ?? ""}
                className="rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/5"
              >
                Aplică cursul
              </button>
              {validRateDate ? (
                <Link
                  href="/invoices/monthly"
                  className="text-sm text-foreground/60 hover:text-foreground"
                >
                  Revino la data curentă
                </Link>
              ) : null}
            </div>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground/70">
            <span>
              {isOverrideActive ? "Curs aplicat" : "Curs disponibil"}:{" "}
              {typeof rateOverride === "number"
                ? `${rateOverride.toFixed(4)} RON/EUR`
                : "nedisponibil"}
            </span>
            {rateEffectiveDate ? (
              <span>Valabil pentru {fmt(rateEffectiveDate)}</span>
            ) : null}
            <span className="text-foreground/50">
              Sursă:{" "}
              {{
                bnr: "BNR (live)",
                db: "Arhivă internă",
                cache: "Cache locală",
                fallback: "Ultimul curs salvat",
              }[rateSource] ?? "BNR"}
            </span>
          </div>
          {validRateDate &&
          rateEffectiveDate &&
          validRateDate !== rateEffectiveDate ? (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              Nu există un curs publicat pentru {fmt(validRateDate)}. S-a
              folosit valoarea din {fmt(rateEffectiveDate)}.
            </div>
          ) : null}
          {!isOverrideActive ? (
            <div className="mt-3 text-xs text-foreground/60">
              Selectează o dată și apasă „Aplică cursul" pentru a folosi această
              valoare la emiterea facturilor.
            </div>
          ) : null}
        </section>
        {(() => {
          if (due.length === 0) {
            return (
              <div className="rounded-xl border border-foreground/10 bg-background/70 p-8 text-center text-foreground/60">
                Nicio factură programată pentru luna curentă.
              </div>
            );
          }
          const groups = new Map<string, typeof due>();
          for (const item of due) {
            const owner = item.contract.owner || "—";
            const arr = groups.get(owner) || [];
            arr.push(item);
            groups.set(owner, arr);
          }
          const owners = Array.from(groups.keys()).sort((a, b) =>
            a.localeCompare(b)
          );
          return owners.map((owner) => (
            <section
              key={owner}
              className="mb-8 rounded-xl border border-foreground/10 bg-background/70 p-5"
            >
              <h2 className="text-lg font-semibold mb-3">
                <Link
                  href={`/owners/${encodeURIComponent(owner)}`}
                  className="hover:underline"
                >
                  {owner}
                </Link>
              </h2>
              <ul id="invoices-list-monthly-page" className="space-y-4">
                {groups
                  .get(owner)!
                  .slice()
                  .sort((a, b) => {
                    const day = (s: string) => {
                      const dd = Number(s?.slice(8, 10));
                      return Number.isInteger(dd)
                        ? dd
                        : new Date(s).getDate() || 0;
                    };
                    const pa = (
                      a.partnerName ??
                      a.contract.partner ??
                      ""
                    ).toString();
                    const pb = (
                      b.partnerName ??
                      b.contract.partner ??
                      ""
                    ).toString();
                    const dA = day(a.issuedAt);
                    const dB = day(b.issuedAt);
                    if (dA !== dB) return dA - dB;
                    return pa.localeCompare(pb, "ro-RO", {
                      sensitivity: "base",
                    });
                  })
                  .map((d) => {
                    const partnerTokenCandidates: string[] = [];
                    if (isNonEmptyString(d.partnerId)) {
                      partnerTokenCandidates.push(d.partnerId);
                    }
                    if (isNonEmptyString(d.partnerName)) {
                      partnerTokenCandidates.push(d.partnerName);
                    }
                    if (isNonEmptyString(d.contract.partnerId)) {
                      partnerTokenCandidates.push(d.contract.partnerId);
                    }
                    if (isNonEmptyString(d.contract.partner)) {
                      partnerTokenCandidates.push(d.contract.partner);
                    }
                    const hasSpecificToken = partnerTokenCandidates.length > 0;
                    let matchingKey: string | null = null;
                    for (const candidate of partnerTokenCandidates) {
                      const candidateKey = makeIssuedKey(
                        d.contract.id,
                        d.issuedAt,
                        candidate
                      );
                      if (issuedByKey.has(candidateKey)) {
                        matchingKey = candidateKey;
                        break;
                      }
                    }
                    if (!matchingKey) {
                      const baseKey = makeIssuedKey(
                        d.contract.id,
                        d.issuedAt,
                        ""
                      );
                      const dueBaseCount = dueCountsByBase.get(baseKey) ?? 0;
                      if (
                        issuedByKey.has(baseKey) &&
                        (!hasSpecificToken || dueBaseCount === 1)
                      ) {
                        matchingKey = baseKey;
                      }
                    }
                    const already = matchingKey !== null;
                    const fallbackKey = partnerTokenCandidates.length
                      ? makeIssuedKey(
                          d.contract.id,
                          d.issuedAt,
                          partnerTokenCandidates[0]
                        )
                      : makeIssuedKey(d.contract.id, d.issuedAt, "");
                    const listKey = matchingKey ?? fallbackKey;
                    const billedAt = resolveBilledPeriodDate(
                      d.contract,
                      d.issuedAt
                    );
                    const amtEUR =
                      typeof d.amountEUR === "number"
                        ? d.amountEUR
                        : rentAmountAtDate(d.contract, billedAt);
                    const rateOverrideItem =
                      typeof d.exchangeRateOverride === "number"
                        ? d.exchangeRateOverride
                        : undefined;
                    const inv = matchingKey
                      ? issuedInvoiceMap.get(matchingKey) ?? null
                      : null;
                    const rate = already
                      ? inv?.exchangeRateRON
                      : typeof rateOverrideItem === "number"
                      ? rateOverrideItem
                      : typeof d.contract.exchangeRateRON === "number"
                      ? d.contract.exchangeRateRON
                      : undefined;
                    const corrPct = already
                      ? inv?.correctionPercent ?? 0
                      : typeof d.contract.correctionPercent === "number"
                      ? d.contract.correctionPercent
                      : 0;
                    const tvaPct = already
                      ? inv?.tvaPercent ?? 0
                      : typeof d.contract.tvaPercent === "number"
                      ? d.contract.tvaPercent
                      : 0;
                    const correctedEUR = already
                      ? inv?.correctedAmountEUR
                      : typeof amtEUR === "number"
                      ? amtEUR * (1 + (corrPct || 0) / 100)
                      : undefined;
                    const netRON = already
                      ? inv?.netRON
                      : typeof correctedEUR === "number" &&
                        typeof rate === "number"
                      ? correctedEUR * rate
                      : undefined;
                    const vatRON = already
                      ? inv?.vatRON
                      : typeof netRON === "number"
                      ? netRON * ((tvaPct || 0) / 100)
                      : undefined;
                    const totalRON = already
                      ? inv?.totalRON
                      : typeof netRON === "number"
                      ? netRON + (vatRON ?? 0)
                      : undefined;
                    const partners: ContractPartner[] = Array.isArray(
                      d.contract.partners
                    )
                      ? d.contract.partners
                      : [];
                    const partnerCount = partners.filter(
                      (partner) =>
                        typeof partner?.name === "string" &&
                        partner.name.trim().length > 0
                    ).length;
                    const partnerHrefId =
                      d.partnerId || d.contract.partnerId || null;
                    const partnerSlug = encodeURIComponent(
                      d.partnerName ?? d.contract.partner
                    );

                    const liBase =
                      "group rounded-lg border transition-colors shadow-sm p-4 text-white text-[110%] [&_*]:!text-white [&_*]:![font-size:inherit]";
                    const liClass = already
                      ? `${liBase} border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20`
                      : `${liBase} border-foreground/10 bg-background/60 hover:bg-background/70`;
                    return (
                      <li key={listKey} className={liClass}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center rounded-md bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-foreground/60 border border-foreground/10">
                                <Link
                                  href={`/partners/${
                                    partnerHrefId ?? partnerSlug
                                  }`}
                                  className="hover:underline decoration-amber-200 decoration-dotted underline-offset-4"
                                >
                                  {d.partnerName ?? d.contract.partner}
                                </Link>
                              </span>
                              <Link
                                href={`/contracts/${d.contract.id}`}
                                className="hover:underline decoration-amber-200 decoration-dotted underline-offset-4"
                              >
                                <h3 className="text-sm font-semibold tracking-tight leading-tight">
                                  {d.contract.name}
                                </h3>
                              </Link>

                              {d.contract.invoiceMonthMode === "next" &&
                              d.contract.rentType === "monthly" ? (
                                <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  În avans
                                </span>
                              ) : null}
                              <span className="text-[11px] text-foreground/50">
                                {fmt(d.issuedAt)}
                              </span>
                              {corrPct ? (
                                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                  +{corrPct}%
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground/50">
                              <span>
                                Curs:{" "}
                                {typeof rate === "number"
                                  ? `${rate.toFixed(4)} RON/EUR`
                                  : "–"}
                              </span>
                              <span>TVA: {tvaPct ? `${tvaPct}%` : "0%"}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {already ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400"
                                title={`Factura emisă (#${
                                  inv?.number || inv?.id || "–"
                                })`}
                              >
                                <svg
                                  className="h-4 w-4"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M9 12l2 2 4-4" />
                                  <circle cx="12" cy="12" r="9" />
                                </svg>
                                Emisă
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[12px] font-medium text-amber-600 dark:text-amber-400">
                                În așteptare
                              </span>
                            )}
                            {already ? (
                              <form
                                action={deleteIssued}
                                method="post"
                                className="flex items-center"
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
                                {d.partnerId ? (
                                  <input
                                    type="hidden"
                                    name="partnerId"
                                    value={d.partnerId}
                                  />
                                ) : d.partnerName ? (
                                  <input
                                    type="hidden"
                                    name="partnerName"
                                    value={d.partnerName}
                                  />
                                ) : null}
                                <ConfirmSubmit
                                  className="rounded-md border px-2.5 py-1.5 text-sm font-medium flex items-center justify-center border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                                  title="Șterge factura emisă"
                                  successMessage="Factura a fost ștearsă"
                                  confirmMessage="Sigur dorești să ștergi această factură emisă?"
                                  triggerStatsRefresh
                                  data-delta-mode="delete"
                                  data-delta-month-ron={
                                    typeof totalRON === "number"
                                      ? String(totalRON)
                                      : undefined
                                  }
                                  data-delta-month-net-ron={
                                    typeof netRON === "number"
                                      ? String(netRON)
                                      : undefined
                                  }
                                  data-delta-month-eur={
                                    typeof correctedEUR === "number"
                                      ? String(correctedEUR)
                                      : undefined
                                  }
                                  data-delta-annual-ron={
                                    typeof totalRON === "number"
                                      ? String(totalRON)
                                      : undefined
                                  }
                                  data-delta-annual-net-ron={
                                    typeof netRON === "number"
                                      ? String(netRON)
                                      : undefined
                                  }
                                  data-delta-annual-eur={
                                    typeof correctedEUR === "number"
                                      ? String(correctedEUR)
                                      : undefined
                                  }
                                >
                                  <svg
                                    className="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <path d="M10 11v6" />
                                    <path d="M14 11v6" />
                                    <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
                                  </svg>
                                </ConfirmSubmit>
                              </form>
                            ) : (
                              <form
                                action={issueDue}
                                method="post"
                                className="flex items-center"
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
                                {typeof d.partnerId === "string" &&
                                d.partnerId ? (
                                  <input
                                    type="hidden"
                                    name="partnerId"
                                    value={d.partnerId}
                                  />
                                ) : null}
                                {typeof d.partnerName === "string" &&
                                d.partnerName ? (
                                  <input
                                    type="hidden"
                                    name="partnerName"
                                    value={d.partnerName}
                                  />
                                ) : null}
                                {typeof d.sharePercent === "number" ? (
                                  <input
                                    type="hidden"
                                    name="sharePercent"
                                    value={String(d.sharePercent)}
                                  />
                                ) : null}
                                {typeof d.amountEUR === "number" ? (
                                  <input
                                    type="hidden"
                                    name="amountEUR"
                                    value={String(d.amountEUR)}
                                  />
                                ) : null}
                                {isOverrideActive &&
                                typeof rateOverrideItem === "number" ? (
                                  <input
                                    type="hidden"
                                    name="exchangeRateRON"
                                    value={String(rateOverrideItem)}
                                  />
                                ) : null}
                                <ActionButton
                                  className="rounded-md border px-2.5 py-1.5 text-sm font-medium flex items-center justify-center border-foreground/20 hover:bg-foreground/5"
                                  title="Emite factura"
                                  successMessage="Factura a fost emisă"
                                  triggerStatsRefresh
                                  optimisticToast={false}
                                  data-delta-mode="issue"
                                  data-delta-month-ron={
                                    typeof totalRON === "number"
                                      ? String(totalRON)
                                      : undefined
                                  }
                                  data-delta-month-net-ron={
                                    typeof netRON === "number"
                                      ? String(netRON)
                                      : undefined
                                  }
                                  data-delta-month-eur={
                                    typeof correctedEUR === "number"
                                      ? String(correctedEUR)
                                      : undefined
                                  }
                                  data-delta-annual-ron={
                                    typeof totalRON === "number"
                                      ? String(totalRON)
                                      : undefined
                                  }
                                  data-delta-annual-net-ron={
                                    typeof netRON === "number"
                                      ? String(netRON)
                                      : undefined
                                  }
                                  data-delta-annual-eur={
                                    typeof correctedEUR === "number"
                                      ? String(correctedEUR)
                                      : undefined
                                  }
                                >
                                  <svg
                                    className="h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M12 5v14" />
                                    <path d="M5 12h14" />
                                    <circle cx="12" cy="12" r="9" />
                                  </svg>
                                </ActionButton>
                              </form>
                            )}
                            {already && inv?.pdfUrl ? (
                              <PdfModal
                                url={inv.pdfUrl}
                                invoiceNumber={inv.number || inv.id}
                                className="ml-1"
                              />
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 text-[15px]">
                          <div className="space-y-0.5">
                            <div className="text-foreground/50 text-[13px] uppercase tracking-wide">
                              EUR {already ? "emis" : "inițial"}
                            </div>
                            <div className="font-medium text-indigo-700 dark:text-indigo-400">
                              {already
                                ? typeof inv?.amountEUR === "number"
                                  ? fmtEUR(inv.amountEUR)
                                  : "–"
                                : typeof amtEUR === "number"
                                ? fmtEUR(amtEUR)
                                : "–"}
                            </div>
                          </div>
                          {partnerCount > 1 &&
                          !d.partnerId &&
                          !d.partnerName ? (
                            <div className="sm:col-span-3 md:col-span-5 lg:col-span-6">
                              <div className="text-[12px] text-foreground/60 mb-1">
                                Procentaje parteneri
                              </div>
                              <ul className="text-[12px] text-foreground/70 space-y-0.5">
                                {partners.map((p, idx) => {
                                  const hasPct =
                                    typeof p.sharePercent === "number" &&
                                    isFinite(p.sharePercent);
                                  const share = hasPct
                                    ? (p.sharePercent as number) / 100
                                    : undefined;
                                  const partEUR =
                                    typeof share === "number" &&
                                    typeof correctedEUR === "number"
                                      ? correctedEUR * share
                                      : undefined;
                                  const partRON =
                                    typeof share === "number" &&
                                    typeof totalRON === "number"
                                      ? totalRON * share
                                      : undefined;
                                  return (
                                    <li
                                      key={p.id || p.name || String(idx)}
                                      className="flex items-center gap-2"
                                    >
                                      <Link
                                        href={`/partners/${encodeURIComponent(
                                          p.id || p.name || ""
                                        )}`}
                                        className="hover:underline"
                                      >
                                        {p.name}
                                      </Link>
                                      <span className="text-foreground/50">
                                        •
                                      </span>
                                      <span>
                                        {hasPct ? `${p.sharePercent}%` : "—"}
                                      </span>
                                      {hasPct ? (
                                        <>
                                          <span className="text-foreground/50">
                                            •
                                          </span>
                                          <span>
                                            {typeof partEUR === "number"
                                              ? fmtEUR(partEUR)
                                              : "—"}
                                            {typeof partRON === "number"
                                              ? ` · ${fmtRON(partRON)}`
                                              : ""}
                                          </span>
                                        </>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : null}
                          <div className="space-y-0.5">
                            <div className="text-foreground/50 text-[13px] uppercase tracking-wide">
                              EUR{" "}
                              {already ? "emis (după corecție)" : "corectat"}
                              {corrPct ? ` (+${corrPct}%)` : ""}
                            </div>
                            <div className="font-medium text-indigo-700 dark:text-indigo-400">
                              {typeof correctedEUR === "number"
                                ? fmtEUR(correctedEUR)
                                : "–"}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-foreground/50 text-[13px] uppercase tracking-wide">
                              {already ? "Curs la emitere" : "Curs RON/EUR"}
                            </div>
                            <div className="font-medium text-slate-700 dark:text-slate-300">
                              {typeof rate === "number" ? rate.toFixed(4) : "–"}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-foreground/50 text-[13px] uppercase tracking-wide">
                              Net RON
                            </div>
                            <div className="font-medium text-sky-700 dark:text-sky-400">
                              {typeof netRON === "number"
                                ? fmtRON(netRON)
                                : "–"}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-foreground/50 text-[13px] uppercase tracking-wide">
                              TVA {tvaPct ? `(${tvaPct}%)` : ""}
                            </div>
                            <div className="font-medium text-rose-700 dark:text-rose-400">
                              {typeof vatRON === "number"
                                ? fmtRON(vatRON)
                                : "–"}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-foreground/50 text-[13px] uppercase tracking-wide">
                              Total RON
                            </div>
                            <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {typeof totalRON === "number"
                                ? fmtRON(totalRON)
                                : "–"}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ));
        })()}
      </div>
    </main>
  );
}
