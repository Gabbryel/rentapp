import { getDb } from "@/lib/mongodb";

type BtRateDoc = {
  key: "BT_EUR_SELL";
  date: string; // YYYY-MM-DD in Europe/Bucharest
  rate: number; // RON per 1 EUR (selling)
  fetchedAt: Date;
};

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

async function fetchBtEurSell(): Promise<number> {
  // Public page listing BT FX rates for in-branch transactions
  const res = await fetch("https://www.bancatransilvania.ro/curs-valutar", {
    cache: "no-store",
    // Some CDNs behave better with a UA; harmless here
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`BT request failed: ${res.status}`);
  const html = await res.text();

  // Strip scripts/styles/tags to avoid DOM parsing and normalize whitespace
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Expect a row like: "EUR 5.0754 5.0050 5.1550" => [BNR, Buy, Sell]
  const rowMatch = /\bEUR\b\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i.exec(text);
  if (!rowMatch) throw new Error("EUR selling rate row not found on BT page");
  const sellStr = rowMatch[3];
  const sell = Number(sellStr.replace(/,/g, "."));
  if (!Number.isFinite(sell) || sell <= 0) {
    throw new Error("Invalid BT selling rate value");
  }
  return sell;
}

export async function getDailyBtEurSell(options?: { forceRefresh?: boolean }) {
  const date = todayBucharest();
  const force = options?.forceRefresh === true;

  if (process.env.MONGODB_URI && process.env.MONGODB_DB) {
    const db = await getDb();
    const coll = db.collection<BtRateDoc>("exchange_rates");
    if (!force) {
      const doc = await coll.findOne({ key: "BT_EUR_SELL", date });
      if (doc) return { rate: doc.rate, date, source: "db" as const };
    }
    const rate = await fetchBtEurSell();
    await coll.updateOne(
      { key: "BT_EUR_SELL", date },
      { $set: { key: "BT_EUR_SELL", date, rate, fetchedAt: new Date() } },
      { upsert: true }
    );
    return { rate, date, source: "bt" as const };
  }

  // Without DB, just fetch live (no durable cache)
  const rate = await fetchBtEurSell();
  return { rate, date, source: "bt" as const };
}

// Utility to determine when to trigger cron: BT updates are desired daily at 09:00 EET/EEST.
// Deploy a cron job to GET /api/exchange/bt/refresh at 09:00 Europe/Bucharest.
export const BT_CRON_NOTE =
  "Schedule a daily GET to /api/exchange/bt/refresh at 09:00 Europe/Bucharest to persist the rate.";
