import { createHash } from "crypto";
import type { Contract } from "@/lib/schemas/contract";
import type { Invoice } from "@/lib/schemas/invoice";
import {
  computeInvoiceFromContract,
  rentAmountAtDate,
  resolveBilledPeriodDate,
} from "@/lib/contracts";
import { getEurRonForDate } from "@/lib/exchange";

type InvoiceKind = "standard" | "custom_period";

type DateRange = {
  from: string;
  to: string;
};

type PreviewInput = {
  contract: Contract;
  existingInvoices: Invoice[];
  issuedAt: string;
  kind: InvoiceKind;
  partnerKey?: string | string[];
  fromDate?: string;
  toDate?: string;
  manualAmountEUR?: number;
  issuedByEmail?: string;
  exchangeRateOverride?: { rate: number; date: string };
};

export type InvoicePreviewResult = {
  invoice: Invoice;
  kind: InvoiceKind;
  billedAt: string;
  periodFrom: string;
  periodTo: string;
  totalDays: number;
  billedDays: number;
  computedAmountEUR: number;
  effectiveAmountEUR: number;
  exchangeRateDate: string;
  exchangeRateRON: number;
  previewToken: string;
};

function parseIsoDate(iso: string): Date {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  if (!valid) throw new Error("Data trebuie în format YYYY-MM-DD");
  const dt = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) {
    throw new Error("Data este invalidă");
  }
  return dt;
}

function formatIsoDate(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const dt = parseIsoDate(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatIsoDate(dt);
}

function daysInMonthFromIso(iso: string): number {
  const dt = parseIsoDate(iso);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function monthStartFromIso(iso: string): string {
  const dt = parseIsoDate(iso);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function monthEndFromIso(iso: string): string {
  const start = monthStartFromIso(iso);
  const days = daysInMonthFromIso(start);
  return `${start.slice(0, 8)}${String(days).padStart(2, "0")}`;
}

function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return !(a.to < b.from || a.from > b.to);
}

function listDaysInRange(range: DateRange): string[] {
  const out: string[] = [];
  let cursor = range.from;
  while (cursor <= range.to) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

function dayRateForDate(contract: Contract, iso: string): number {
  const monthRent = rentAmountAtDate(contract, iso);
  if (!(typeof monthRent === "number" && monthRent > 0)) {
    throw new Error(`Nu se poate determina chiria pentru data ${iso}`);
  }
  return monthRent / daysInMonthFromIso(iso);
}

function sumDailyAmount(contract: Contract, days: string[]): number {
  return days.reduce((sum, day) => sum + dayRateForDate(contract, day), 0);
}

function toDateRange(from: string, to: string): DateRange {
  const fromDt = parseIsoDate(from);
  const toDt = parseIsoDate(to);
  if (fromDt > toDt) {
    throw new Error("from_date trebuie să fie mai mică sau egală cu to_date");
  }
  return { from: formatIsoDate(fromDt), to: formatIsoDate(toDt) };
}

function normalizeInvoiceRange(invoice: Invoice, contract: Contract): DateRange | null {
  const customFrom = String((invoice as any).periodFrom || "").slice(0, 10);
  const customTo = String((invoice as any).periodTo || "").slice(0, 10);
  if (customFrom && customTo && /^\d{4}-\d{2}-\d{2}$/.test(customFrom) && /^\d{4}-\d{2}-\d{2}$/.test(customTo)) {
    return toDateRange(customFrom, customTo);
  }

  if (contract.rentType !== "monthly") return null;
  const billedAt = String((invoice as any).billedAt || "").slice(0, 10) || resolveBilledPeriodDate(contract, invoice.issuedAt);
  const from = monthStartFromIso(billedAt);
  const to = monthEndFromIso(billedAt);
  return { from, to };
}

function invoiceMatchesPartner(
  invoice: Invoice,
  partnerKey?: string | string[],
): boolean {
  if (!partnerKey) return true;
  const keys = (Array.isArray(partnerKey) ? partnerKey : [partnerKey])
    .map((k) => String(k || "").trim())
    .filter(Boolean);
  if (keys.length === 0) return true;

  const invoiceKeys = [
    String(invoice.partnerId || "").trim(),
    String(invoice.partner || "").trim(),
  ].filter(Boolean);
  if (invoiceKeys.length === 0) return false;
  return keys.some((key) => invoiceKeys.includes(key));
}

function computeUncoveredDays(target: DateRange, covered: DateRange[]): string[] {
  const targetDays = listDaysInRange(target);
  return targetDays.filter((day) => {
    return !covered.some((range) => day >= range.from && day <= range.to);
  });
}

function buildContiguousRange(days: string[]): DateRange {
  if (days.length === 0) throw new Error("Nu există zile de facturat");
  return { from: days[0], to: days[days.length - 1] };
}

function round6(n: number): number {
  return Number(n.toFixed(6));
}

function buildPreviewToken(input: {
  contractId: string;
  partnerKey?: string | string[];
  issuedAt: string;
  kind: InvoiceKind;
  periodFrom: string;
  periodTo: string;
  billedAt: string;
  computedAmountEUR: number;
  effectiveAmountEUR: number;
  exchangeRateRON: number;
  exchangeRateDate: string;
}): string {
  const normalizedPartnerKey = Array.isArray(input.partnerKey)
    ? input.partnerKey
        .map((k) => String(k || "").trim())
        .filter(Boolean)
        .sort()
        .join("|")
    : String(input.partnerKey || "").trim();
  const stable = JSON.stringify({
    contractId: input.contractId,
    partnerKey: normalizedPartnerKey,
    issuedAt: input.issuedAt,
    kind: input.kind,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    billedAt: input.billedAt,
    computedAmountEUR: round6(input.computedAmountEUR),
    effectiveAmountEUR: round6(input.effectiveAmountEUR),
    exchangeRateRON: round6(input.exchangeRateRON),
    exchangeRateDate: input.exchangeRateDate,
  });
  return createHash("sha256").update(stable).digest("hex");
}

export async function prepareInvoicePreview(input: PreviewInput): Promise<InvoicePreviewResult | null> {
  const issuedAt = String(input.issuedAt || "").slice(0, 10);
  parseIsoDate(issuedAt);

  if (input.contract.rentType !== "monthly") {
    const fallback = computeInvoiceFromContract({
      contract: input.contract,
      issuedAt,
      amountEUROverride: input.manualAmountEUR,
      billedAt: resolveBilledPeriodDate(input.contract, issuedAt),
    });
    const billedAt = resolveBilledPeriodDate(input.contract, issuedAt);
    const periodFrom = monthStartFromIso(billedAt);
    const periodTo = monthEndFromIso(billedAt);
    const token = buildPreviewToken({
      contractId: fallback.contractId,
      partnerKey: input.partnerKey,
      issuedAt,
      kind: "standard",
      periodFrom,
      periodTo,
      billedAt,
      computedAmountEUR: fallback.amountEUR,
      effectiveAmountEUR: fallback.amountEUR,
      exchangeRateRON: fallback.exchangeRateRON,
      exchangeRateDate: billedAt,
    });
    const invoice = {
      ...fallback,
      kind: "standard",
      billedAt,
      periodFrom,
      periodTo,
      autoAmountEUR: fallback.amountEUR,
      amountSource: input.manualAmountEUR ? "manual" : "auto",
      manualOverrideEUR: input.manualAmountEUR,
      exchangeRateDate: billedAt,
      issuedByEmail: input.issuedByEmail,
      previewToken: token,
    } as any;
    return {
      invoice,
      kind: "standard",
      billedAt,
      periodFrom,
      periodTo,
      totalDays: listDaysInRange({ from: periodFrom, to: periodTo }).length,
      billedDays: listDaysInRange({ from: periodFrom, to: periodTo }).length,
      computedAmountEUR: fallback.amountEUR,
      effectiveAmountEUR: fallback.amountEUR,
      exchangeRateDate: billedAt,
      exchangeRateRON: fallback.exchangeRateRON,
      previewToken: token,
    };
  }

  const billedAt =
    input.kind === "custom_period"
      ? String(input.fromDate || "").slice(0, 10)
      : resolveBilledPeriodDate(input.contract, issuedAt);

  let targetRange: DateRange;
  if (input.kind === "custom_period") {
    const from = String(input.fromDate || "").slice(0, 10);
    const to = String(input.toDate || "").slice(0, 10);
    targetRange = toDateRange(from, to);
  } else {
    targetRange = {
      from: monthStartFromIso(billedAt),
      to: monthEndFromIso(billedAt),
    };
  }

  const relevantRanges = input.existingInvoices
    .filter((invoice) => invoice.contractId === input.contract.id)
    .filter((invoice) => invoiceMatchesPartner(invoice, input.partnerKey))
    .map((invoice) => normalizeInvoiceRange(invoice, input.contract))
    .filter((it): it is DateRange => Boolean(it));

  if (input.kind === "custom_period") {
    const overlap = relevantRanges.find((range) => rangesOverlap(targetRange, range));
    if (overlap) {
      throw new Error(
        `Perioada selectată se suprapune cu o factură existentă (${overlap.from} - ${overlap.to}).`
      );
    }
  }

  const overlappingCoverage = relevantRanges.filter((range) => rangesOverlap(range, targetRange));
  const uncoveredDays = input.kind === "custom_period"
    ? listDaysInRange(targetRange)
    : computeUncoveredDays(targetRange, overlappingCoverage);

  if (uncoveredDays.length === 0) {
    return null;
  }

  const computedAmountEUR = sumDailyAmount(input.contract, uncoveredDays);
  const effectiveAmountEUR =
    typeof input.manualAmountEUR === "number" && input.manualAmountEUR > 0
      ? input.manualAmountEUR
      : computedAmountEUR;

  const effectiveRange =
    input.kind === "custom_period"
      ? targetRange
      : buildContiguousRange(uncoveredDays);

  const fxDate = input.kind === "custom_period" ? effectiveRange.from : billedAt;
  const fx = input.exchangeRateOverride
    ? {
        rate: input.exchangeRateOverride.rate,
        date: input.exchangeRateOverride.date,
        source: "fallback" as const,
      }
    : await getEurRonForDate(fxDate, { fallbackToPrevious: true });
  if (!fx || !(fx.rate > 0)) {
    throw new Error("Nu există curs valutar valid pentru perioada selectată");
  }

  const contractWithRate = {
    ...(input.contract as any),
    exchangeRateRON: fx.rate,
  } as Contract;

  const baseInvoice = computeInvoiceFromContract({
    contract: contractWithRate,
    issuedAt,
    amountEUROverride: effectiveAmountEUR,
    billedAt,
  });

  const previewToken = buildPreviewToken({
    contractId: baseInvoice.contractId,
    partnerKey: input.partnerKey,
    issuedAt,
    kind: input.kind,
    periodFrom: effectiveRange.from,
    periodTo: effectiveRange.to,
    billedAt,
    computedAmountEUR,
    effectiveAmountEUR,
    exchangeRateRON: fx.rate,
    exchangeRateDate: fx.date,
  });

  const invoice = {
    ...baseInvoice,
    kind: input.kind,
    billedAt,
    periodFrom: effectiveRange.from,
    periodTo: effectiveRange.to,
    autoAmountEUR: computedAmountEUR,
    amountSource:
      typeof input.manualAmountEUR === "number" && input.manualAmountEUR > 0
        ? "manual"
        : "auto",
    manualOverrideEUR: input.manualAmountEUR,
    exchangeRateDate: fx.date,
    issuedByEmail: input.issuedByEmail,
    previewToken,
  } as any;

  return {
    invoice,
    kind: input.kind,
    billedAt,
    periodFrom: effectiveRange.from,
    periodTo: effectiveRange.to,
    totalDays: listDaysInRange(targetRange).length,
    billedDays: uncoveredDays.length,
    computedAmountEUR,
    effectiveAmountEUR,
    exchangeRateDate: fx.date,
    exchangeRateRON: fx.rate,
    previewToken,
  };
}

export function validatePreviewToken(preview: InvoicePreviewResult, token: string | null | undefined): boolean {
  if (!token) return false;
  return preview.previewToken === token;
}
