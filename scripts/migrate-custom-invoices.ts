/**
 * Migrate legacy yearly contracts to the custom-invoices model.
 *
 * - rentType "yearly" → "custom"
 * - irregularInvoices/yearlyInvoices [{ month, day, amountEUR }] (recurring yearly)
 *   → customInvoices [{ date: YYYY-MM-DD, amountEUR }] (explicit one-off dates),
 *   using the current year for the converted dates.
 * - Legacy irregularInvoices/yearlyInvoices fields are removed once converted.
 * - Contracts that already have customInvoices keep them (only rentType is fixed).
 *
 * Works with MongoDB when MONGODB_URI is set; otherwise migrates the local .data/contracts.json file.
 */

import { getDb } from "@/lib/mongodb";
import { readJson, writeJson } from "@/lib/local-store";
import type { Contract as ContractType } from "@/lib/schemas/contract";

type LegacyEntry = { month?: unknown; day?: unknown; amountEUR?: unknown };
type CustomEntry = { date: string; amountEUR: number };

function convertLegacyEntries(raw: any): CustomEntry[] {
  const source: LegacyEntry[] = Array.isArray(raw?.irregularInvoices)
    ? raw.irregularInvoices
    : Array.isArray(raw?.yearlyInvoices)
    ? raw.yearlyInvoices
    : [];
  const year = new Date().getFullYear();
  const out: CustomEntry[] = [];
  for (const it of source) {
    const month = Number(it?.month);
    const day = Number(it?.day);
    const amountEUR = Number(it?.amountEUR);
    if (
      Number.isInteger(month) && month >= 1 && month <= 12 &&
      Number.isInteger(day) && day >= 1 && day <= 31 &&
      Number.isFinite(amountEUR) && amountEUR > 0
    ) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      out.push({ date, amountEUR });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function migrateOne(raw: any): { changed: boolean; next: any } {
  const isLegacyYearly = raw?.rentType === "yearly";
  const hasLegacyEntries =
    (Array.isArray(raw?.irregularInvoices) && raw.irregularInvoices.length > 0) ||
    (Array.isArray(raw?.yearlyInvoices) && raw.yearlyInvoices.length > 0);
  const hasCustom = Array.isArray(raw?.customInvoices) && raw.customInvoices.length > 0;

  if (!isLegacyYearly && !(hasLegacyEntries && raw?.rentType === "custom")) {
    return { changed: false, next: raw };
  }

  const next = { ...raw };
  if (isLegacyYearly) next.rentType = "custom";
  if (!hasCustom && hasLegacyEntries) {
    const converted = convertLegacyEntries(raw);
    if (converted.length > 0) next.customInvoices = converted;
  }
  delete next.irregularInvoices;
  delete next.yearlyInvoices;
  return { changed: true, next };
}

async function migrateMongo() {
  const db = await getDb();
  const col = db.collection<ContractType>("contracts");
  const cursor = col.find({});
  let updated = 0;
  let scanned = 0;
  for await (const doc of cursor) {
    scanned += 1;
    const { changed, next } = migrateOne(doc as any);
    if (!changed) continue;
    await col.updateOne(
      { id: (doc as any).id },
      {
        $set: {
          rentType: next.rentType,
          ...(next.customInvoices ? { customInvoices: next.customInvoices } : {}),
        },
        $unset: { irregularInvoices: "", yearlyInvoices: "" },
      }
    );
    updated += 1;
    console.log(
      `Migrated ${(doc as any).id}: rentType=${next.rentType}, customInvoices=${
        JSON.stringify(next.customInvoices ?? [])
      }`
    );
  }
  console.log(`Scanned ${scanned} contracts. Updated ${updated}.`);
}

async function migrateLocalJson() {
  try {
    const list = await readJson<ContractType[]>("contracts.json", []);
    if (!Array.isArray(list) || list.length === 0) {
      console.log("No local contracts.json data found or empty. Nothing to migrate.");
      return;
    }
    let updated = 0;
    const next = list.map((c) => {
      const { changed, next } = migrateOne(c as any);
      if (changed) updated += 1;
      return next as ContractType;
    });
    if (updated > 0) {
      await writeJson("contracts.json", next);
    }
    console.log(`Local contracts: ${list.length}. Updated ${updated}.`);
  } catch (err) {
    console.error("Failed to migrate local contracts.json:", err);
  }
}

async function main() {
  if (process.env.MONGODB_URI) {
    try {
      await migrateMongo();
      return;
    } catch (err) {
      console.warn("Mongo unavailable, falling back to local JSON migration.", err);
    }
  }
  await migrateLocalJson();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
