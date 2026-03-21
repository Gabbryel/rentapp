/**
 * One-time script: sync the MongoDB invoice_settings counter to 124.
 *
 * Background: all invoices have ownerId=null, so allocateInvoiceNumber uses
 * ownerKey(null, "MARKOV SERVICES SRL") → "markov-services-srl". But the
 * MongoDB collection only had a miskeyed document (id="o_1760275364606") from
 * an old migration; the allocateMongo function also had a ConflictingUpdateOperators
 * bug that caused EVERY allocation to fall back to the local file store
 * (markov-services-srl in .data/invoice_settings.json). That local counter is
 * now at 124 after renumbering 29 duplicate invoices.
 *
 * This script:
 * 1. Upserts the "markov-services-srl" MongoDB invoice_settings document with
 *    nextNumber=124 (using replaceOne+upsert so it's idempotent and safe).
 * 2. Checks the stale "o_1760275364606" document (leaves it alone; it is unused).
 *
 * Result: next invoice issued by the app will get MS-2026-00124.
 */

import { getDb } from "../lib/mongodb";

async function main() {
  const db = await getDb();
  const col = db.collection("invoice_settings");
  const ACTIVE_KEY = "markov-services-srl";
  const TARGET = 124;

  // Show current state
  const all = await col.find({}).toArray();
  console.log("Current invoice_settings documents:");
  for (const d of all) {
    console.log(`  id=${d.id}  nextNumber=${d.nextNumber}  updatedAt=${d.updatedAt}`);
  }

  const existing = all.find((d) => d.id === ACTIVE_KEY);
  if (existing && (existing.nextNumber as number) >= TARGET) {
    console.log(`\n"${ACTIVE_KEY}" already has nextNumber=${existing.nextNumber} ≥ ${TARGET}. Nothing to do.`);
    process.exit(0);
  }

  // Upsert the canonical document
  const res = await col.replaceOne(
    { id: ACTIVE_KEY },
    {
      id: ACTIVE_KEY,
      series: "MS",
      padWidth: 5,
      includeYear: true,
      nextNumber: TARGET,
      updatedAt: new Date().toISOString(),
    },
    { upsert: true }
  );
  console.log(`\nreplaceOne → matched:${res.matchedCount} modified:${res.modifiedCount} upserted:${res.upsertedCount}`);

  const after = await col.findOne({ id: ACTIVE_KEY });
  console.log("After:", JSON.stringify(after, null, 2));

  if ((after?.nextNumber as number) >= TARGET) {
    console.log(`\n✅ MongoDB counter for "${ACTIVE_KEY}" is now ${after?.nextNumber}.`);
    console.log(`   Next invoice will be MS-${new Date().getFullYear()}-${String(TARGET).padStart(5, "0")}.`);
  } else {
    console.error("❌ Counter was NOT set as expected.");
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
