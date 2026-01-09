import { getDb } from "@/lib/mongodb";
import { normalizeIsoDate } from "@/lib/utils/date";

type RateDoc = {
  key: "EURRON";
  date: string; // YYYY-MM-DD in Europe/Bucharest
  rate: number;
  fetchedAt: Date;
};

const memCache = new Map<string, { rate: number; date: string }>();

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

async function fetchBnrEurRon(opts?: { date?: string }): Promise<{ rate: number; date: string }> {
  const target = opts?.date?.slice(0, 10);
  const query = target ? `?date=${target}` : "";
  const res = await fetch(`https://bnr.ro/nbrfxrates.xml${query}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`BNR request failed: ${res.status}`);
  const xml = await res.text();
  const m = /<Rate\s+currency="EUR">\s*([\d.,]+)\s*<\/Rate>/i.exec(xml);
  if (!m) throw new Error("EUR rate not found in BNR XML");
  const num = Number(m[1].replace(/,/g, "."));
  if (!Number.isFinite(num) || num <= 0) throw new Error("Invalid rate value");
  const dateMatch = /<Cube\s+date="(\d{4}-\d{2}-\d{2})"/i.exec(xml);
  const effectiveDate = dateMatch?.[1] ?? target ?? todayBucharest();
  return { rate: num, date: effectiveDate };
}

export async function getDailyEurRon(options?: { forceRefresh?: boolean }) {
  const requestedDate = todayBucharest();
  const force = options?.forceRefresh === true;

  // Prefer Mongo-backed cache if configured
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const coll = db.collection<RateDoc>("exchange_rates");
    if (!force) {
      const doc = await coll.findOne({ key: "EURRON", date: requestedDate });
      if (doc) return { rate: doc.rate, date: doc.date, source: "db" as const };
    }
    const { rate, date } = await fetchBnrEurRon({ date: requestedDate });
    await coll.updateOne(
      { key: "EURRON", date },
      { $set: { key: "EURRON", date, rate, fetchedAt: new Date() } },
      { upsert: true }
    );
    memCache.set(requestedDate, { rate, date });
    if (date !== requestedDate) memCache.set(date, { rate, date });
    return { rate, date, source: "bnr" as const };
  }

  // Fallback to in-memory daily cache if DB not configured
  if (!force) {
    const cached = memCache.get(requestedDate);
    if (cached) {
      return { rate: cached.rate, date: cached.date, source: "cache" as const };
    }
  }
  const { rate, date } = await fetchBnrEurRon({ date: requestedDate });
  memCache.set(requestedDate, { rate, date });
  if (date !== requestedDate) memCache.set(date, { rate, date });
  return { rate, date, source: "bnr" as const };
}

export async function getEurRonForDate(
  dateIso: string,
  options?: { fallbackToPrevious?: boolean }
): Promise<{ rate: number; date: string; source: "db" | "bnr" | "cache" | "fallback" } | null> {
  const normalized = normalizeIsoDate(dateIso);
  if (!normalized) return null;
  const allowFallback = options?.fallbackToPrevious !== false;

  const lookupCache = (key: string) => {
    const cached = memCache.get(key);
    return cached ? { rate: cached.rate, date: cached.date, source: "cache" as const } : null;
  };

  if (!process.env.MONGODB_URI) {
    const cached = lookupCache(normalized);
    if (cached) return cached;
    if (allowFallback) {
      const fallbackEntry = Array.from(memCache.entries())
        .filter(([key]) => key <= normalized)
        .sort(([a], [b]) => b.localeCompare(a))
        .at(0);
      if (fallbackEntry) {
        return { rate: fallbackEntry[1].rate, date: fallbackEntry[1].date, source: "cache" as const };
      }
    }
  } else {
    try {
      const db = await getDb();
      const coll = db.collection<RateDoc>("exchange_rates");
      const doc = await coll.findOne({ key: "EURRON", date: normalized });
      if (doc) {
        memCache.set(normalized, { rate: doc.rate, date: doc.date });
        return { rate: doc.rate, date: doc.date, source: "db" as const };
      }
      if (allowFallback) {
        const prev = await coll
          .find({ key: "EURRON", date: { $lte: normalized } })
          .sort({ date: -1 })
          .limit(1)
          .toArray();
        const match = prev[0];
        if (match) {
          memCache.set(normalized, { rate: match.rate, date: match.date });
          return { rate: match.rate, date: match.date, source: "db" as const };
        }
      }
    } catch {
      // Ignore DB errors and fallback to network fetch
    }
  }

  try {
    const { rate, date } = await fetchBnrEurRon({ date: normalized });
    memCache.set(normalized, { rate, date });
    if (date !== normalized) memCache.set(date, { rate, date });
    if (process.env.MONGODB_URI) {
      try {
        const db = await getDb();
        await db
          .collection<RateDoc>("exchange_rates")
          .updateOne(
            { key: "EURRON", date },
            { $set: { key: "EURRON", date, rate, fetchedAt: new Date() } },
            { upsert: true }
          );
      } catch {
        // ignore persistence issues
      }
    }
    return { rate, date, source: "bnr" as const };
  } catch {
    if (allowFallback) {
      const fallbackEntry = Array.from(memCache.entries())
        .filter(([key]) => key <= normalized)
        .sort(([a], [b]) => b.localeCompare(a))
        .at(0);
      if (fallbackEntry) {
        return { rate: fallbackEntry[1].rate, date: fallbackEntry[1].date, source: "fallback" as const };
      }
    }
    return null;
  }
}
