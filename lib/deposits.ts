import { getDb } from "@/lib/mongodb";
import { DepositSchema, type Deposit } from "@/lib/schemas/deposit";
import { readJson, writeJson } from "@/lib/local-store";

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export async function createDeposit(d: Deposit): Promise<Deposit> {
  const id = (d as any).id ?? (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function' ? (crypto as any).randomUUID() : `d_${Date.now()}`);
  const toSave = DepositSchema.parse({ ...d, id, createdAt: d.createdAt ?? todayISO(), updatedAt: d.updatedAt ?? todayISO() });
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    await db.collection("deposits").insertOne(toSave as any);
    return toSave;
  }
  // local fallback
  try {
    const all = await readJson<Deposit[]>("deposits.json", []);
    all.push(toSave);
    await writeJson("deposits.json", all);
  } catch {}
  return toSave;
}

export async function listDepositsForContract(contractId: string): Promise<Deposit[]> {
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const arr = await db.collection("deposits").find({ contractId }, { projection: { _id: 0 } }).toArray();
    return arr.map((r) => {
      const p = DepositSchema.safeParse(r);
      return p.success ? p.data : null;
    }).filter(Boolean) as Deposit[];
  }
  try {
    const all = await readJson<Deposit[]>("deposits.json", []);
    return all.filter((d) => d.contractId === contractId);
  } catch {
    return [];
  }
}

export async function updateDeposit(d: Deposit): Promise<Deposit> {
  // Merge with existing record to preserve required fields (e.g., contractId)
  let merged = { ...d } as any;
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const existing = await db
      .collection("deposits")
      .findOne({ id: (d as any).id }, { projection: { _id: 0 } });
    if (existing) merged = { ...existing, ...merged };
    const toSave = DepositSchema.parse({ ...merged, updatedAt: todayISO() });
    await db
      .collection("deposits")
      .updateOne({ id: toSave.id }, { $set: toSave }, { upsert: true });
    return toSave;
  }
  try {
    const all = await readJson<Deposit[]>("deposits.json", []);
    const idx = all.findIndex((x) => x.id === (d as any).id);
    if (idx >= 0) merged = { ...all[idx], ...merged };
    const toSave = DepositSchema.parse({ ...merged, updatedAt: todayISO() });
    if (idx >= 0) all[idx] = toSave; else all.push(toSave);
    await writeJson("deposits.json", all);
    return toSave;
  } catch {
    const toSave = DepositSchema.parse({ ...merged, updatedAt: todayISO() });
    return toSave;
  }
}

export async function deleteDepositById(id: string): Promise<boolean> {
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const r = await db.collection("deposits").deleteOne({ id });
    return Boolean(r.acknowledged && r.deletedCount && r.deletedCount > 0);
  }
  try {
    const all = await readJson<Deposit[]>("deposits.json", []);
    const filtered = all.filter((d) => d.id !== id);
    await writeJson("deposits.json", filtered);
    return true;
  } catch {
    return false;
  }
}

export async function toggleDepositDeposited(id: string, value?: boolean): Promise<boolean> {
  if (!id) return false;
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const doc = await db.collection("deposits").findOne({ id }, { projection: { _id: 0 } });
    if (!doc) return false;
    const newVal = typeof value === 'boolean' ? value : !(doc.isDeposited === true);
    await db.collection("deposits").updateOne({ id }, { $set: { isDeposited: newVal, updatedAt: todayISO() } });
    return true;
  }
  try {
    const all = await readJson<Deposit[]>("deposits.json", []);
    const idx = all.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    all[idx].isDeposited = typeof value === 'boolean' ? value : !all[idx].isDeposited;
    all[idx].updatedAt = todayISO();
    await writeJson("deposits.json", all);
    return true;
  } catch {
    return false;
  }
}
