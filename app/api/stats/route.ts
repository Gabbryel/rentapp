import { NextResponse } from "next/server";
import { fetchContracts, effectiveEndDate } from "@/lib/contracts";
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

export async function GET() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const contracts = await fetchContracts();
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
    for (const inv of invoicesYear) {
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
  const amountEURBase = safeNum((c as any).rentAmountEuro);
      const corrPct = safeNum((c as any).correctionPercent) ?? 0;
      const tvaPct = safeNum((c as any).tvaPercent) ?? 0;
      if (!rate || !amountEURBase) continue;
      // Per occurrence values
  const correctedEUR = amountEURBase * (1 + corrPct / 100); // EUR net
  const netRON = correctedEUR * rate; // RON fără TVA
  const vatRON = netRON * (tvaPct / 100);
  const totalRON = netRON + vatRON; // RON cu TVA

      if (c.rentType === "monthly") {
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
              const fNetRON = netRON * fraction;
              const fVatRON = fNetRON * (tvaPct / 100);
              const fTotalRON = fNetRON + fVatRON;
              prognosisAnnualRON += fTotalRON;
              prognosisAnnualEUR += fCorrectedEUR;
              prognosisAnnualNetRON += fNetRON;
              // Skip default add below
              if (mIdx !== month) continue; // monthly prognosis handled separately
            } else if (!include) {
              continue; // skip entirely for annual
            }
          }
          
          if (includeInAnnual && mode !== "next") {
            prognosisAnnualRON += totalRON;
            prognosisAnnualEUR += correctedEUR;
            prognosisAnnualNetRON += netRON;
          }
          if (mIdx === month) {
            if (!(end < currentMonthStart || start > currentMonthEnd)) {
              // Mode current: invoice reflects current active month
              if (mode === "current") {
                prognosisMonthRON += totalRON;
                prognosisMonthEUR += correctedEUR;
                prognosisMonthNetRON += netRON;
              } else {
                const { include, fraction } = computeNextMonthProration(c as any, year, month);
                if (include) {
                  if (fraction > 0 && fraction < 1) {
                    const fCorrectedEUR = correctedEUR * fraction;
                    const fNetRON = netRON * fraction;
                    const fVatRON = fNetRON * (tvaPct / 100);
                    const fTotalRON = fNetRON + fVatRON;
                    prognosisMonthRON += fTotalRON;
                    prognosisMonthEUR += fCorrectedEUR;
                    prognosisMonthNetRON += fNetRON;
                  } else {
                    prognosisMonthRON += totalRON;
                    prognosisMonthEUR += correctedEUR;
                    prognosisMonthNetRON += netRON;
                  }
                }
              }
            }
          }
        }
      } else if (c.rentType === "yearly") {
        const entries = (c as any).yearlyInvoices as { month: number; day: number; amountEUR: number }[] | undefined;
        if (entries) {
          for (const yi of entries) {
            if (yi.month < 1 || yi.month > 12) continue;
            const yDate = new Date(year, yi.month - 1, Math.min(yi.day, daysInMonth(year, yi.month)));
            if (yDate < start || yDate > end) continue;
            const yearlyAmt = safeNum(yi.amountEUR);
            if (!yearlyAmt) continue;
            const yCorrected = yearlyAmt * (1 + corrPct / 100);
            const yNet = yCorrected * rate; // fără TVA
            const yVat = yNet * (tvaPct / 100);
            const yTotal = yNet + yVat; // cu TVA
            prognosisAnnualRON += yTotal;
            prognosisAnnualEUR += yCorrected;
            prognosisAnnualNetRON += yNet;
            if (yi.month === month && yDate >= currentMonthStart && yDate <= currentMonthEnd) {
              prognosisMonthRON += yTotal;
              prognosisMonthEUR += yCorrected;
              prognosisMonthNetRON += yNet;
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
