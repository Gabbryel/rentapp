import { NextResponse } from "next/server";
import { getAppVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET() {
  const v = await getAppVersion();
  return NextResponse.json(v);
}
