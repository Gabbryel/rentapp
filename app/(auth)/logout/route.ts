import { NextResponse } from "next/server";
import { currentUser, signOut } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function POST() {
  const user = await currentUser();
  await signOut();
  try {
    await logAction({ action: "auth.logout", targetType: "user", targetId: user?.email ?? "unknown", meta: {} });
  } catch {}
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"));
}
