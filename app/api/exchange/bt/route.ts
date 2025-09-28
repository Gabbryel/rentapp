import { NextResponse } from "next/server";
import { getDailyBtEurSell } from "@/lib/exchange-bt";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDailyBtEurSell({ forceRefresh: false });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
