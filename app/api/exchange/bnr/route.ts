import { NextResponse } from "next/server";
import { getDailyEurRon } from "@/lib/exchange";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const res = await getDailyEurRon({ forceRefresh: false });
    return NextResponse.json({ rate: res.rate, date: res.date, source: res.source || "bnr" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unavailable" }, { status: 503 });
  }
}
