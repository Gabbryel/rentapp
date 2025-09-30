import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/mongodb";
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
  // If no current user but a session cookie exists, clear it here (route handlers can mutate cookies)
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!user && token) {
      cookieStore.delete("session");
    }
  } catch {}
  // Refresh rolling session cookie (14 days) and lastActiveAt on each /api/me call
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (token && process.env.MONGODB_URI) {
      const db = await getDb();
      await db.collection("sessions").updateOne({ token }, { $set: { lastActiveAt: new Date() } });
      const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60;
      cookieStore.set("session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: TWO_WEEKS_SECONDS,
      });
    }
  } catch {}
  return NextResponse.json({ email, isAdmin: Boolean(admin) });
}
