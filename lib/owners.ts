import { getDb } from "@/lib/mongodb";
import { OwnerSchema, type Owner } from "@/lib/schemas/owner";

export async function upsertOwner(owner: Owner) {
  OwnerSchema.parse(owner);
  if (!process.env.MONGODB_URI) throw new Error("MongoDB nu este configurat.");
  const db = await getDb();
  await db.collection<Owner>("owners").updateOne({ id: owner.id }, { $set: owner }, { upsert: true });
}

export async function fetchOwners(): Promise<Owner[]> {
  if (!process.env.MONGODB_URI) return [];
  const db = await getDb();
  const docs = await db.collection<Owner>("owners").find({}, { projection: { _id: 0 } }).toArray();
  return docs.map((d) => OwnerSchema.parse(d));
}

export async function fetchOwnerById(id: string): Promise<Owner | null> {
  if (!process.env.MONGODB_URI) return null;
  const db = await getDb();
  const doc = await db.collection<Owner>("owners").findOne({ id }, { projection: { _id: 0 } });
  return doc ? OwnerSchema.parse(doc) : null;
}

export async function deleteOwnerById(id: string): Promise<boolean> {
  if (!process.env.MONGODB_URI) throw new Error("MongoDB nu este configurat.");
  const db = await getDb();
  const res = await db.collection<Owner>("owners").deleteOne({ id });
  return Boolean(res.acknowledged && res.deletedCount && res.deletedCount > 0);
}
