/**
 * Focused tests for effectiveEndDate logic.
 * Run with: tsx __tests__/effective-end-date.test.ts
 */
import { effectiveEndDate } from '../lib/contracts';
import type { Contract } from '../lib/schemas/contract';
import { ContractSchema } from '../lib/schemas/contract';

class TestRunner {
  private tests: { name: string; fn: () => void }[] = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  expect<T>(value: T) {
    return {
      toBe: (expected: T) => {
        if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
      }
    };
  }
  run() {
    console.log(`\n🔍 effectiveEndDate tests (${this.tests.length})\n`);
    for (const { name, fn } of this.tests) {
      try { fn(); console.log(`✅ ${name}`); this.passed++; } catch (e) { console.log(`❌ ${name}: ${(e as Error).message}`); this.failed++; }
    }
    console.log(`\n📊 ${this.passed} passed, ${this.failed} failed\n`);
    if (this.failed) process.exit(1);
  }
}

const runner = new TestRunner();

function base(overrides: Partial<Contract> = {}): Contract {
  const c: Partial<Contract> = {
    id: 'c-ext-test',
    name: 'Extension Test',
    partner: 'Partner',
    owner: 'Owner',
    signedAt: '2025-01-01',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    rentType: 'monthly',
    invoiceMonthMode: 'current',
    monthlyInvoiceDay: 5,
    scans: [],
    contractExtensions: [],
    ...overrides,
  };
  return ContractSchema.parse(c);
}

runner.test('No extensions returns original endDate', () => {
  const c = base();
  runner.expect(effectiveEndDate(c)).toBe('2025-12-31');
});

runner.test('Single extension replaces endDate', () => {
  const c = base({ contractExtensions: [ { docDate: '2025-06-01', document: 'Addendum 1', extendedUntil: '2026-03-31' } ] });
  runner.expect(effectiveEndDate(c)).toBe('2026-03-31');
});

runner.test('Multiple extensions selects latest date', () => {
  const c = base({ contractExtensions: [
    { docDate: '2025-06-01', document: 'Addendum 1', extendedUntil: '2026-03-31' },
    { docDate: '2025-09-15', document: 'Addendum 2', extendedUntil: '2026-05-31' },
    { docDate: '2025-11-10', document: 'Addendum 3', extendedUntil: '2026-04-30' },
  ] });
  runner.expect(effectiveEndDate(c)).toBe('2026-05-31');
});

runner.test('Unsorted extensions still yield latest date', () => {
  const c = base({ contractExtensions: [
    { docDate: '2025-09-15', document: 'Addendum 2', extendedUntil: '2026-05-31' },
    { docDate: '2025-06-01', document: 'Addendum 1', extendedUntil: '2026-03-31' },
    { docDate: '2025-11-10', document: 'Addendum 3', extendedUntil: '2026-04-30' },
  ] });
  runner.expect(effectiveEndDate(c)).toBe('2026-05-31');
});

runner.test('Schema rejects extension earlier than original endDate', () => {
  let threw = false;
  try {
    base({ contractExtensions: [ { docDate: '2025-05-01', document: 'Early', extendedUntil: '2025-11-30' } ] });
  } catch {
    threw = true;
  }
  runner.expect(threw).toBe(true);
});

runner.test('Schema rejects malformed extension entries', () => {
  let threw = false;
  try {
    base({ contractExtensions: [
      { docDate: '2025-05-01', document: 'Bad', extendedUntil: '---' } as any,
      { docDate: '2025-06-01', document: 'Good', extendedUntil: '2026-01-15' },
    ] });
  } catch {
    threw = true;
  }
  runner.expect(threw).toBe(true);
});

runner.run();
