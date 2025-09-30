import { getDb } from "@/lib/mongodb";
import { PartnerDocSchema, type PartnerDoc } from "@/lib/schemas/partner-doc";

export async function addPartnerDoc(doc: PartnerDoc): Promise<void> {
  PartnerDocSchema.parse(doc);
  if (!process.env.MONGODB_URI) throw new Error("MongoDB nu este configurat.");
  const db = await getDb();
  await db.collection<PartnerDoc>("partner_docs").updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
}

export async function listPartnerDocs(partnerId: string): Promise<PartnerDoc[]> {
  if (!process.env.MONGODB_URI) return [];
  const db = await getDb();
  const docs = await db.collection<PartnerDoc>("partner_docs").find({ partnerId }, { projection: { _id: 0 } }).toArray();
  return docs.map((d) => PartnerDocSchema.parse(d));
}

export async function deletePartnerDoc(id: string): Promise<boolean> {
  if (!process.env.MONGODB_URI) throw new Error("MongoDB nu este configurat.");
  const db = await getDb();
  const res = await db.collection<PartnerDoc>("partner_docs").deleteOne({ id });
  return Boolean(res.acknowledged && (res.deletedCount || 0) > 0);
}
