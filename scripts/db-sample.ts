import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { getDb } from "../lib/mongodb";
import type { Contract } from "../lib/schemas/contract";
import { currentRentAmount } from "../lib/contracts";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(ROOT, "..");
const ENV_LOCAL = path.join(PROJECT_ROOT, ".env.local");
const ENV = path.join(PROJECT_ROOT, ".env");
if (fs.existsSync(ENV)) dotenv.config({ path: ENV });
if (fs.existsSync(ENV_LOCAL)) dotenv.config({ path: ENV_LOCAL, override: true });

async function main() {
  const db = await getDb();
  const docs = await db
    .collection<Contract>("contracts")
    .find({}, { projection: { _id: 0 }, limit: 3 })
    .toArray();
  for (const d of docs) {
    const { id, name, exchangeRateRON, tvaPercent, scanUrl } = d as any;
    const amountEUR = currentRentAmount(d as any);
    console.log({ id, name, amountEUR, exchangeRateRON, tvaPercent, scanUrl });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
