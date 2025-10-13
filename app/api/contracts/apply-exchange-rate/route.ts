import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { updateContractsExchangeRate } from "@/lib/contracts";

export const dynamic = "force-dynamic";

// Apply the latest stored EUR/RON rate from exchange_rates to contracts.exchangeRateRON.
// Source of truth: exchange_rates collection (no external fetching here).
export async function POST() {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { ok: false, error: "MongoDB nu este configurat" },
      { status: 500 }
    );
  }
  try {
    const db = await getDb();
    const latest = await db
      .collection<{ key: string; date: string; rate: number }>(
        "exchange_rates"
      )
      .find({ key: "EURRON" })
      .sort({ date: -1 })
      .limit(1)
      .toArray();
    const doc = latest[0];
    if (!doc || typeof doc.rate !== "number" || !(doc.rate > 0)) {
      return NextResponse.json(
        { ok: false, error: "Nu există niciun curs EUR/RON înregistrat" },
        { status: 400 }
      );
    }

    const modified = await updateContractsExchangeRate(doc.rate, true);
    return NextResponse.json({ ok: true, rate: doc.rate, date: doc.date, modified });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  // Allow idempotent GET for convenience (same behavior as POST)
  return POST();
}
