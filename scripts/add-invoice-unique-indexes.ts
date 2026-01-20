/**
 * Migration script: Add unique compound indexes to invoices collection
 * 
 * This prevents duplicate invoices for the same contract+partner+date
 * Run with: tsx scripts/add-invoice-unique-indexes.ts
 */

import { getDb } from "@/lib/mongodb";

async function main() {
  console.log("Starting invoice unique indexes migration...\n");

  try {
    const db = await getDb();
    const collection = db.collection("invoices");

    console.log("Checking for existing indexes...");
    const existingIndexes = await collection.indexes();
    console.log("Existing indexes:", existingIndexes.map(idx => idx.name).join(", "));

    // Index 1: For invoices with partnerId
    console.log("\nCreating unique index on (contractId, partnerId, issuedAt)...");
    try {
      await collection.createIndex(
        { contractId: 1, partnerId: 1, issuedAt: 1 },
        {
          unique: true,
          partialFilterExpression: {
            partnerId: { $type: "string", $ne: "" }
          },
          name: "unique_invoice_contract_partner_date"
        }
      );
      console.log("✅ Created unique_invoice_contract_partner_date index");
    } catch (error: any) {
      if (error.code === 85 || error.codeName === "IndexOptionsConflict") {
        console.log("ℹ️  Index already exists with different options, dropping and recreating...");
        await collection.dropIndex("unique_invoice_contract_partner_date");
        await collection.createIndex(
          { contractId: 1, partnerId: 1, issuedAt: 1 },
          {
            unique: true,
            partialFilterExpression: {
              partnerId: { $type: "string", $ne: "" }
            },
            name: "unique_invoice_contract_partner_date"
          }
        );
        console.log("✅ Recreated unique_invoice_contract_partner_date index");
      } else if (error.code === 11000) {
        console.log("⚠️  Duplicate key error - there are duplicate invoices in the database!");
        console.log("Run this query to find duplicates:");
        console.log(`  db.invoices.aggregate([
    { $match: { partnerId: { $type: "string", $ne: "" } } },
    { $group: { _id: { contractId: "$contractId", partnerId: "$partnerId", issuedAt: "$issuedAt" }, count: { $sum: 1 }, ids: { $push: "$id" } } },
    { $match: { count: { $gt: 1 } } }
  ])`);
        throw error;
      } else {
        throw error;
      }
    }

    // Index 2: For invoices with partner name but no partnerId
    console.log("\nCreating unique index on (contractId, partner, issuedAt)...");
    try {
      await collection.createIndex(
        { contractId: 1, partner: 1, issuedAt: 1 },
        {
          unique: true,
          partialFilterExpression: {
            $and: [
              { partnerId: { $exists: false } },
              { partner: { $type: "string", $ne: "" } }
            ]
          },
          name: "unique_invoice_contract_partnername_date"
        }
      );
      console.log("✅ Created unique_invoice_contract_partnername_date index");
    } catch (error: any) {
      if (error.code === 85 || error.codeName === "IndexOptionsConflict") {
        console.log("ℹ️  Index already exists with different options, dropping and recreating...");
        await collection.dropIndex("unique_invoice_contract_partnername_date");
        await collection.createIndex(
          { contractId: 1, partner: 1, issuedAt: 1 },
          {
            unique: true,
            partialFilterExpression: {
              $and: [
                { partnerId: { $exists: false } },
                { partner: { $type: "string", $ne: "" } }
              ]
            },
            name: "unique_invoice_contract_partnername_date"
          }
        );
        console.log("✅ Recreated unique_invoice_contract_partnername_date index");
      } else if (error.code === 11000) {
        console.log("⚠️  Duplicate key error - there are duplicate invoices in the database!");
        console.log("Run this query to find duplicates:");
        console.log(`  db.invoices.aggregate([
    { $match: { partnerId: { $exists: false }, partner: { $type: "string", $ne: "" } } },
    { $group: { _id: { contractId: "$contractId", partner: "$partner", issuedAt: "$issuedAt" }, count: { $sum: 1 }, ids: { $push: "$id" } } },
    { $match: { count: { $gt: 1 } } }
  ])`);
        throw error;
      } else {
        throw error;
      }
    }

    console.log("\n✅ All indexes created successfully!");
    console.log("\nFinal index list:");
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

main();
