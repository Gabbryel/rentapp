import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { InvoiceSchema } from "@/lib/schemas/invoice";

const ids = [
  "69b9948ba95fb8bf5cc09ba7",
  "69bd13a6a95fb8bf5cc5ab62",
];

async function main() {
  const db = await getDb();
  for (const id of ids) {
    const doc = await db.collection("invoices").findOne({ _id: new ObjectId(id) }, { projection: { _id: 0 } });
    console.log(`\n--- ${id} ---`);
    console.log(JSON.stringify(doc, null, 2));
    try {
      InvoiceSchema.parse(doc);
      console.log("PARSES OK");
    } catch (e: any) {
      console.log("PARSE ERRORS:", JSON.stringify(e.errors ?? e.message, null, 2));
    }
  }
  process.exit(0);
}
main().catch(console.error);
