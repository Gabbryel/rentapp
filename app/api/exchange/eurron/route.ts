import { NextResponse } from "next/server";
import { getDailyEurRon } from "@/lib/exchange";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const { rate, date, source } = await getDailyEurRon({ forceRefresh: force });
    return NextResponse.json(
      { rate, date, source },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
