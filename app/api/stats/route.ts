import { NextResponse } from "next/server";
import { fetchContracts, effectiveEndDate, currentRentAmount, rentAmountAtDate } from "@/lib/contracts";
import { fetchInvoicesForYearFresh } from "@/lib/invoices";
import { computeNextMonthProration } from "@/lib/advance-billing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StatPayload = {
  contractsCount: number;
  month: number;
  year: number;
  prognosisMonthRON: number;
  prognosisMonthEUR: number;
  prognosisMonthNetRON: number; // fără TVA
  actualMonthRON: number;
  actualMonthEUR: number;
  actualMonthNetRON: number; // fără TVA
  prognosisAnnualRON: number;
  prognosisAnnualEUR: number;
  prognosisAnnualNetRON: number;
  actualAnnualRON: number;
  actualAnnualEUR: number;
  actualAnnualNetRON: number;
  generatedAt: string;
};

function safeNum(v: unknown): number | undefined {
  return typeof v === "number" && isFinite(v) ? v : undefined;
}

export async function GET(req: Request) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const url = new URL(req.url);
    const ownerFilterRaw = url.searchParams.get("owner");
    const ownerIdFilter = url.searchParams.get("ownerId");
    const ownerFilter = ownerFilterRaw ? ownerFilterRaw.trim() : null;
    const all = await fetchContracts();
    const contracts = ownerFilter || ownerIdFilter
      ? all.filter((c) => {
          const name = String(((c as any).owner || "")).trim();
          const id = String(((c as any).ownerId || ""));
          return (
            (ownerFilter && name === ownerFilter) ||
            (ownerIdFilter && id === ownerIdFilter)
          );
        })
      : all;
    const contractsCount = contracts.length;
    // Actual invoices data
  // Always fetch fresh to avoid serving stale cached totals after issuance/deletion.
  const invoicesYear = await fetchInvoicesForYearFresh(year);
    const monthKey = (inv: any) => inv.issuedAt.slice(0, 7);
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    let actualMonthRON = 0; // cu TVA
    let actualMonthEUR = 0; // EUR net (corectat) – deja fără TVA
    let actualMonthNetRON = 0; // fără TVA
    let actualAnnualRON = 0; // cu TVA
    let actualAnnualEUR = 0; // EUR net (corectat)
    let actualAnnualNetRON = 0; // fără TVA
    const contractIdSet = new Set(contracts.map((c) => c.id));
    for (const inv of invoicesYear) {
      if (!contractIdSet.has((inv as any).contractId)) continue;
      const totalRON = safeNum((inv as any).totalRON) ?? 0;
      const correctedEUR = safeNum((inv as any).correctedAmountEUR) ?? 0;
      const netRON = safeNum((inv as any).netRON) ?? 0;
      actualAnnualRON += totalRON;
      actualAnnualEUR += correctedEUR;
      actualAnnualNetRON += netRON;
      if (monthKey(inv) === ym) {
        actualMonthRON += totalRON;
        actualMonthEUR += correctedEUR;
        actualMonthNetRON += netRON;
      }
    }

    // Prognosis calculations
    let prognosisMonthRON = 0; // cu TVA
    let prognosisMonthEUR = 0; // EUR net (corectat)
    let prognosisMonthNetRON = 0; // fără TVA
    let prognosisAnnualRON = 0; // cu TVA
    let prognosisAnnualEUR = 0; // EUR net (corectat)
    let prognosisAnnualNetRON = 0; // fără TVA

    const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
    const currentMonthStart = new Date(year, month - 1, 1);
    const currentMonthEnd = new Date(year, month - 1, daysInMonth(year, month));

    for (const c of contracts) {
      const start = new Date(c.startDate);
      const end = new Date(effectiveEndDate(c));
      const rate = safeNum((c as any).exchangeRateRON);
      const amountEURBase = safeNum(currentRentAmount(c as any));
      const corrPct = safeNum((c as any).correctionPercent) ?? 0;
      const tvaPct = safeNum((c as any).tvaPercent) ?? 0;

      if (c.rentType === "monthly") {
        // Skip if no base amount
        if (!amountEURBase) continue;
        // Per-occurrence values (monthly)
        const correctedEUR = amountEURBase * (1 + corrPct / 100); // EUR net
        const netRON = typeof rate === 'number' ? correctedEUR * rate : undefined; // RON fără TVA
        const vatRON = typeof netRON === 'number' ? netRON * (tvaPct / 100) : undefined;
        const totalRON = typeof netRON === 'number' ? netRON + (vatRON ?? 0) : undefined; // RON cu TVA
        const mode = (c as any).invoiceMonthMode === "next" ? "next" : "current";
        for (let mIdx = 1; mIdx <= 12; mIdx++) {
          const mStart = new Date(year, mIdx - 1, 1);
          const mEnd = new Date(year, mIdx - 1, daysInMonth(year, mIdx));
          if (end < mStart || start > mEnd) continue; // contract inactive this month
          
          // For annual prognosis: in "next" mode, check if invoicing this month for next month makes sense
          let includeInAnnual = true;
          if (mode === "next") {
            const { include, fraction } = computeNextMonthProration(c as any, year, mIdx);
            includeInAnnual = include;
            if (include && fraction > 0 && fraction < 1) {
              // Scale the amounts for partial coverage
              const fCorrectedEUR = correctedEUR * fraction;
              const fNetRON = typeof netRON === 'number' ? netRON * fraction : undefined;
              const fVatRON = typeof fNetRON === 'number' ? fNetRON * (tvaPct / 100) : undefined;
              const fTotalRON = typeof fNetRON === 'number' ? fNetRON + (fVatRON ?? 0) : undefined;
              if (typeof fTotalRON === 'number') prognosisAnnualRON += fTotalRON;
              prognosisAnnualEUR += fCorrectedEUR;
              if (typeof fNetRON === 'number') prognosisAnnualNetRON += fNetRON;
              // Skip default add below
              if (mIdx !== month) continue; // monthly prognosis handled separately
            } else if (!include) {
              continue; // skip entirely for annual
            }
          }
          
          if (includeInAnnual && mode !== "next") {
            if (typeof totalRON === 'number') prognosisAnnualRON += totalRON;
            prognosisAnnualEUR += correctedEUR;
            if (typeof netRON === 'number') prognosisAnnualNetRON += netRON;
          }
          if (mIdx === month) {
            if (!(end < currentMonthStart || start > currentMonthEnd)) {
              // Mode current: invoice reflects current active month
              if (mode === "current") {
                if (typeof totalRON === 'number') prognosisMonthRON += totalRON;
                prognosisMonthEUR += correctedEUR;
                if (typeof netRON === 'number') prognosisMonthNetRON += netRON;
              } else {
                const { include, fraction } = computeNextMonthProration(c as any, year, month);
                if (include) {
                  if (fraction > 0 && fraction < 1) {
                    const fCorrectedEUR = correctedEUR * fraction;
                    const fNetRON = typeof netRON === 'number' ? netRON * fraction : undefined;
                    const fVatRON = typeof fNetRON === 'number' ? fNetRON * (tvaPct / 100) : undefined;
                    const fTotalRON = typeof fNetRON === 'number' ? fNetRON + (fVatRON ?? 0) : undefined;
                    if (typeof fTotalRON === 'number') prognosisMonthRON += fTotalRON;
                    prognosisMonthEUR += fCorrectedEUR;
                    if (typeof fNetRON === 'number') prognosisMonthNetRON += fNetRON;
                  } else {
                    if (typeof totalRON === 'number') prognosisMonthRON += totalRON;
                    prognosisMonthEUR += correctedEUR;
                    if (typeof netRON === 'number') prognosisMonthNetRON += netRON;
                  }
                }
              }
            }
          }
        }
        // Also include any additional irregularInvoices entries defined on a monthly contract
        const extras = (c as any).irregularInvoices as { month: number; day: number; amountEUR: number }[] | undefined
          || ((c as any).yearlyInvoices as { month: number; day: number; amountEUR: number }[] | undefined);
        if (extras) {
          for (const yi of extras) {
            if (yi.month < 1 || yi.month > 12) continue;
            const yDate = new Date(year, yi.month - 1, Math.min(yi.day, daysInMonth(year, yi.month)));
            if (yDate < start || yDate > end) continue;
            const yearlyAmt = safeNum(yi.amountEUR);
            if (!yearlyAmt) continue;
            const yCorrected = yearlyAmt * (1 + corrPct / 100);
            const yNet = typeof rate === 'number' ? yCorrected * rate : undefined; // fără TVA
            const yVat = typeof yNet === 'number' ? yNet * (tvaPct / 100) : undefined;
            const yTotal = typeof yNet === 'number' ? yNet + (yVat ?? 0) : undefined; // cu TVA
            if (typeof yTotal === 'number') prognosisAnnualRON += yTotal;
            prognosisAnnualEUR += yCorrected;
            if (typeof yNet === 'number') prognosisAnnualNetRON += yNet;
            if (yi.month === month && yDate >= currentMonthStart && yDate <= currentMonthEnd) {
              if (typeof yTotal === 'number') prognosisMonthRON += yTotal;
              prognosisMonthEUR += yCorrected;
              if (typeof yNet === 'number') prognosisMonthNetRON += yNet;
            }
          }
        }
      } else if (c.rentType === "yearly") {
        const entries = (c as any).irregularInvoices as { month: number; day: number; amountEUR: number }[] | undefined
          || ((c as any).yearlyInvoices as { month: number; day: number; amountEUR: number }[] | undefined);
        if (entries) {
          for (const yi of entries) {
            if (yi.month < 1 || yi.month > 12) continue;
            const yDate = new Date(year, yi.month - 1, Math.min(yi.day, daysInMonth(year, yi.month)));
            if (yDate < start || yDate > end) continue;
            const yearlyAmt = safeNum(yi.amountEUR);
            if (!yearlyAmt) continue;
            const yCorrected = yearlyAmt * (1 + corrPct / 100);
            const yNet = typeof rate === 'number' ? yCorrected * rate : undefined; // fără TVA
            const yVat = typeof yNet === 'number' ? yNet * (tvaPct / 100) : undefined;
            const yTotal = typeof yNet === 'number' ? yNet + (yVat ?? 0) : undefined; // cu TVA
            if (typeof yTotal === 'number') prognosisAnnualRON += yTotal;
            prognosisAnnualEUR += yCorrected;
            if (typeof yNet === 'number') prognosisAnnualNetRON += yNet;
            if (yi.month === month && yDate >= currentMonthStart && yDate <= currentMonthEnd) {
              if (typeof yTotal === 'number') prognosisMonthRON += yTotal;
              prognosisMonthEUR += yCorrected;
              if (typeof yNet === 'number') prognosisMonthNetRON += yNet;
            }
          }
        }
      } else if ((c as any).rentType === "chosenDates") {
        const entries = (c as any).chosenDatesInvoicesDates as { date: string }[] | undefined;
        if (Array.isArray(entries) && entries.length > 0) {
          for (const row of entries) {
            const iso = String((row && row.date) || "").slice(0, 10);
            if (!iso) continue;
            const d = new Date(iso);
            if (isNaN(d.getTime())) continue;
            if (d < start || d > end) continue;
            if (d.getFullYear() !== year) continue;
            const baseEUR = rentAmountAtDate(c as any, iso);
            if (typeof baseEUR !== 'number') continue;
            const correctedEUR = baseEUR * (1 + (corrPct ?? 0) / 100);
            const netRON = typeof rate === 'number' ? correctedEUR * rate : undefined;
            const vatRON = typeof netRON === 'number' ? netRON * (tvaPct / 100) : undefined;
            const totalRON = typeof netRON === 'number' ? netRON + (vatRON ?? 0) : undefined;
            if (typeof totalRON === 'number') prognosisAnnualRON += totalRON;
            prognosisAnnualEUR += correctedEUR;
            if (typeof netRON === 'number') prognosisAnnualNetRON += netRON;
            // Current month bucket
            if (d.getMonth() + 1 === month) {
              if (typeof totalRON === 'number') prognosisMonthRON += totalRON;
              prognosisMonthEUR += correctedEUR;
              if (typeof netRON === 'number') prognosisMonthNetRON += netRON;
            }
          }
        }
      }
    }

    const payload: StatPayload = {
      contractsCount,
      month,
      year,
      prognosisMonthRON,
      prognosisMonthEUR,
      prognosisMonthNetRON,
      actualMonthRON,
      actualMonthEUR,
      actualMonthNetRON,
      prognosisAnnualRON,
      prognosisAnnualEUR,
      prognosisAnnualNetRON,
      actualAnnualRON,
      actualAnnualEUR,
      actualAnnualNetRON,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
