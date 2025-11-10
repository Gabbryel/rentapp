/**
 * Migrate legacy contract extension fields to the new contractExtensions model.
 *
 * Source shapes handled conservatively:
 * - Single fields: { extendedAt: YYYY-MM-DD, extensionDate: YYYY-MM-DD }
 *   → { contractExtensions: [{ docDate: extendedAt, document: "act adițional", extendedUntil: extensionDate }] }
 * - Array field: { extensions: [{ extendedAt, extensionDate, document? }] }
 *   → contractExtensions mapped row-by-row (docDate=extendedAt, extendedUntil=extensionDate)
 * - If contractExtensions already exists and has entries, the document is skipped.
 *
 * Works with MongoDB when MONGODB_URI is set; otherwise migrates the local .data/contracts.json file.
 */

import { getDb } from "@/lib/mongodb";
import { readJson, writeJson } from "@/lib/local-store";
import type { Contract as ContractType } from "@/lib/schemas/contract";

function toYmd(input: unknown): string | undefined {
  if (typeof input === "string" && input) return input.slice(0, 10);
  if (input instanceof Date && !isNaN(input.getTime())) {
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, "0");
    const d = String(input.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return undefined;
}

type LegacyRow = { extendedAt?: unknown; extensionDate?: unknown; document?: unknown };

function migrateOne(raw: any): { changed: boolean; next: any } {
  const hasNew = Array.isArray(raw?.contractExtensions) && raw.contractExtensions.length > 0;
  if (hasNew) return { changed: false, next: raw };

  const rows: { docDate: string; document: string; extendedUntil: string }[] = [];
  // Array-form legacy
  if (Array.isArray(raw?.extensions)) {
    for (const it of raw.extensions as LegacyRow[]) {
      const docDate = toYmd((it as any)?.extendedAt);
      const extendedUntil = toYmd((it as any)?.extensionDate);
      const document = String((it as any)?.document || "").trim() || "act adițional";
      if (docDate && extendedUntil) rows.push({ docDate, document, extendedUntil });
    }
  }
  // Single-field legacy
  const singleDocDate = toYmd(raw?.extendedAt);
  const singleUntil = toYmd(raw?.extensionDate);
  if (singleDocDate && singleUntil) {
    rows.push({ docDate: singleDocDate, document: "act adițional", extendedUntil: singleUntil });
  }

  if (rows.length === 0) return { changed: false, next: raw };
  const dedup = new Map<string, { docDate: string; document: string; extendedUntil: string }>();
  for (const r of rows) {
    const key = `${r.docDate}__${r.extendedUntil}__${r.document}`;
    if (!dedup.has(key)) dedup.set(key, r);
  }
  const out = { ...raw, contractExtensions: Array.from(dedup.values()) };
  // Keep legacy fields untouched to be safe; the app ignores them
  return { changed: true, next: out };
}

async function migrateMongo() {
  const db = await getDb();
  const col = db.collection<ContractType>("contracts");
  const cursor = col.find({}, { projection: { _id: 0 } });
  let updated = 0;
  let scanned = 0;
  for await (const doc of cursor) {
    scanned += 1;
    const { changed, next } = migrateOne(doc as any);
    if (!changed) continue;
    await col.updateOne({ id: (doc as any).id }, { $set: { contractExtensions: next.contractExtensions } });
    updated += 1;
  }
  console.log(`Scanned ${scanned} contracts. Updated ${updated} with contractExtensions.`);
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
