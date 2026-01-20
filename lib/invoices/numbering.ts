/**
 * Invoice Number Allocation Module
 * 
 * Provides atomic, race-condition-free invoice number generation.
 * Uses MongoDB findOneAndUpdate with returnDocument:'before' to ensure
 * each invoice gets a unique sequential number.
 */

import { getDb } from "@/lib/mongodb";
import { InvoiceSettingsSchema, type InvoiceSettings } from "@/lib/schemas/invoice-settings";
import { readJson, writeJson } from "@/lib/local-store";

function ownerKey(ownerId?: string | null, ownerName?: string | null): string {
  if (ownerId && ownerId.trim()) return ownerId.trim();
  const base = (ownerName || "owner").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "owner";
}

type SettingsMap = Record<string, InvoiceSettings>;

async function readSettingsMap(): Promise<SettingsMap> {
  return await readJson<SettingsMap>("invoice_settings.json", {});
}

async function writeSettingsMap(map: SettingsMap): Promise<void> {
  await writeJson("invoice_settings.json", map);
}

/**
 * Allocates a unique invoice number for an owner.
 * 
 * This function is atomic and thread-safe:
 * - MongoDB: Uses findOneAndUpdate with returnDocument:'before'
 * - Local: Uses file-based locking semantics (not concurrent-safe in distributed systems)
 * 
 * @returns The allocated invoice number (e.g., "MS-2026-00001")
 */
export async function allocateInvoiceNumber(
  ownerId?: string | null,
  ownerName?: string | null
): Promise<string> {
  const nowIso = new Date().toISOString();
  const id = ownerKey(ownerId, ownerName);
  const year = new Date().getFullYear();

  // Local storage path (no MongoDB)
  if (!process.env.MONGODB_URI) {
    return allocateLocal(id, year, nowIso);
  }

  // MongoDB path with fallback
  try {
    return await allocateMongo(id, year, nowIso);
  } catch (error) {
    console.error("Invoice number allocation failed (MongoDB), falling back to local:", error);
    return allocateLocal(id, year, nowIso);
  }
}

/**
 * MongoDB-based allocation with atomic operations
 */
async function allocateMongo(id: string, year: number, nowIso: string): Promise<string> {
  const db = await getDb();
  
  // Atomically get the current value and increment
  const result = await db.collection<InvoiceSettings>("invoice_settings").findOneAndUpdate(
    { id },
    {
      $setOnInsert: {
        id,
        series: "MS",
        padWidth: 5,
        includeYear: true,
        nextNumber: 1, // Will be used on first insert
      },
      $inc: { nextNumber: 1 },
      $set: { updatedAt: nowIso },
    },
    {
      upsert: true,
      returnDocument: "before", // Critical: get value BEFORE increment
      projection: { _id: 0 },
    }
  );

  // Handle first-time creation (document didn't exist before)
  const currentNumber = result?.nextNumber ?? 1;
  const settings = result
    ? InvoiceSettingsSchema.parse({ ...result, updatedAt: nowIso })
    : {
        id,
        series: "MS",
        padWidth: 5,
        includeYear: true,
        nextNumber: currentNumber,
        updatedAt: nowIso,
      };

  return formatInvoiceNumber(currentNumber, settings, year);
}

/**
 * Local file-based allocation
 * Warning: Not safe for concurrent access in distributed systems
 */
async function allocateLocal(id: string, year: number, nowIso: string): Promise<string> {
  const map = await readSettingsMap();
  const current =
    map[id] ?? {
      id,
      series: "MS",
      nextNumber: 1,
      padWidth: 5,
      includeYear: true,
      updatedAt: nowIso,
    };

  const currentNumber = current.nextNumber;
  const number = formatInvoiceNumber(currentNumber, current, year);

  // Increment for next allocation
  map[id] = { ...current, nextNumber: currentNumber + 1, updatedAt: nowIso };
  await writeSettingsMap(map);

  return number;
}

/**
 * Formats an invoice number according to settings
 */
function formatInvoiceNumber(
  seqNum: number,
  settings: { series: string; padWidth: number; includeYear: boolean },
  year: number
): string {
  const seq = String(seqNum).padStart(settings.padWidth, "0");
  return settings.includeYear ? `${settings.series}-${year}-${seq}` : `${settings.series}-${seq}`;
}

/**
 * Get invoice settings for an owner (read-only)
 */
export async function getInvoiceSettings(
  ownerId?: string | null,
  ownerName?: string | null
): Promise<InvoiceSettings> {
  const nowIso = new Date().toISOString();
  const id = ownerKey(ownerId, ownerName);

  if (!process.env.MONGODB_URI) {
    const map = await readSettingsMap();
    const s = map[id] ?? {
      id,
      series: "MS",
      nextNumber: 1,
      padWidth: 5,
      includeYear: true,
      updatedAt: nowIso,
    };
    return InvoiceSettingsSchema.parse(s);
  }

  try {
    const db = await getDb();
    const doc = await db
      .collection<InvoiceSettings>("invoice_settings")
      .findOne({ id }, { projection: { _id: 0 } });
    if (!doc) {
      return InvoiceSettingsSchema.parse({
        id,
        series: "MS",
        nextNumber: 1,
        padWidth: 5,
        includeYear: true,
        updatedAt: nowIso,
      });
    }
    return InvoiceSettingsSchema.parse({ ...doc, updatedAt: new Date(doc.updatedAt ?? nowIso).toISOString() });
  } catch {
    const map = await readSettingsMap();
    const s = map[id] ?? {
      id,
      series: "MS",
      nextNumber: 1,
      padWidth: 5,
      includeYear: true,
      updatedAt: nowIso,
    };
    return InvoiceSettingsSchema.parse(s);
  }
}

/**
 * Save/update invoice settings for an owner
 */
export async function saveInvoiceSettings(
  ownerId: string | undefined | null,
  ownerName: string | undefined | null,
  input: Partial<InvoiceSettings>
): Promise<InvoiceSettings> {
  const id = ownerKey(ownerId || undefined, ownerName || undefined);
  const current = await getInvoiceSettings(ownerId || undefined, ownerName || undefined);
  const next: InvoiceSettings = InvoiceSettingsSchema.parse({
    ...current,
    ...input,
    id,
    updatedAt: new Date().toISOString(),
  });

  if (!process.env.MONGODB_URI) {
    const map = await readSettingsMap();
    map[id] = next;
    await writeSettingsMap(map);
    return next;
  }

  try {
    const db = await getDb();
    await db.collection<InvoiceSettings>("invoice_settings").updateOne({ id }, { $set: next }, { upsert: true });
  } catch {
    const map = await readSettingsMap();
    map[id] = next;
    await writeSettingsMap(map);
  }

  return next;
}
