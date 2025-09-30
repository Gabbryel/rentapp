import { getDb } from "@/lib/mongodb";
import { PartnerSchema, type Partner } from "@/lib/schemas/partner";

export async function upsertPartner(partner: Partner) {
  PartnerSchema.parse(partner);
  if (!process.env.MONGODB_URI) throw new Error("MongoDB nu este configurat.");
  const db = await getDb();
  await db.collection<Partner>("partners").updateOne({ id: partner.id }, { $set: partner }, { upsert: true });
}

export async function fetchPartners(): Promise<Partner[]> {
  if (!process.env.MONGODB_URI) return [];
  const db = await getDb();
  const docs = await db.collection<Partner>("partners").find({}, { projection: { _id: 0 } }).toArray();
  return docs.map((d) => PartnerSchema.parse(d));
}

export async function fetchPartnerById(id: string): Promise<Partner | null> {
  if (!process.env.MONGODB_URI) return null;
  const db = await getDb();
  const doc = await db.collection<Partner>("partners").findOne({ id }, { projection: { _id: 0 } });
  return doc ? PartnerSchema.parse(doc) : null;
}

export async function deletePartnerById(id: string): Promise<boolean> {
  if (!process.env.MONGODB_URI) throw new Error("MongoDB nu este configurat.");
  const db = await getDb();
  const res = await db.collection<Partner>("partners").deleteOne({ id });
  return Boolean(res.acknowledged && res.deletedCount && res.deletedCount > 0);
}
