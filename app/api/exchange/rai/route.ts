import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Deprecated: Raiffeisen exchange rate endpoint has been removed.
export async function GET() {
  return NextResponse.json(
    { error: "Endpoint removed" },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
