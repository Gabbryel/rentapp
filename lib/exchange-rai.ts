import { getDb } from "@/lib/mongodb";

type RaiRateDoc = {
  key: "RAI_EUR_SELL";
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

async function fetchRaiEurSell(): Promise<number> {
  // Public page listing Raiffeisen FX rates
  const res = await fetch("https://banking.raiffeisen.ro/curs-valutar/", {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`RAI request failed: ${res.status}`);
  const html = await res.text();
  // Strip scripts/styles/tags and normalize whitespace
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Try a label-based approach first: look for the number after "Vânzare"/"Sell" near the EUR row
  const eurIndex = text.search(/\b(EUR|EURO)\b/i);
  if (eurIndex !== -1) {
    const windowText = text.slice(eurIndex, eurIndex + 300); // small window around EUR row
    const labelMatch = /(Vânzare|Sell)\s*[:\-]?\s*([\d.,]+)/i.exec(windowText);
    if (labelMatch) {
      const sellLabeled = Number(labelMatch[2].replace(/,/g, "."));
      if (Number.isFinite(sellLabeled) && sellLabeled > 0) {
        return sellLabeled;
      }
    }
  }

  // Fallback: expect a row like: "... EUR ... <BNR> <Buy/Cumpărare> <Sell/Vânzare>"
  // Capture three numbers after EUR and take the 3rd as selling
  const m = /\b(EUR|EURO)\b\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i.exec(text);
  if (!m) throw new Error("EUR selling rate not found on RAI page");
  const sell = Number(m[4].replace(/,/g, "."));
  if (!Number.isFinite(sell) || sell <= 0) {
    throw new Error("Invalid RAI selling rate value");
  }
  return sell;
}

export async function getDailyRaiEurSell(options?: { forceRefresh?: boolean }) {
  const date = todayBucharest();
  const force = options?.forceRefresh === true;

  if (process.env.MONGODB_URI && process.env.MONGODB_DB) {
    const db = await getDb();
    const coll = db.collection<RaiRateDoc>("exchange_rates");
    if (!force) {
      const doc = await coll.findOne({ key: "RAI_EUR_SELL", date });
      if (doc) return { rate: doc.rate, date, source: "db" as const };
    }
    try {
      const rate = await fetchRaiEurSell();
      await coll.updateOne(
        { key: "RAI_EUR_SELL", date },
        { $set: { key: "RAI_EUR_SELL", date, rate, fetchedAt: new Date() } },
        { upsert: true }
      );
      return { rate, date, source: "rai" as const };
    } catch (err) {
      // Fallback to the most recent cached value if available
      const last = await coll
        .find({ key: "RAI_EUR_SELL" })
        .sort({ date: -1 })
        .limit(1)
        .toArray();
      if (last[0]) {
        return { rate: last[0].rate, date: last[0].date, source: "db-stale" as const };
      }
      throw err;
    }
  }

  const rate = await fetchRaiEurSell();
  return { rate, date, source: "rai" as const };
}
