import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { getDb } from "../lib/mongodb";
import { getMockContracts } from "../lib/contracts";
// Load .env then override with .env.local if present
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(ROOT, "..");
const ENV_LOCAL = path.join(PROJECT_ROOT, ".env.local");
const ENV = path.join(PROJECT_ROOT, ".env");
if (fs.existsSync(ENV)) {
  dotenv.config({ path: ENV });
  console.log("Loaded env from .env");
}
if (fs.existsSync(ENV_LOCAL)) {
  dotenv.config({ path: ENV_LOCAL, override: true });
  console.log("Loaded env overrides from .env.local");
}
if (!fs.existsSync(ENV) && !fs.existsSync(ENV_LOCAL)) {
  console.warn("No .env or .env.local found. Using process env.");
}

function redactUri(uri: string | undefined) {
  if (!uri) return "(empty)";
  try {
    const u = new URL(uri);
    if (u.password) u.password = "****";
    return `${u.protocol}//${u.username ? u.username + ":" : ""}${u.password ? u.password + "@" : ""}${u.host}${u.pathname}`;
  } catch {
    return "(invalid URI)";
  }
}

async function main() {
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
    throw new Error("Setați MONGODB_URI și MONGODB_DB în .env pentru a popula MongoDB.");
  }
  const db = await getDb();
  const COLLECTION = "contracts" as const;
  const data = getMockContracts();
  await db.collection(COLLECTION).deleteMany({});
  await db.collection(COLLECTION).insertMany(data);
  console.log(`Seeded ${data.length} contracts in MongoDB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
