import { NextResponse } from "next/server";
import { getDailyEurRon } from "@/lib/exchange";

export const dynamic = "force-dynamic";

export async function GET() {
  const { rate, date, source } = await getDailyEurRon({ forceRefresh: true });
  return NextResponse.json({ ok: true, rate, date, source });
}
