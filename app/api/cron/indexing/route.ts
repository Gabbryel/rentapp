import { NextRequest, NextResponse } from "next/server";
import { notifyIndexations } from "@/lib/notify";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range");
  const range = rangeParam === "1" ? 1 : rangeParam === "15" ? 15 : 60;
  const sent = await notifyIndexations(range as 1 | 15 | 60);
  return NextResponse.json({ ok: true, range, recipients: sent.sent });
}
