import { NextResponse } from "next/server";
import { recordDiagnosticEvent } from "@/lib/diagnostics";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null) as
      | { tag?: string; step?: string; context?: Record<string, unknown> }
      | null;

    if (!body || typeof body.tag !== "string" || typeof body.step !== "string") {
      return NextResponse.json({ error: "invalid-payload" }, { status: 400 });
    }

    await recordDiagnosticEvent({
      tag: body.tag,
      step: body.step,
      context: body.context,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to record diagnostic event", error);
    return NextResponse.json({ error: "log-failed" }, { status: 500 });
  }
}
