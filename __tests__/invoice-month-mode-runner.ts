/**
 * Test runner for invoiceMonthMode functionality
 * Run with: node --loader tsx/esm __tests__/invoice-month-mode-runner.ts
 */

import type { Contract } from '../lib/schemas/contract';

// Simple test framework
class TestRunner {
  private tests: { name: string; fn: () => void }[] = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  expect(value: any) {
    return {
      toBe: (expected: any) => {
        if (value !== expected) {
          throw new Error(`Expected ${expected}, got ${value}`);
        }
      },
      toHaveLength: (expected: number) => {
        if (value.length !== expected) {
          throw new Error(`Expected length ${expected}, got ${value.length}`);
        }
      }
    };
  }

  async run() {
    console.log(`\n🧪 Running ${this.tests.length} tests...\n`);
    
    for (const { name, fn } of this.tests) {
      try {
        fn();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name}: ${(error as Error).message}`);
        this.failed++;
      }
    }
    
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed\n`);
    
    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

const runner = new TestRunner();

// Mock data setup
const createMockContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 'test-contract-001',
  name: 'Test Contract',
  partner: 'Test Partner',
  owner: 'Test Owner',
  signedAt: '2024-01-01',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  rentType: 'monthly',
  invoiceMonthMode: 'current',
  monthlyInvoiceDay: 15,
  amountEUR: 1000,
  exchangeRateRON: 5.0,
  tvaPercent: 19,
  correctionPercent: 0,
  scans: [],
  rentHistory: [],
  ...overrides,
});

// Helper function to calculate stats like the API route does
function calculateStatsForContract(
  contract: Contract,
  year: number,
  month: number
): {
  monthlyPrognosis: number;
  annualPrognosis: number;
} {
  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);
  const currentYear = year;
  
  const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const currentMonthStart = new Date(year, month - 1, 1);
  const currentMonthEnd = new Date(year, month - 1, daysInMonth(year, month));
  
  if (!contract.amountEUR || !contract.exchangeRateRON) {
    return { monthlyPrognosis: 0, annualPrognosis: 0 };
  }
  
  const corrPct = contract.correctionPercent || 0;
  const tvaPct = contract.tvaPercent || 0;
  const correctedEUR = contract.amountEUR * (1 + corrPct / 100);
  const netRON = correctedEUR * contract.exchangeRateRON;
  const vatRON = netRON * (tvaPct / 100);
  const totalRON = netRON + vatRON;
  
  let monthlyPrognosis = 0;
  let annualPrognosis = 0;
  
  if (contract.rentType === 'monthly') {
    const mode = (contract as any).invoiceMonthMode === 'next' ? 'next' : 'current';
    
    for (let mIdx = 1; mIdx <= 12; mIdx++) {
      const mStart = new Date(year, mIdx - 1, 1);
      const mEnd = new Date(year, mIdx - 1, daysInMonth(year, mIdx));
      if (end < mStart || start > mEnd) continue; // contract inactive this month

      if (mode === 'next') {
        // Apply proration rules similar to production logic
        const nextMonth = mIdx + 1;
        const nextYear = nextMonth === 13 ? year + 1 : year;
        const nextMonthIdx = nextMonth === 13 ? 1 : nextMonth;
        const daysNext = daysInMonth(nextYear, nextMonthIdx);
        const nextStart = new Date(nextYear, nextMonthIdx - 1, 1);
        const nextEnd = new Date(nextYear, nextMonthIdx - 1, daysNext);
        const overlapsNext = !(end < nextStart || start > nextEnd);
        if (!overlapsNext) {
          // Skip: no annual or monthly addition
        } else {
          // Determine coverage end day within next month
            let coverageEndDay: number;
            if (end > nextEnd) {
              coverageEndDay = daysNext; // full
            } else if (
              end.getFullYear() === nextYear && end.getMonth() === nextStart.getMonth()
            ) {
              coverageEndDay = end.getDate();
            } else {
              coverageEndDay = daysNext; // assume full if irregular
            }
            if (coverageEndDay <= 2) {
              // Excluded (no addition)
            } else {
              const fraction = coverageEndDay >= daysNext ? 1 : coverageEndDay / daysNext;
              const fNetRON = netRON * fraction;
              const fVatRON = fNetRON * (tvaPct / 100);
              const fTotalRON = fNetRON + fVatRON;
              annualPrognosis += fTotalRON;
              if (mIdx === month) {
                monthlyPrognosis += fTotalRON;
              }
            }
        }
      } else {
        // Current mode: full value
        annualPrognosis += totalRON;
        if (mIdx === month) monthlyPrognosis += totalRON;
      }
    }
  }
  
  return { monthlyPrognosis, annualPrognosis };
}

// Tests
runner.test('Current mode includes all active months in annual prognosis', () => {
  const contract = createMockContract({
    invoiceMonthMode: 'current',
    startDate: '2024-03-01',
    endDate: '2024-10-31', // 8 months active
  });
  
  const stats = calculateStatsForContract(contract, 2024, 6);
  
  // Should include 8 months: 8 * 5950 = 47600 RON
  runner.expect(stats.annualPrognosis).toBe(47600);
});

runner.test('Next mode excludes final month from annual prognosis if contract ends before next month', () => {
  const contract = createMockContract({
    invoiceMonthMode: 'next',
    startDate: '2024-03-01',
    endDate: '2024-10-31', // ends October 31
  });
  
  const stats = calculateStatsForContract(contract, 2024, 6);
  
  // Should include March through September (7 months): 7 * 5950 = 41650 RON
  runner.expect(stats.annualPrognosis).toBe(41650);
});

runner.test('Next mode handles December to January transition correctly', () => {
  const contract = createMockContract({
    invoiceMonthMode: 'next',
    startDate: '2024-01-01',
    endDate: '2024-12-31', // ends December 31
  });
  
  const stats = calculateStatsForContract(contract, 2024, 12); // December
  
  // December invoice would be for January 2025, but contract ends Dec 31, 2024
  runner.expect(stats.monthlyPrognosis).toBe(0);
});

runner.test('Next mode includes December billing when contract extends to next year', () => {
  const contract = createMockContract({
    invoiceMonthMode: 'next',
    startDate: '2024-01-01',
    endDate: '2025-06-30', // extends into next year
  });
  
  const stats = calculateStatsForContract(contract, 2024, 12); // December
  
  // December invoice covers January 2025, which is within contract period
  runner.expect(stats.monthlyPrognosis).toBe(5950);
});

runner.test('Current mode includes current month if contract is active', () => {
  const contract = createMockContract({
    invoiceMonthMode: 'current',
    startDate: '2024-06-01',
    endDate: '2024-12-31',
  });
  
  const stats = calculateStatsForContract(contract, 2024, 6);
  runner.expect(stats.monthlyPrognosis).toBe(5950);
});

runner.test('Next mode includes current month if next month is covered', () => {
  const contract = createMockContract({
    invoiceMonthMode: 'next',
    startDate: '2024-06-01',
    endDate: '2024-12-31', // covers July
  });
  
  const stats = calculateStatsForContract(contract, 2024, 6); // June
  runner.expect(stats.monthlyPrognosis).toBe(5950); // Invoice in June covers July
});

runner.test('Next mode excludes current month if next month not covered', () => {
  const contract = createMockContract({
    invoiceMonthMode: 'next',
    startDate: '2024-06-01',
    endDate: '2024-06-30', // ends June 30, does not cover July
  });
  
  const stats = calculateStatsForContract(contract, 2024, 6); // June
  runner.expect(stats.monthlyPrognosis).toBe(0); // Invoice would cover July, but contract ends June 30
});

// New stricter rules & proration tests
runner.test('Next mode excludes invoice when contract ends on day 1 of next month', () => {
  // June issue, contract ends July 1 => should exclude advance invoice for July
  const contract = createMockContract({
    invoiceMonthMode: 'next',
    startDate: '2024-01-01',
    endDate: '2024-07-01',
  });
  const stats = calculateStatsForContract(contract, 2024, 6); // June
  runner.expect(stats.monthlyPrognosis).toBe(0);
});

runner.test('Next mode excludes invoice when contract ends on day 2 of next month', () => {
  const contract = createMockContract({
    invoiceMonthMode: 'next',
    startDate: '2024-01-01',
    endDate: '2024-07-02',
  });
  const stats = calculateStatsForContract(contract, 2024, 6); // June
  runner.expect(stats.monthlyPrognosis).toBe(0);
});

runner.test('Next mode prorates when contract ends mid-next month (after day 2)', () => {
  const contract = createMockContract({
    invoiceMonthMode: 'next',
    startDate: '2024-01-01',
    endDate: '2024-07-10', // July 10 => partial (approx 10/31 days)
  });
  const stats = calculateStatsForContract(contract, 2024, 6); // June
  // Previous logic would have counted full; new proration should scale ~ fraction
  // Base full total RON per month = 5950. Fraction = 10/31 ≈ 0.3226
  const expected = Math.round(5950 * (10 / 31));
  // Allow small rounding variance; we stored integer rounding here vs actual implementation may use precise float.
  const withinTolerance = (val: number, target: number, tol: number) => Math.abs(val - target) <= tol;
  if (!withinTolerance(stats.monthlyPrognosis, expected, 5)) {
    throw new Error(`Expected prorated ~${expected} (+/-5), got ${stats.monthlyPrognosis}`);
  }
});

runner.test('Migration identifies contracts needing invoiceMonthMode field', () => {
  const contractsToTest = [
    createMockContract({ invoiceMonthMode: 'current' }), // already set
    createMockContract({ invoiceMonthMode: 'next' }), // already set
    createMockContract({}), // default current should be set
  ];
  
  // Remove invoiceMonthMode from the third contract to simulate old data
  delete (contractsToTest[2] as any).invoiceMonthMode;
  
  const needsMigration = contractsToTest.filter(c => 
    !(c as any).invoiceMonthMode || (c as any).invoiceMonthMode === ""
  );
  
  runner.expect(needsMigration).toHaveLength(1);
});

runner.test('Handles missing financial data gracefully', () => {
  const contract = createMockContract({
    invoiceMonthMode: 'next',
    amountEUR: undefined,
    exchangeRateRON: undefined,
  });
  
  const stats = calculateStatsForContract(contract, 2024, 6);
  runner.expect(stats.monthlyPrognosis).toBe(0);
  runner.expect(stats.annualPrognosis).toBe(0);
});

// Run all tests
runner.run();