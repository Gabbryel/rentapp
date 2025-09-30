import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Deprecated: Raiffeisen refresh endpoint removed.
export async function GET() {
  return NextResponse.json({ ok: false, error: "Endpoint removed" }, { status: 410 });
}
