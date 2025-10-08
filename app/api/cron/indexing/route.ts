import { NextRequest, NextResponse } from "next/server";
// indexing notifications removed

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return NextResponse.json({ ok: false, message: "Indexing notifications disabled" });
}
