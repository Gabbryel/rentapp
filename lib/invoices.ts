import { getDb } from "@/lib/mongodb";
import { InvoiceSchema, type Invoice } from "@/lib/schemas/invoice";

export async function createInvoice(inv: Invoice) {
  InvoiceSchema.parse(inv);
  if (!process.env.MONGODB_URI) throw new Error("MongoDB nu este configurat.");
  const db = await getDb();
  await db.collection<Invoice>("invoices").insertOne(inv);
}

export async function fetchInvoicesByContract(contractId: string): Promise<Invoice[]> {
  if (!process.env.MONGODB_URI) return [];
  const db = await getDb();
  const docs = await db
    .collection<Invoice>("invoices")
    .find({ contractId }, { projection: { _id: 0 } })
    .sort({ issuedAt: 1 })
    .toArray();
  return docs.map((d) => InvoiceSchema.parse(d));
}

export async function fetchInvoicesByPartner(partnerId: string): Promise<Invoice[]> {
  if (!process.env.MONGODB_URI) return [];
  const db = await getDb();
  const docs = await db
    .collection<Invoice>("invoices")
    .find({ partnerId }, { projection: { _id: 0 } })
    .sort({ issuedAt: -1 })
    .toArray();
  return docs.map((d) => InvoiceSchema.parse(d));
}

export async function fetchInvoiceById(id: string): Promise<Invoice | null> {
  if (!process.env.MONGODB_URI) return null;
  const db = await getDb();
  const doc = await db.collection<Invoice>("invoices").findOne({ id }, { projection: { _id: 0 } });
  return doc ? InvoiceSchema.parse(doc) : null;
}
