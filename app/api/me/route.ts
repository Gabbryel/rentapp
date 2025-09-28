import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

function envIsAdmin(email?: string | null) {
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (admins.length === 0) return false;
  return email ? admins.includes(email) : false;
}

export async function GET() {
  const user = await currentUser();
  const email = user?.email ?? null;
  const admin = user?.isAdmin || envIsAdmin(email);
  return NextResponse.json({ email, isAdmin: Boolean(admin) });
}
