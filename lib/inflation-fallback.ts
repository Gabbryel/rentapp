import fs from "fs/promises";
import path from "path";
import { getDb } from "@/lib/mongodb";

const FALLBACK_FILE = path.join(process.cwd(), ".data", "hicp-fallback.json");
const FALLBACK_KEY = "EA_HICP_FALLBACK" as const;

type HicpFallbackDoc = {
  key: typeof FALLBACK_KEY;
  month: string;
  index: number;
  updatedAt: Date;
};

function useMongoStorage(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

async function readHicpFallbackFile(): Promise<Record<string, number>> {
  try {
    const raw = await fs.readFile(FALLBACK_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([k, v]) => isMonthKey(k) && typeof v === "number",
    );
    return Object.fromEntries(entries) as Record<string, number>;
  } catch {
    return {};
  }
}

async function writeHicpFallbackFile(map: Record<string, number>): Promise<void> {
  const safeEntries = Object.entries(map || {}).filter(
    ([k, v]) => isMonthKey(k) && typeof v === "number" && Number.isFinite(v),
  );
  const sorted = safeEntries.sort((a, b) => a[0].localeCompare(b[0]));
  await fs.mkdir(path.dirname(FALLBACK_FILE), { recursive: true });
  const json = JSON.stringify(Object.fromEntries(sorted), null, 2);
  await fs.writeFile(FALLBACK_FILE, json, "utf8");
}

function isMonthKey(key: string): boolean {
  return /^[0-9]{4}-[0-9]{2}$/.test(key);
}

export async function readHicpFallback(): Promise<Record<string, number>> {
  if (useMongoStorage()) {
    try {
      const db = await getDb();
      const docs = await db
        .collection<HicpFallbackDoc>("inflation_fallback")
        .find(
          { $or: [{ key: FALLBACK_KEY }, { key: { $exists: false } }] },
          { projection: { _id: 0 } },
        )
        .toArray();
      const entries = docs
        .filter((d) => isMonthKey(String(d.month || "")))
        .filter((d) => typeof d.index === "number" && Number.isFinite(d.index))
        .map((d) => [d.month, d.index] as const);
      return Object.fromEntries(entries);
    } catch {
      return readHicpFallbackFile();
    }
  }

  return readHicpFallbackFile();
}

export async function writeHicpFallback(map: Record<string, number>): Promise<void> {
  if (useMongoStorage()) {
    const safeEntries = Object.entries(map || {}).filter(
      ([k, v]) => isMonthKey(k) && typeof v === "number" && Number.isFinite(v),
    );
    const db = await getDb();
    const coll = db.collection<HicpFallbackDoc>("inflation_fallback");
    // Replace all fallback rows atomically enough for this admin use-case.
    await coll.deleteMany({ key: FALLBACK_KEY });
    if (safeEntries.length > 0) {
      await coll.insertMany(
        safeEntries.map(([month, index]) => ({
          key: FALLBACK_KEY,
          month,
          index,
          updatedAt: new Date(),
        })),
      );
    }
    return;
  }

  await writeHicpFallbackFile(map);
}

export async function upsertHicpFallback(month: string, index: number): Promise<Record<string, number>> {
  const normalizedMonth = month.trim();
  if (!isMonthKey(normalizedMonth)) throw new Error("Format lună invalid (YYYY-MM)");
  if (!Number.isFinite(index) || index <= 0) throw new Error("Indice invalid");

  if (useMongoStorage()) {
    const db = await getDb();
    await db.collection<HicpFallbackDoc>("inflation_fallback").updateOne(
      {
        $or: [
          { key: FALLBACK_KEY, month: normalizedMonth },
          { key: { $exists: false }, month: normalizedMonth },
        ],
      },
      {
        $set: {
          key: FALLBACK_KEY,
          month: normalizedMonth,
          index,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    return readHicpFallback();
  }

  const current = await readHicpFallback();
  const next = { ...current, [normalizedMonth]: index };
  await writeHicpFallbackFile(next);
  return next;
}

export async function deleteHicpFallback(month: string): Promise<Record<string, number>> {
  const normalizedMonth = month.trim();

  if (useMongoStorage()) {
    const db = await getDb();
    await db
      .collection<HicpFallbackDoc>("inflation_fallback")
      .deleteOne({
        $or: [
          { key: FALLBACK_KEY, month: normalizedMonth },
          { key: { $exists: false }, month: normalizedMonth },
        ],
      });
    return readHicpFallback();
  }

  const current = await readHicpFallback();
  if (!(normalizedMonth in current)) return current;
  const { [normalizedMonth]: _, ...rest } = current;
  await writeHicpFallbackFile(rest);
  return rest;
}
