import { NextResponse } from "next/server";
import { fetchOwners } from "@/lib/owners";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const owners = await fetchOwners();
    // Surface minimal fields for selects
    return NextResponse.json(
      (owners || []).map((o) => ({ id: o.id, name: o.name }))
    );
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

