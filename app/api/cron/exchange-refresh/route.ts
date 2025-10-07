import { NextRequest } from "next/server";
import { getDailyEurRon } from "@/lib/exchange";
import { getDailyBtEurSell } from "@/lib/exchange-bt";
import { updateContractsExchangeRate } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Optional auth: if CRON_SECRET is set, allow call when any of these match:
  // - header x-cron-secret or x-cron-key equals CRON_SECRET
  // - query ?secret= or ?key= equals CRON_SECRET
  // Additionally, if the request carries x-vercel-cron header, allow it
  // so Vercel Cron Jobs can trigger without embedding secrets in the repo.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const headers = req.headers;
    const url = new URL(req.url);
    const provided =
      headers.get("x-cron-secret") ||
      headers.get("x-cron-key") ||
      url.searchParams.get("secret") ||
      url.searchParams.get("key");
    const isVercelCron = headers.has("x-vercel-cron");
    if (!isVercelCron && provided !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const [bnr, bt] = await Promise.all([
      getDailyEurRon({ forceRefresh: true }),
      getDailyBtEurSell({ forceRefresh: true }),
    ]);

    // Update contracts to use the official BNR rate by default
    let updated = 0;
    try {
      updated = await updateContractsExchangeRate(bnr.rate, true);
    } catch (e) {
      // If DB not configured, ignore
    }

    return Response.json({
      ok: true,
      bnr,
      bt,
      contractsUpdated: updated,
      note: "Contracts exchangeRateRON updated to BNR rate.",
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
