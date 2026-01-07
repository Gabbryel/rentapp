import { getDb } from "@/lib/mongodb";
import { readHicpFallback } from "@/lib/inflation-fallback";

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI missing. Cannot seed HICP into MongoDB.");
    process.exit(1);
  }

  const data = await readHicpFallback();
  const entries = Object.entries(data).filter(
    ([month, index]) => typeof month === "string" && typeof index === "number"
  );

  if (entries.length === 0) {
    console.error("No fallback HICP data found in .data/hicp-fallback.json");
    process.exit(1);
  }

  const db = await getDb();
  const coll = db.collection<{
    key: "EA_HICP_2015";
    month: string;
    index: number;
    fetchedAt: Date;
  }>("inflation_euro");

  let upserts = 0;
  for (const [month, index] of entries) {
    const res = await coll.updateOne(
      { key: "EA_HICP_2015", month },
      { $set: { key: "EA_HICP_2015", month, index, fetchedAt: new Date() } },
      { upsert: true }
    );
    if (res.acknowledged) upserts += 1;
  }

  console.log(`Seeded ${upserts} HICP records into MongoDB from fallback file.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
