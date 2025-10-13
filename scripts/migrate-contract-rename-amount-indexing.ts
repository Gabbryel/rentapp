import dotenv from "dotenv";
import { getDb } from "../lib/mongodb";
import { computeFutureIndexingDates } from "../lib/contracts";

dotenv.config();

type AnyObj = Record<string, any>;

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MongoDB nu este configurat (MONGODB_URI lipsă). Renunț.");
    process.exit(1);
  }
  const db = await getDb();
  const col = db.collection("contracts");

  const cursor = col.find({}, { projection: { _id: 0 } });
  let updated = 0;
  while (await cursor.hasNext()) {
    const doc = (await cursor.next()) as AnyObj;
    if (!doc) continue;
    const patch: AnyObj = {};
    const unset: AnyObj = {};

    // 1) Copy amountEUR -> rentAmountEuro if missing
    if (typeof doc.rentAmountEuro !== "number" && typeof doc.amountEUR === "number" && doc.amountEUR > 0) {
      patch.rentAmountEuro = doc.amountEUR;
    }

    // 2) Convert futureIndexingDates -> indexingDates
    const hasSchedule = Number.isInteger(doc.indexingDay) && doc.indexingDay >= 1 && doc.indexingDay <= 31 &&
      Number.isInteger(doc.howOftenIsIndexing) && doc.howOftenIsIndexing >= 1 && doc.howOftenIsIndexing <= 12;
    const legacy = Array.isArray(doc.futureIndexingDates) ? doc.futureIndexingDates : undefined;
    if (hasSchedule) {
      let base = computeFutureIndexingDates(doc as any);
      if (legacy && legacy.length > 0) {
        // Map legacy into new shape and merge over base by forecastDate
        const mappedLegacy = legacy
          .map((it: any) => {
            if (typeof it === "string") return { forecastDate: it.slice(0, 10), done: false };
            if (it && typeof it === "object") return { forecastDate: String(it.date).slice(0, 10), done: Boolean(it.saved) };
            return null;
          })
          .filter(Boolean) as Array<{ forecastDate: string; done: boolean }>;
        base = base.map((b) => {
          const hit = mappedLegacy.find((m) => m.forecastDate === b.forecastDate);
          return hit ? { ...b, done: Boolean(hit.done) } : b;
        });
      }
      patch.indexingDates = base;
    }

    // 3) Seed initial rentHistory if empty and amount present
    const history = Array.isArray(doc.rentHistory) ? doc.rentHistory : [];
    const currentAmount: number | undefined =
      typeof patch.rentAmountEuro === "number" ? patch.rentAmountEuro : (typeof doc.rentAmountEuro === "number" ? doc.rentAmountEuro : undefined);
    if (history.length === 0 && typeof currentAmount === "number" && currentAmount > 0) {
      const start = (doc.startDate || doc.signedAt || new Date().toISOString().slice(0, 10)).slice(0, 10);
      patch.rentHistory = [
        {
          changedAt: start,
          rentAmountEuro: currentAmount,
          exchangeRateRON: typeof doc.exchangeRateRON === "number" ? doc.exchangeRateRON : undefined,
          correctionPercent: typeof doc.correctionPercent === "number" ? doc.correctionPercent : undefined,
          tvaPercent: Number.isInteger(doc.tvaPercent) ? doc.tvaPercent : undefined,
          note: "inițial",
        },
      ];
    }

    // 4) Unset legacy fields
    if (Object.prototype.hasOwnProperty.call(doc, "amountEUR")) unset.amountEUR = "";
    if (Object.prototype.hasOwnProperty.call(doc, "futureIndexingDates")) unset.futureIndexingDates = "";

    if (Object.keys(patch).length > 0 || Object.keys(unset).length > 0) {
      await col.updateOne({ id: doc.id }, { ...(Object.keys(patch).length ? { $set: patch } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) });
      updated++;
    }
  }

  console.log(`Contracte actualizate: ${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
