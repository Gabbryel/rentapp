import { NextResponse } from "next/server";
import { getDailyRaiEurSell } from "@/lib/exchange-rai";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDailyRaiEurSell({ forceRefresh: true });
    return NextResponse.json({ ok: true, ...data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
