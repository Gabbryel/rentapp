import { getDb } from "@/lib/mongodb";
import { fetchContracts } from "@/lib/contracts";
import "dotenv/config";

async function main() {
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
    throw new Error("Setați MONGODB_URI și MONGODB_DB în .env pentru a popula MongoDB.");
  }
  const db = await getDb();
  const COLLECTION = "contracts" as const;
  const data = await fetchContracts();
  await db.collection(COLLECTION).deleteMany({});
  await db.collection(COLLECTION).insertMany(data);
  console.log(`Seeded ${data.length} contracts in MongoDB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
