import { getDb } from "@/lib/mongodb";
import { InvoiceSettingsSchema, type InvoiceSettings } from "@/lib/schemas/invoice-settings";
import { readJson, writeJson } from "@/lib/local-store";

function ownerKey(ownerId?: string | null, ownerName?: string | null): string {
  if (ownerId && ownerId.trim()) return ownerId.trim();
  const base = (ownerName || "owner").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "owner";
}

// Dev/local fallback: persist settings and counters in a JSON file
type SettingsMap = Record<string, InvoiceSettings>;
async function readSettingsMap(): Promise<SettingsMap> {
  return await readJson<SettingsMap>("invoice_settings.json", {});
}
async function writeSettingsMap(map: SettingsMap): Promise<void> {
  await writeJson("invoice_settings.json", map);
}

export async function getInvoiceSettingsForOwner(ownerId?: string | null, ownerName?: string | null): Promise<InvoiceSettings> {
  const nowIso = new Date().toISOString();
  const id = ownerKey(ownerId, ownerName);
  if (!process.env.MONGODB_URI) {
    const map = await readSettingsMap();
    const s = map[id] ?? { id, series: "MS", nextNumber: 1, padWidth: 5, includeYear: true, updatedAt: nowIso };
    return InvoiceSettingsSchema.parse(s);
  }
  try {
    const db = await getDb();
    const doc = await db.collection<InvoiceSettings>("invoice_settings").findOne({ id }, { projection: { _id: 0 } });
    if (!doc) return InvoiceSettingsSchema.parse({ id, updatedAt: nowIso });
    return InvoiceSettingsSchema.parse({ ...doc, updatedAt: new Date(doc.updatedAt ?? nowIso).toISOString() });
  } catch {
    const map = await readSettingsMap();
    const s = map[id] ?? { id, series: "MS", nextNumber: 1, padWidth: 5, includeYear: true, updatedAt: nowIso };
    return InvoiceSettingsSchema.parse(s);
  }
}

export async function saveInvoiceSettingsForOwner(ownerId: string | undefined | null, ownerName: string | undefined | null, input: Partial<InvoiceSettings>): Promise<InvoiceSettings> {
  const id = ownerKey(ownerId || undefined, ownerName || undefined);
  const current = await getInvoiceSettingsForOwner(ownerId || undefined, ownerName || undefined);
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

export async function allocateInvoiceNumberForOwner(ownerId?: string | null, ownerName?: string | null): Promise<string> {
  const nowIso = new Date().toISOString();
  const id = ownerKey(ownerId, ownerName);
  const year = new Date().getFullYear();
  if (!process.env.MONGODB_URI) {
    const map = await readSettingsMap();
    const current = map[id] ?? { id, series: "MS", nextNumber: 1, padWidth: 5, includeYear: true, updatedAt: nowIso };
    const seqNum = current.nextNumber;
    const seq = String(seqNum).padStart(current.padWidth, "0");
    const number = current.includeYear ? `${current.series}-${year}-${seq}` : `${current.series}-${seq}`;
    map[id] = { ...current, nextNumber: seqNum + 1, updatedAt: nowIso };
    await writeSettingsMap(map);
    return number;
  }
  try {
    const db = await getDb();
    await db.collection<InvoiceSettings>("invoice_settings").updateOne(
      { id },
      {
        $setOnInsert: { id, series: "MS", padWidth: 5, includeYear: true, updatedAt: nowIso, nextNumber: 1 },
        $inc: { nextNumber: 1 },
        $set: { updatedAt: nowIso },
      },
      { upsert: true }
    );
    const doc = await db.collection<InvoiceSettings>("invoice_settings").findOne({ id }, { projection: { _id: 0 } });
    const s = InvoiceSettingsSchema.parse({ ...(doc as object), updatedAt: nowIso });
    const seq = String(s.nextNumber).padStart(s.padWidth, "0");
    return s.includeYear ? `${s.series}-${year}-${seq}` : `${s.series}-${seq}`;
  } catch {
    const map = await readSettingsMap();
    const current = map[id] ?? { id, series: "MS", nextNumber: 1, padWidth: 5, includeYear: true, updatedAt: nowIso };
    const seqNum = current.nextNumber;
    const seq = String(seqNum).padStart(current.padWidth, "0");
    const number = current.includeYear ? `${current.series}-${year}-${seq}` : `${current.series}-${seq}`;
    map[id] = { ...current, nextNumber: seqNum + 1, updatedAt: nowIso };
    await writeSettingsMap(map);
    return number;
  }
}
