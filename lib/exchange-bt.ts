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


async function fetchBtEurSell(): Promise<{ rate: number; pageDate?: string }> {
  // bancatransilvania.ro is protected by Akamai bot detection (403 for server-side requests).
  // cursvalutar.ro aggregates BT's published rates and is accessible server-side.
  const res = await fetch("https://www.cursvalutar.ro/curs-banca-transilvania/", {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ro-RO,ro;q=0.9",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`cursvalutar.ro BT request failed: ${res.status}`);
  const html = await res.text();

  // Page structure: <td>EUR - Euro</td><td>{buy}</td><td>{sell}</td>
  const m = /EUR\s*-\s*Euro<\/td>\s*<td>([\d.,]+)<\/td>\s*<td>([\d.,]+)<\/td>/i.exec(html);
  if (!m) throw new Error("EUR selling rate not found on cursvalutar.ro BT page");

  const sell = Number(m[2].replace(/,/g, "."));
  if (!Number.isFinite(sell) || sell <= 0) throw new Error("Invalid BT EUR sell rate value");

  return { rate: sell };
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
