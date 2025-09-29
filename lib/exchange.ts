import { getDb } from "@/lib/mongodb";

type RateDoc = {
  key: "EURRON";
  date: string; // YYYY-MM-DD in Europe/Bucharest
  rate: number;
  fetchedAt: Date;
};

let memCache: { date: string; rate: number } | null = null;

function todayBucharest(): string {
  const parts = new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

async function fetchBnrEurRon(): Promise<number> {
  const res = await fetch("https://bnr.ro/nbrfxrates.xml", { cache: "no-store" });
  if (!res.ok) throw new Error(`BNR request failed: ${res.status}`);
  const xml = await res.text();
  const m = /<Rate\s+currency="EUR">\s*([\d.,]+)\s*<\/Rate>/i.exec(xml);
  if (!m) throw new Error("EUR rate not found in BNR XML");
  const num = Number(m[1].replace(/,/g, "."));
  if (!Number.isFinite(num) || num <= 0) throw new Error("Invalid rate value");
  return num;
}

export async function getDailyEurRon(options?: { forceRefresh?: boolean }) {
  const date = todayBucharest();
  const force = options?.forceRefresh === true;

  // Prefer Mongo-backed cache if configured
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const coll = db.collection<RateDoc>("exchange_rates");
    if (!force) {
      const doc = await coll.findOne({ key: "EURRON", date });
      if (doc) return { rate: doc.rate, date, source: "db" as const };
    }
    const rate = await fetchBnrEurRon();
    await coll.updateOne(
      { key: "EURRON", date },
      { $set: { key: "EURRON", date, rate, fetchedAt: new Date() } },
      { upsert: true }
    );
    return { rate, date, source: "bnr" as const };
  }

  // Fallback to in-memory daily cache if DB not configured
  if (!force && memCache && memCache.date === date) {
    return { rate: memCache.rate, date, source: "cache" as const };
  }
  const rate = await fetchBnrEurRon();
  memCache = { date, rate };
  return { rate, date, source: "bnr" as const };
}
