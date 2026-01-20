/**
 * Test script for invoice number allocation
 * Run with: tsx __tests__/invoice-numbering.test.ts
 */

import { allocateInvoiceNumber } from "@/lib/invoices/numbering";

async function testSequentialAllocation() {
  console.log("Testing sequential invoice number allocation...\n");

  const ownerId = "test-owner-1";
  const ownerName = "Test Owner Ltd.";

  const numbers: string[] = [];
  
  // Allocate 5 invoice numbers sequentially
  for (let i = 0; i < 5; i++) {
    const number = await allocateInvoiceNumber(ownerId, ownerName);
    numbers.push(number);
    console.log(`Invoice ${i + 1}: ${number}`);
  }

  // Verify uniqueness
  const unique = new Set(numbers);
  if (unique.size !== numbers.length) {
    console.error("\n❌ FAIL: Duplicate invoice numbers detected!");
    console.error("Numbers:", numbers);
    process.exit(1);
  }

  // Verify sequential ordering
  const pattern = /MS-(\d{4})-(\d+)/;
  const sequences = numbers.map(n => {
    const match = n.match(pattern);
    return match ? parseInt(match[2], 10) : 0;
  });

  for (let i = 1; i < sequences.length; i++) {
    if (sequences[i] !== sequences[i - 1] + 1) {
      console.error("\n❌ FAIL: Invoice numbers are not sequential!");
      console.error("Expected sequence increment, got:", sequences);
      process.exit(1);
    }
  }

  console.log("\n✅ SUCCESS: All invoice numbers are unique and sequential");
  console.log("Sequences:", sequences);
}

async function testConcurrentAllocation() {
  console.log("\n\nTesting concurrent invoice number allocation...\n");

  const ownerId = "test-owner-2";
  const ownerName = "Concurrent Test Owner";

  // Simulate concurrent allocation (Promise.all makes them run in parallel)
  const promises = Array.from({ length: 10 }, (_, i) =>
    allocateInvoiceNumber(ownerId, ownerName)
  );

  const numbers = await Promise.all(promises);
  console.log("Allocated numbers:", numbers);

  // Verify uniqueness
  const unique = new Set(numbers);
  if (unique.size !== numbers.length) {
    console.error("\n❌ FAIL: Duplicate invoice numbers in concurrent test!");
    console.error("Duplicates found:", numbers.filter((n, i) => numbers.indexOf(n) !== i));
    process.exit(1);
  }

  console.log("\n✅ SUCCESS: All concurrent allocations produced unique numbers");
}

async function main() {
  console.log("=".repeat(60));
  console.log("Invoice Number Allocation Test Suite");
  console.log("=".repeat(60));
  console.log();

  try {
    await testSequentialAllocation();
    await testConcurrentAllocation();

    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS PASSED");
    console.log("=".repeat(60));
    process.exit(0);
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ TEST SUITE FAILED");
    console.error("=".repeat(60));
    console.error(error);
    process.exit(1);
  }
}

main();
