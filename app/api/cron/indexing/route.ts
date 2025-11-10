import { NextRequest, NextResponse } from "next/server";
// indexing notifications removed

export async function GET(_req: NextRequest) {
  return NextResponse.json({ ok: false, message: "Indexing notifications disabled" });
}
