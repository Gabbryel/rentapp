import { getDb } from "@/lib/mongodb";
import { fetchContracts } from "@/lib/contracts";

async function main() {
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
    throw new Error("Setați MONGODB_URI și MONGODB_DB în .env pentru a popula MongoDB.");
  }
  const db = await getDb();
  const data = await fetchContracts();
  await db.collection("contracts").deleteMany({});
  await db.collection("contracts").insertMany(data);
  console.log(`Seeded ${data.length} contracts in MongoDB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
