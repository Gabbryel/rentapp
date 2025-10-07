#!/usr/bin/env tsx
/**
 * Migration script to set invoiceMonthMode to "current" for existing contracts
 * that don't have this field explicitly set.
 * 
 * Usage: 
 *   npm run tsx scripts/migrate-invoice-month-mode.ts [--dry-run] [--force]
 */

import { getDb } from "../lib/mongodb";
import { fetchContracts, upsertContract } from "../lib/contracts";
import { readJson, writeJson } from "../lib/local-store";
import type { Contract } from "../lib/schemas/contract";

const isDryRun = process.argv.includes("--dry-run");
const isForce = process.argv.includes("--force");

async function migrateContracts() {
  console.log("🔄 Starting invoiceMonthMode migration...");
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "EXECUTE"}`);
  
  let totalContracts = 0;
  let updatedContracts = 0;
  let errorContracts = 0;
  
  try {
    if (process.env.MONGODB_URI) {
      console.log("📊 Using MongoDB...");
      const db = await getDb();
      const collection = db.collection<Contract>("contracts");
      
      // Find contracts without invoiceMonthMode or with undefined/null value
      const query = {
        invoiceMonthMode: { $exists: false }
      };
      
      const contracts = await collection.find(query as any, { projection: { _id: 0 } }).toArray();
      totalContracts = contracts.length;
      
      console.log(`📋 Found ${totalContracts} contracts needing migration`);
      
      if (totalContracts === 0) {
        console.log("✅ No contracts need migration!");
        return;
      }
      
      if (!isDryRun && !isForce) {
        console.log("⚠️  This will modify database records. Use --dry-run to preview or --force to execute.");
        process.exit(1);
      }
      
      for (const contract of contracts) {
        try {
          console.log(`  📝 ${contract.id} (${contract.name}) - setting invoiceMonthMode to "current"`);
          
          if (!isDryRun) {
            await collection.updateOne(
              { id: contract.id },
              { $set: { invoiceMonthMode: "current" } }
            );
          }
          
          updatedContracts++;
        } catch (error) {
          console.error(`  ❌ Error updating contract ${contract.id}:`, error);
          errorContracts++;
        }
      }
      
    } else {
      console.log("📁 Using local JSON file...");
      const contracts = await readJson<Contract[]>("contracts.json", []);
      totalContracts = contracts.length;
      
      console.log(`📋 Found ${totalContracts} total contracts`);
      
      const contractsToUpdate = contracts.filter(c => 
        !(c as any).invoiceMonthMode || (c as any).invoiceMonthMode === "" || (c as any).invoiceMonthMode === null
      );
      
      console.log(`📋 Found ${contractsToUpdate.length} contracts needing migration`);
      
      if (contractsToUpdate.length === 0) {
        console.log("✅ No contracts need migration!");
        return;
      }
      
      if (!isDryRun && !isForce) {
        console.log("⚠️  This will modify the contracts.json file. Use --dry-run to preview or --force to execute.");
        process.exit(1);
      }
      
      for (const contract of contractsToUpdate) {
        try {
          console.log(`  📝 ${contract.id} (${contract.name}) - setting invoiceMonthMode to "current"`);
          
          if (!isDryRun) {
            (contract as any).invoiceMonthMode = "current";
          }
          
          updatedContracts++;
        } catch (error) {
          console.error(`  ❌ Error updating contract ${contract.id}:`, error);
          errorContracts++;
        }
      }
      
      if (!isDryRun && updatedContracts > 0) {
        await writeJson("contracts.json", contracts);
        console.log("💾 Updated contracts.json file");
      }
    }
    
    console.log("\n📊 Migration Summary:");
    console.log(`  Total contracts examined: ${totalContracts}`);
    console.log(`  Contracts updated: ${updatedContracts}`);
    console.log(`  Errors encountered: ${errorContracts}`);
    
    if (isDryRun) {
      console.log("\n🔍 This was a dry run. Use --force to execute the migration.");
    } else {
      console.log("\n✅ Migration completed successfully!");
    }
    
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
}

// Add audit logging for the migration
async function logMigration(updatedCount: number) {
  try {
    const { logAction } = await import("../lib/audit");
    await logAction({
      action: "migration.invoiceMonthMode",
      targetType: "system",
      targetId: "contracts",
      meta: { 
        updatedContracts: updatedCount,
        defaultValue: "current",
        timestamp: new Date().toISOString()
      },
    });
  } catch (error) {
    console.warn("⚠️  Could not log migration to audit trail:", error);
  }
}

if (require.main === module) {
  migrateContracts().catch(console.error);
}

export { migrateContracts };