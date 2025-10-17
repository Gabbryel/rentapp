import { fetchPartners } from "@/lib/partners";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const partners = await fetchPartners();
    // Only send minimal fields needed by the selector
    return NextResponse.json(
  partners.map(p => ({ id: p.id, name: p.name }))
    );
  } catch {
    // On error, degrade gracefully with an empty list
    return NextResponse.json([], { status: 200 });
  }
}
