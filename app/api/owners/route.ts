import { NextResponse } from "next/server";
import { fetchOwners } from "@/lib/owners";

export async function GET() {
  try {
    const owners = await fetchOwners();
    // Only expose id and name
    return NextResponse.json(owners.map((o) => ({ id: o.id, name: o.name })));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
