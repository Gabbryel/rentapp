/**
 * Test suite for invoiceMonthMode functionality
 * Covers edge cases including year boundaries and contract expiration scenarios
 */

// Test suite for invoiceMonthMode functionality
// Run with: npm test or npx jest invoice-month-mode.test.ts
import type { Contract } from '../lib/schemas/contract';

// Mock data setup
const createMockContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 'test-contract-001',
  name: 'Test Contract',
  partner: 'Test Partner',
  owner: 'Test Owner',
  signedAt: '2024-01-01',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  indexingDates: [],
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
      
      // For annual prognosis: in "next" mode, check if invoicing this month for next month makes sense
      let includeInAnnual = true;
      if (mode === 'next') {
        // In "next" mode: invoice issued in month mIdx is for month mIdx+1
        const nextMonth = mIdx + 1;
        const nextYear = nextMonth === 13 ? year + 1 : year;
        const nextMonthIdx = nextMonth === 13 ? 1 : nextMonth;
        const nextStart = new Date(nextYear, nextMonthIdx - 1, 1);
        const nextEnd = new Date(nextYear, nextMonthIdx - 1, daysInMonth(nextYear, nextMonthIdx));
        // Only count if contract will be active in the next month
        includeInAnnual = !(end < nextStart || start > nextEnd);
      }
      
      if (includeInAnnual) {
        annualPrognosis += totalRON;
      }
      
      // Monthly prognosis logic
      if (mIdx === month) {
        if (!(end < currentMonthStart || start > currentMonthEnd)) {
          // Mode current: invoice reflects current active month
          if (mode === 'current') {
            monthlyPrognosis += totalRON;
          } else {
            // Mode next: invoice issued this month for NEXT month usage
            const nextMonth = month + 1;
            const nextYear = nextMonth === 13 ? year + 1 : year;
            const nextMonthIdx = nextMonth === 13 ? 1 : nextMonth;
            const nextStart = new Date(nextYear, nextMonthIdx - 1, 1);
            const nextEnd = new Date(nextYear, nextMonthIdx - 1, daysInMonth(nextYear, nextMonthIdx));
            // Only include if contract is active for the next month window
            if (!(end < nextStart || start > nextEnd)) {
              monthlyPrognosis += totalRON;
            }
          }
        }
      }
    }
  }
  
  return { monthlyPrognosis, annualPrognosis };
}

describe('Invoice Month Mode Logic', () => {
  describe('Current Mode (default behavior)', () => {
    test('should include all active months in annual prognosis', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'current',
        startDate: '2024-03-01',
        endDate: '2024-10-31', // 8 months active
      });
      
      const stats = calculateStatsForContract(contract, 2024, 6);
      
      // Should include 8 months (March through October)
      // 1000 EUR * 5.0 RON/EUR * 1.19 (19% VAT) = 5950 RON per month
      // 8 months * 5950 = 47600 RON
      expect(stats.annualPrognosis).toBe(47600);
    });
    
    test('should include current month in monthly prognosis if contract is active', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'current',
        startDate: '2024-06-01',
        endDate: '2024-12-31',
      });
      
      const stats = calculateStatsForContract(contract, 2024, 6);
      expect(stats.monthlyPrognosis).toBe(5950); // 1000 * 5.0 * 1.19
    });
    
    test('should not include current month if contract is not active', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'current',
        startDate: '2024-07-01', // starts after current month
        endDate: '2024-12-31',
      });
      
      const stats = calculateStatsForContract(contract, 2024, 6);
      expect(stats.monthlyPrognosis).toBe(0);
    });
  });
  
  describe('Next Mode (advance billing)', () => {
    test('should exclude final month from annual prognosis if contract ends before next month', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'next',
        startDate: '2024-03-01',
        endDate: '2024-10-31', // ends October 31
      });
      
      const stats = calculateStatsForContract(contract, 2024, 6);
      
      // Should include March through September (7 months)
      // October invoice would be for November, but contract ends Oct 31
      // 7 months * 5950 = 41650 RON
      expect(stats.annualPrognosis).toBe(41650);
    });
    
    test('should include current month in monthly prognosis if next month is covered by contract', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'next',
        startDate: '2024-06-01',
        endDate: '2024-12-31', // covers July
      });
      
      const stats = calculateStatsForContract(contract, 2024, 6); // June
      expect(stats.monthlyPrognosis).toBe(5950); // Invoice in June covers July
    });
    
    test('should not include current month if next month is not covered by contract', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'next',
        startDate: '2024-06-01',
        endDate: '2024-06-30', // ends June 30, does not cover July
      });
      
      const stats = calculateStatsForContract(contract, 2024, 6); // June
      expect(stats.monthlyPrognosis).toBe(0); // Invoice in June would cover July, but contract ends June 30
    });
  });
  
  describe('End-of-Year Edge Cases', () => {
    test('should handle December to January transition in next mode', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'next',
        startDate: '2024-01-01',
        endDate: '2024-12-31', // ends December 31
      });
      
      const stats = calculateStatsForContract(contract, 2024, 12); // December
      
      // December invoice would be for January 2025, but contract ends Dec 31, 2024
      expect(stats.monthlyPrognosis).toBe(0);
    });
    
    test('should handle December to January transition with contract extending to next year', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'next',
        startDate: '2024-01-01',
        endDate: '2025-06-30', // extends into next year
      });
      
      const stats = calculateStatsForContract(contract, 2024, 12); // December
      
      // December invoice covers January 2025, which is within contract period
      expect(stats.monthlyPrognosis).toBe(5950);
    });
    
    test('should correctly calculate annual prognosis for December in next mode', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'next',
        startDate: '2024-01-01',
        endDate: '2024-12-31', // ends December 31
      });
      
      const stats = calculateStatsForContract(contract, 2024, 6);
      
      // Should include Jan through Nov (11 months)
      // December invoice would be for January 2025, but contract ends Dec 31, 2024
      // 11 months * 5950 = 65450 RON
      expect(stats.annualPrognosis).toBe(65450);
    });
    
    test('should handle contract starting in December with next mode', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'next',
        startDate: '2024-12-01',
        endDate: '2025-06-30',
      });
      
      const stats = calculateStatsForContract(contract, 2024, 12); // December
      
      // December invoice covers January 2025, which is within contract period
      expect(stats.monthlyPrognosis).toBe(5950);
      expect(stats.annualPrognosis).toBe(5950); // Only December is active in 2024
    });
  });
  
  describe('Contract Boundary Edge Cases', () => {
    test('should handle contract starting mid-month in current mode', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'current',
        startDate: '2024-06-15',
        endDate: '2024-12-31',
      });
      
      const stats = calculateStatsForContract(contract, 2024, 6); // June
      expect(stats.monthlyPrognosis).toBe(5950); // Full month billed even if starting mid-month
    });
    
    test('should handle contract ending mid-month in next mode', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'next',
        startDate: '2024-01-01',
        endDate: '2024-06-15', // ends mid-June
      });
      
      const stats = calculateStatsForContract(contract, 2024, 5); // May 
      
      // May invoice would cover June, contract ends June 15 - should be included
      expect(stats.monthlyPrognosis).toBe(5950);
      
      const juneStats = calculateStatsForContract(contract, 2024, 6); // June
      // June invoice would cover July, but contract ends June 15 - should not be included
      expect(juneStats.monthlyPrognosis).toBe(0);
    });
    
    test('should handle very short contracts in next mode', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'next',
        startDate: '2024-06-01',
        endDate: '2024-06-30', // one month only
      });
      
      const mayStats = calculateStatsForContract(contract, 2024, 5); // May
      expect(mayStats.monthlyPrognosis).toBe(0); // Contract not active in May
      
      const juneStats = calculateStatsForContract(contract, 2024, 6); // June
      expect(juneStats.monthlyPrognosis).toBe(0); // June invoice would cover July, but contract ends June 30
      
      // Annual should include just June
      expect(juneStats.annualPrognosis).toBe(0); // No valid billing periods in "next" mode
    });
  });
  
  describe('Multi-year Contracts', () => {
    test('should handle contracts spanning multiple years in next mode', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'next',
        startDate: '2023-10-01',
        endDate: '2025-03-31',
      });
      
      const stats2024 = calculateStatsForContract(contract, 2024, 6);
      
      // For 2024: should include all 12 months except December
      // December 2024 invoice would cover January 2025, which is within contract
      // So all 12 months should be included
      expect(stats2024.annualPrognosis).toBe(12 * 5950); // 71400 RON
    });
  });
  
  describe('Error Conditions and Validation', () => {
    test('should handle missing financial data gracefully', () => {
      const contract = createMockContract({
        invoiceMonthMode: 'next',
        amountEUR: undefined,
        exchangeRateRON: undefined,
      });
      
      const stats = calculateStatsForContract(contract, 2024, 6);
      expect(stats.monthlyPrognosis).toBe(0);
      expect(stats.annualPrognosis).toBe(0);
    });
    
    test('should default to current mode for undefined invoiceMonthMode', () => {
      const contract = createMockContract({
        // invoiceMonthMode: undefined (not set)
        startDate: '2024-06-01',
        endDate: '2024-12-31',
      });
      
      // Remove the field to test default behavior
      delete (contract as any).invoiceMonthMode;
      
      const stats = calculateStatsForContract(contract, 2024, 6);
      expect(stats.monthlyPrognosis).toBe(5950); // Should behave like 'current' mode
    });
  });
});

describe('Migration Script Validation', () => {
  test('should identify contracts needing invoiceMonthMode migration', () => {
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
    
    expect(needsMigration).toHaveLength(1);
    expect(needsMigration[0].id).toBe('test-contract-001');
  });
});