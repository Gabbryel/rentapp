import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { getDb } from "../lib/mongodb";

// Load .env then override with .env.local if present
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(ROOT, "..");
const ENV_LOCAL = path.join(PROJECT_ROOT, ".env.local");
const ENV = path.join(PROJECT_ROOT, ".env");
if (fs.existsSync(ENV)) {
  dotenv.config({ path: ENV });
}
if (fs.existsSync(ENV_LOCAL)) {
  dotenv.config({ path: ENV_LOCAL, override: true });
}

async function main() {
  const db = await getDb();
  const count = await db.collection("contracts").countDocuments();
  console.log(`contracts.count=${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
