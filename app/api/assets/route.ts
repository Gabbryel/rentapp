import { listAssets } from "@/lib/assets";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const assets = await listAssets();
    return NextResponse.json(assets.map(a => ({ id: a.id, name: a.name })));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
