import { NextRequest, NextResponse } from "next/server";
import { fetchContracts } from "@/lib/contracts";
import { listUsers } from "@/lib/users";
import { sendMail } from "@/lib/email";

function inDays(target: string, days: number) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  const d = new Date(target);
  return d >= start && d <= end;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range");
  const range = rangeParam === "15" ? 15 : 60;
  const contracts = await fetchContracts();
  const due = contracts.filter((c) => (c.indexingDates || []).some((d) => inDays(d, range)));
  const users = await listUsers();
  const to = users.map((u) => u.email);
  if (to.length > 0 && due.length > 0) {
    const subject = `Indexări chirie în următoarele ${range} zile (${due.length})`;
    const lines = due
      .map((c) => `- ${c.name} (${c.partner}) -> ${c.indexingDates?.filter((d) => inDays(d, range)).join(", ")}`)
      .join("\n");
    await sendMail({ to, subject, text: `Contracte cu indexare: \n${lines}` });
  }
  return NextResponse.json({ ok: true, range, contracts: due.length, recipients: to.length });
}
