import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { issueToken } from "@/lib/auth-tokens";
import { sendInviteEmail } from "@/lib/auth-email";
import { getDb } from "@/lib/mongodb";

export async function POST(req: Request) {
  await requireAdmin();
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const token = await issueToken(email.toLowerCase(), "invite", 168, {}); // 7 days
  await sendInviteEmail(email, token);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  await requireAdmin();
  const db = await getDb();
  const now = new Date();
  const invites = await db
    .collection("auth_tokens")
    .find({ type: "invite", expiresAt: { $gt: now } })
    .project({ token: 1, email: 1, createdAt: 1, expiresAt: 1 })
    .toArray();
  return NextResponse.json({ invites });
}

export async function DELETE(req: Request) {
  await requireAdmin();
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  const db = await getDb();
  await db.collection("auth_tokens").deleteOne({ token, type: "invite" });
  return NextResponse.json({ ok: true });
}
