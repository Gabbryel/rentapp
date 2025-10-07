import { NextResponse } from "next/server";
import { getDailyEurRon } from "@/lib/exchange";
import { getDailyBtEurSell } from "@/lib/exchange-bt";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [bnr, bt] = await Promise.all([
      getDailyEurRon({ forceRefresh: false }),
      getDailyBtEurSell({ forceRefresh: false }),
    ]);
    return NextResponse.json(
      { bnr, bt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
