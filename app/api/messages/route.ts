import { NextRequest } from "next/server";
import { createMessage } from "@/lib/messages";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body?.text || "").trim();
    if (!text) return new Response("Missing text", { status: 400 });
    const saved = await createMessage({ text, createdBy: body?.createdBy ?? null });
    if (!saved) return new Response("Failed", { status: 500 });
    return Response.json(saved);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
}
