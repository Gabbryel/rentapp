/**
 * Focused tests for custom-period invoice preview logic.
 * Run with: tsx __tests__/custom-period-invoice.test.ts
 */

import { ContractSchema, type Contract } from "../lib/schemas/contract";
import { InvoiceSchema, type Invoice } from "../lib/schemas/invoice";
import { prepareInvoicePreview } from "../lib/invoice-custom-period";
import { rentAmountAtDate } from "../lib/contracts";

class TestRunner {
  private tests: { name: string; fn: () => Promise<void> | void }[] = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void> | void) {
    this.tests.push({ name, fn });
  }

  expect<T>(value: T) {
    return {
      toBe: (expected: T) => {
        if (value !== expected) {
          throw new Error(`Expected ${String(expected)}, got ${String(value)}`);
        }
      },
      toContain: (expected: string) => {
        const asString = String(value);
        if (!asString.includes(expected)) {
          throw new Error(`Expected \"${asString}\" to contain \"${expected}\"`);
        }
      },
    };
  }

  async run() {
    console.log(`\n🔍 custom-period invoice tests (${this.tests.length})\n`);
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (e) {
        console.log(`❌ ${name}: ${(e as Error).message}`);
        this.failed++;
      }
    }
    console.log(`\n📊 ${this.passed} passed, ${this.failed} failed\n`);
    if (this.failed) process.exit(1);
  }
}

const runner = new TestRunner();

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return ContractSchema.parse({
    id: "c-custom-test",
    name: "Contract Test",
    partner: "Partner Test",
    partnerId: "partner-1",
    owner: "Owner Test",
    ownerId: "owner-1",
    signedAt: "2026-01-01",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    rentType: "monthly",
    invoiceMonthMode: "next",
    monthlyInvoiceDay: 20,
    exchangeRateRON: 5,
    tvaPercent: 19,
    correctionPercent: 0,
    indexingDates: [
      {
        forecastDate: "2026-01-01",
        actualDate: "2026-01-01",
        newRentAmount: 3100,
        done: true,
      },
    ],
    scans: [],
    ...overrides,
  });
}

function makeInvoice(overrides: Partial<Invoice> & { id: string; issuedAt: string }): Invoice {
  const base: Record<string, unknown> = {
    id: overrides.id,
    number: overrides.id,
    contractId: "c-custom-test",
    contractName: "Contract Test",
    issuedAt: overrides.issuedAt,
    dueDays: 0,
    ownerId: "owner-1",
    owner: "Owner Test",
    partnerId: "partner-1",
    partner: "Partner Test",
    amountEUR: 100,
    correctionPercent: 0,
    correctedAmountEUR: 100,
    exchangeRateRON: 5,
    netRON: 500,
    tvaPercent: 19,
    vatRON: 95,
    totalRON: 595,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };

  return InvoiceSchema.parse({
    ...base,
    ...overrides,
    id: overrides.id,
    issuedAt: overrides.issuedAt,
  });
}

runner.test("custom period uses inclusive to_date", async () => {
  const contract = makeContract();
  const preview = await prepareInvoicePreview({
    contract,
    existingInvoices: [],
    issuedAt: "2026-02-26",
    kind: "custom_period",
    fromDate: "2026-03-10",
    toDate: "2026-03-20",
    exchangeRateOverride: { rate: 5, date: "2026-03-10" },
  });

  if (!preview) throw new Error("Expected preview");
  runner.expect(preview.billedDays).toBe(11);
  runner.expect(Number(preview.computedAmountEUR.toFixed(2))).toBe(1100);
});

runner.test("custom period rejects overlaps", async () => {
  const contract = makeContract();
  const existing = makeInvoice({
    id: "MS-2026-00001",
    issuedAt: "2026-03-01",
    kind: "custom_period",
    periodFrom: "2026-04-10",
    periodTo: "2026-04-25",
  } as any);

  let errorMessage = "";
  try {
    await prepareInvoicePreview({
      contract,
      existingInvoices: [existing],
      issuedAt: "2026-03-20",
      kind: "custom_period",
      fromDate: "2026-04-20",
      toDate: "2026-04-30",
      exchangeRateOverride: { rate: 5, date: "2026-04-20" },
    });
  } catch (error) {
    errorMessage = (error as Error).message;
  }

  runner.expect(errorMessage).toContain("suprapune");
});

runner.test("default issue invoices only remaining days", async () => {
  const contract = makeContract({
    indexingDates: [
      {
        forecastDate: "2026-01-01",
        document: undefined,
        actualDate: "2026-01-01",
        newRentAmount: 3000,
        done: true,
      },
    ],
  });

  const existing = makeInvoice({
    id: "MS-2026-00002",
    issuedAt: "2026-02-26",
    kind: "custom_period",
    periodFrom: "2026-03-15",
    periodTo: "2026-04-15",
  } as any);

  const preview = await prepareInvoicePreview({
    contract,
    existingInvoices: [existing],
    issuedAt: "2026-03-20",
    kind: "standard",
    exchangeRateOverride: { rate: 5, date: "2026-04-01" },
  });

  if (!preview) throw new Error("Expected preview");
  runner.expect(preview.periodFrom).toBe("2026-04-16");
  runner.expect(preview.periodTo).toBe("2026-04-30");
  runner.expect(preview.billedDays).toBe(15);
  runner.expect(preview.totalDays).toBe(30);
  runner.expect(Number(preview.computedAmountEUR.toFixed(2))).toBe(1500);
});

runner.test("default issue matches existing coverage by partnerId or partner name", async () => {
  const contract = makeContract({
    partnerId: "p-sabex",
    partner: "Sabex Medical S.R.L",
    indexingDates: [
      {
        forecastDate: "2026-01-01",
        document: undefined,
        actualDate: "2026-01-01",
        newRentAmount: 3000,
        done: true,
      },
    ],
  });

  const existing = makeInvoice({
    id: "MS-2026-00003",
    issuedAt: "2026-03-15",
    partnerId: "Sabex Medical S.R.L",
    partner: "Sabex Medical S.R.L",
    kind: "custom_period",
    periodFrom: "2026-03-15",
    periodTo: "2026-04-15",
  } as any);

  const preview = await prepareInvoicePreview({
    contract,
    existingInvoices: [existing],
    issuedAt: "2026-03-20",
    kind: "standard",
    partnerKey: [contract.partnerId || "", contract.partner || ""],
    exchangeRateOverride: { rate: 5, date: "2026-04-01" },
  });

  if (!preview) throw new Error("Expected preview");
  runner.expect(preview.periodFrom).toBe("2026-04-16");
  runner.expect(preview.periodTo).toBe("2026-04-30");
  runner.expect(preview.billedDays).toBe(15);
  runner.expect(Number(preview.computedAmountEUR.toFixed(2))).toBe(1500);
});

runner.test("rent fallback works before first indexing date", () => {
  const contract = makeContract({
    indexingDates: [
      {
        forecastDate: "2027-01-15",
        document: undefined,
        actualDate: undefined,
        newRentAmount: 826.44,
        done: false,
      },
    ],
  });

  const amount = rentAmountAtDate(contract, "2026-03-15");
  runner.expect(Number((amount ?? 0).toFixed(2))).toBe(826.44);
});

runner.run();
