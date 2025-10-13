import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { getDb } from "../lib/mongodb";
import { getMockContracts } from "../lib/contracts";
import type { Contract as ContractType } from "../lib/schemas/contract";
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

// (no-op: removed unused redactUri helper)

async function main() {
  if (!(process.env.MONGODB_URI && process.env.MONGODB_DB)) {
    throw new Error("Setați MONGODB_URI și MONGODB_DB în .env pentru a popula MongoDB.");
  }
  const db = await getDb();
  const COLLECTION = "contracts" as const;
  const ASSET_CHOICES = [
    "/vercel.svg",
    "/next.svg",
    "/globe.svg",
    "/window.svg",
    "/file.svg",
  ] as const;

  function fmt(d: Date): string {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseISO(s: string): Date {
    // Ensure consistent UTC parsing
    return new Date(`${s}T00:00:00.000Z`);
  }

  function addMonths(d: Date, months: number): Date {
    const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    nd.setUTCMonth(nd.getUTCMonth() + months);
    return nd;
  }

  // legacy indexing generation removed

  // Deterministic but varied amounts and rates
  function deriveAmounts(idx: number): { rentAmountEuro: number; exchangeRateRON: number; tvaPercent: number; correctionPercent: number } {
    const base = 400 + (idx % 12) * 75; // 400..1275
    const cents = ((idx * 17) % 100) / 100; // .00 .. .99
    const rentAmountEuro = +(base + cents).toFixed(2);
    // Slightly vary around 5.00 RON/EUR
    const rate = 4.95 + ((idx * 7) % 20) / 100; // 4.95 .. 5.14
    const exchangeRateRON = +rate.toFixed(4);
    // Use common VAT values: 19% mostly, sometimes 9%/5%
    const tvaPool = [19, 19, 19, 19, 19, 9, 5];
    const tvaPercent = tvaPool[idx % tvaPool.length];
    const corrPool = [0, 0, 0, 5, 10];
    const correctionPercent = corrPool[idx % corrPool.length];
    return { rentAmountEuro, exchangeRateRON, tvaPercent, correctionPercent };
  }

  const data: ContractType[] = getMockContracts().map((c, i) => {
    const { rentAmountEuro, exchangeRateRON, tvaPercent, correctionPercent } = (c as any).rentAmountEuro && (c as any).exchangeRateRON
      ? { rentAmountEuro: (c as any).rentAmountEuro as number, exchangeRateRON: (c as any).exchangeRateRON as number, tvaPercent: (c as any).tvaPercent ?? 19, correctionPercent: (c as any).correctionPercent ?? 0 }
      : deriveAmounts(i + 1);

  // legacy indexing removed

    const scanUrl = (c as Partial<ContractType>).scanUrl ?? ASSET_CHOICES[(i + 3) % ASSET_CHOICES.length];

    const owner = (c as Partial<ContractType>).owner ?? "Markov Services s.r.l.";

    const enriched: ContractType = {
      ...c,
      owner,
  // legacy indexing removed
      scanUrl,
      rentAmountEuro,
      exchangeRateRON,
      tvaPercent,
      correctionPercent,
    } as ContractType;
    return enriched;
  });
  await db.collection(COLLECTION).deleteMany({});
  await db.collection(COLLECTION).insertMany(data);
  console.log(`Seeded ${data.length} contracts in MongoDB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
