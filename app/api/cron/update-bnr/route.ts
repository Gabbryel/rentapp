// Deprecated route: kept to avoid 404 in old cron configs, but no longer updates contracts.
export const dynamic = "force-dynamic";
export async function GET() {
  return new Response(
    JSON.stringify({ ok: false, error: "Deprecated. Use /api/cron/exchange-refresh then /api/contracts/apply-exchange-rate." }),
    { status: 410, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
  );
}
