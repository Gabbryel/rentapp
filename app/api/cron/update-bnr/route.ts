import { NextRequest, NextResponse } from "next/server";
import { getDailyEurRon } from "@/lib/exchange";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Note: kept for backward compatibility. Prefer /api/cron/exchange-refresh
  // which refreshes BNR and BT and updates contracts in one call.
  // Optional shared-secret guard
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = req.nextUrl.searchParams.get("secret") || req.headers.get("x-cron-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { rate, date } = await getDailyEurRon({ forceRefresh: true });

    // If no DB configured, just return the rate
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ ok: true, rate, date, updatedContracts: 0, note: "No DB configured" });
    }

    const db = await getDb();
    const res = await db
      .collection("contracts")
      .updateMany({ amountEUR: { $exists: true } }, { $set: { exchangeRateRON: rate } });

    // Best-effort logging (no hard dependency)
    try {
      const { logAction } = await import("@/lib/audit");
      await logAction({
        action: "exchange.cron.update",
        targetType: "system",
        targetId: "BNR",
        meta: { rate, date, matchedCount: (res as any).matchedCount, modifiedCount: (res as any).modifiedCount },
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      rate,
      date,
      matchedCount: (res as any).matchedCount,
      modifiedCount: (res as any).modifiedCount,
    });
  } catch (e) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
