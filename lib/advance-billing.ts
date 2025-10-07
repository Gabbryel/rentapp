import { effectiveEndDate } from "@/lib/contracts";
import type { Contract } from "@/lib/schemas/contract";

/**
 * Compute whether a NEXT-mode (advance) monthly invoice for a given issue month
 * should be included and (if partial) what fraction of the NEXT calendar month
 * is actually covered by the contract.
 *
 * Business rules (as discussed):
 * 1. Exclude entirely if the contract does NOT overlap the next month at all.
 * 2. Exclude if the contract ends on day 1 or day 2 of the next month.
 * 3. If the contract ends on day >= 3 but before the end of next month => partial (prorated) invoice.
 * 4. If the contract covers the whole next month => full invoice (fraction = 1).
 */
export function computeNextMonthProration(
  contract: Contract,
  issueYear: number,
  issueMonth: number // 1-12
): { include: boolean; fraction: number } {
  // Only meaningful for monthly rent & invoiceMonthMode === 'next'
  if (contract.rentType !== "monthly") return { include: false, fraction: 0 };
  const mode = (contract as any).invoiceMonthMode === "next" ? "next" : "current";
  if (mode !== "next") return { include: false, fraction: 0 };

  const start = new Date(contract.startDate);
  const end = new Date(effectiveEndDate(contract));

  const nextMonth = issueMonth + 1;
  const nextYear = nextMonth === 13 ? issueYear + 1 : issueYear;
  const nextMonthIdx = nextMonth === 13 ? 1 : nextMonth; // 1-12
  const daysInNextMonth = new Date(nextYear, nextMonthIdx, 0).getDate();
  const nextStart = new Date(nextYear, nextMonthIdx - 1, 1);
  const nextEnd = new Date(nextYear, nextMonthIdx - 1, daysInNextMonth);

  // Rule 1: must overlap next month
  const overlapsNext = !(end < nextStart || start > nextEnd);
  if (!overlapsNext) return { include: false, fraction: 0 };

  // Determine coverage end within next month
  let coverageEndDay: number;
  if (end < nextStart) {
    return { include: false, fraction: 0 }; // safety
  } else if (end > nextEnd) {
    coverageEndDay = daysInNextMonth; // full
  } else if (
    end.getFullYear() === nextYear &&
    end.getMonth() === nextStart.getMonth()
  ) {
    coverageEndDay = end.getDate();
  } else {
    // Unexpected branch; treat as no inclusion
    return { include: false, fraction: 0 };
  }

  // Rule 2: exclude if ends day 1 or 2 of next month
  if (coverageEndDay <= 2) return { include: false, fraction: 0 };

  // Full vs partial
  if (coverageEndDay >= daysInNextMonth) {
    return { include: true, fraction: 1 };
  }
  const fraction = coverageEndDay / daysInNextMonth;
  return { include: true, fraction };
}
