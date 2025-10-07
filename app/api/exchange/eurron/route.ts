import { NextResponse } from "next/server";
import { getDailyEurRon } from "@/lib/exchange";

// Force this route to always be resolved dynamically to avoid intermittent
// pre-render / chunk resolution issues observed during builds.
export const dynamic = "force-dynamic";
export const revalidate = 0; // never cache at the ISR layer

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const { rate, date, source } = await getDailyEurRon({ forceRefresh: force });
    return NextResponse.json(
      { rate, date, source: source || "bnr" },
      {
        // Prevent any CDN or browser caching so the navbar can always fetch fresh data when needed
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Unavailable" },
      { status: 500 }
    );
  }
}
