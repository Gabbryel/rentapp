import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { getDb } from "../lib/mongodb";
import { getDailyEurRon } from "../lib/exchange";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(ROOT, "..");
const ENV_LOCAL = path.join(PROJECT_ROOT, ".env.local");
const ENV = path.join(PROJECT_ROOT, ".env");
if (fs.existsSync(ENV)) dotenv.config({ path: ENV });
if (fs.existsSync(ENV_LOCAL)) dotenv.config({ path: ENV_LOCAL, override: true });

async function main() {
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
    throw new Error("Setați MONGODB_URI și MONGODB_DB în .env pentru a actualiza cursul.");
  }
  const { rate, date, source } = await getDailyEurRon({ forceRefresh: true });
  const db = await getDb();
  const coll = db.collection("contracts");
  const filter = { amountEUR: { $exists: true } };
  const update = { $set: { exchangeRateRON: rate } };
  const res = await coll.updateMany(filter, update);
  console.log(
    `Updated exchangeRateRON to ${rate} (date=${date}, source=${source}). matched=${res.matchedCount}, modified=${res.modifiedCount}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
