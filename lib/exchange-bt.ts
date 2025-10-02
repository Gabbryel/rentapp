import { getDb } from "@/lib/mongodb";

type BtRateDoc = {
  key: "BT_EUR_SELL";
  date: string; // YYYY-MM-DD in Europe/Bucharest
  rate: number; // RON per 1 EUR (selling)
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

function parseDdMmYyyyToIso(d: string): string | null {
  // Accept dd.mm.yyyy or dd/mm/yyyy
  const m = d.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchBtEurSell(): Promise<{ rate: number; pageDate?: string }> {
  const res = await fetch("https://www.bancatransilvania.ro/curs-valutar", {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`BT request failed: ${res.status}`);
  const html = await res.text();

  // Strip tags and normalize whitespace for a robust regex search
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Try three-column table first: (buy, middle, sell). If only two numbers present, use second as sell
  let sell: number | null = null;
  const m3 = /\bEUR\b\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i.exec(text);
  if (m3) {
    sell = Number(m3[3].replace(/,/g, "."));
  } else {
    const m2 = /\bEUR\b\s+([\d.,]+)\s+([\d.,]+)/i.exec(text);
    if (m2) sell = Number(m2[2].replace(/,/g, "."));
  }
  if (!Number.isFinite(sell) || (sell as number) <= 0) {
    throw new Error("EUR selling rate not found or invalid on BT page");
  }

  // Extract visible page date if present
  let pageDate: string | undefined = undefined;
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})|(\d{2}[./]\d{2}[./]\d{4})/);
  if (dateMatch) {
    const raw = dateMatch[0];
    pageDate = /\d{4}-\d{2}-\d{2}/.test(raw) ? raw : parseDdMmYyyyToIso(raw) ?? undefined;
  }

  return { rate: sell!, pageDate };
}

export async function getDailyBtEurSell(options?: { forceRefresh?: boolean }) {
  const today = todayBucharest();
  const force = options?.forceRefresh === true;

  // Prefer Mongo-backed cache if configured
  if (process.env.MONGODB_URI) {
    const db = await getDb();
    const coll = db.collection<BtRateDoc>("exchange_rates");
    if (!force) {
      // First, prefer an exact doc for today
      const todayDoc = await coll.findOne({ key: "BT_EUR_SELL", date: today });
      if (todayDoc) return { rate: todayDoc.rate, date: todayDoc.date, source: "db" as const };
      // Else, try latest available doc (helps when page isn't updated yet)
      const latest = await coll
        .find({ key: "BT_EUR_SELL" })
        .sort({ date: -1 })
        .limit(1)
        .toArray();
      if (latest[0]) {
        return { rate: latest[0].rate, date: latest[0].date, source: "db" as const };
      }
    }
    try {
      const { rate, pageDate } = await fetchBtEurSell();
      const dateToStore = pageDate ?? today;
      await coll.updateOne(
        { key: "BT_EUR_SELL", date: dateToStore },
        { $set: { key: "BT_EUR_SELL", date: dateToStore, rate, fetchedAt: new Date() } },
        { upsert: true }
      );
      return { rate, date: dateToStore, source: "bt" as const };
    } catch (e) {
      // On fetch failure, fallback to latest stored value if present
      const latest = await coll
        .find({ key: "BT_EUR_SELL" })
        .sort({ date: -1 })
        .limit(1)
        .toArray();
      if (latest[0]) {
        return { rate: latest[0].rate, date: latest[0].date, source: "db" as const };
      }
      throw e;
    }
  }

  // Fallback: in-memory cache for environments without DB
  if (!force && memCache && memCache.date === today) {
    return { rate: memCache.rate, date: today, source: "cache" as const };
  }
  const { rate, pageDate } = await fetchBtEurSell();
  const date = pageDate ?? today;
  memCache = { date, rate };
  return { rate, date, source: "bt" as const };
}

export const BT_CRON_NOTE =
  "Schedule a daily GET to /api/exchange/bt/refresh at 09:00 Europe/Bucharest to persist the rate.";
