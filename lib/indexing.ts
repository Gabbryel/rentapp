import { getDb } from "@/lib/mongodb";
import { IndexingSchema, type Indexing } from "@/lib/schemas/indexing";
import { fetchContractById, upsertContract } from "@/lib/contracts";

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// CRUD helpers -------------------------------------------------
export async function createIndexing(ix: Indexing): Promise<Indexing> {
  const toSave = IndexingSchema.parse({
    ...ix,
    createdAt: ix.createdAt ?? todayISO(),
    updatedAt: ix.updatedAt ?? todayISO(),
  });
  if (!process.env.MONGODB_URI) {
    throw new Error("MongoDB nu este configurat pentru Indexing");
  }
  const db = await getDb();
  await db.collection<Indexing>("indexings").insertOne(toSave as any);
  return toSave;
}

export async function upsertIndexing(ix: Indexing): Promise<Indexing> {
  const toSave = IndexingSchema.parse({ ...ix, updatedAt: todayISO() });
  if (!process.env.MONGODB_URI) {
    throw new Error("MongoDB nu este configurat pentru Indexing");
  }
  const db = await getDb();
  await db
    .collection<Indexing>("indexings")
    .updateOne({ id: toSave.id ?? `${toSave.contractId}:${toSave.indexDate}` }, { $set: toSave }, { upsert: true });
  return toSave;
}

export async function listIndexingsForContract(contractId: string): Promise<Indexing[]> {
  if (!process.env.MONGODB_URI) return [];
  const db = await getDb();
  const arr = await db
    .collection<Indexing>("indexings")
    .find({ contractId }, { projection: { _id: 0 } })
    .toArray();
  // Validate
  return arr
    .map((raw) => {
      const p = IndexingSchema.safeParse(raw);
      return p.success ? p.data : null;
    })
    .filter(Boolean) as Indexing[];
}

// Deprecated: Indexing model no longer applies changes directly to contracts.
