import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { logAction } from "@/lib/audit";
import { getHicpIndex } from "@/lib/inflation";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const { fromMonth, toMonth } = (body ?? {}) as { fromMonth?: string; toMonth?: string };
    if (!fromMonth) {
      return NextResponse.json({ error: "fromMonth is required (YYYY-MM)" }, { status: 400 });
    }
    const toM = toMonth ?? new Date().toISOString().slice(0, 7);

    const [startIdx, endIdx] = await Promise.all([
      getHicpIndex(fromMonth),
      getHicpIndex(toM),
    ]);
    if (startIdx == null || endIdx == null) {
      return NextResponse.json({ error: "HICP index unavailable for requested months" }, { status: 424 });
    }
    const localPercent = ((endIdx / startIdx) - 1) * 100;

    const apiKey = process.env.OPENAI_API_KEY;
  let aiPercent: number | null = null;
  let reason: string | undefined;
    if (apiKey) {
      const prompt = `Given a starting HICP index of ${startIdx.toFixed(4)} and an ending index of ${endIdx.toFixed(4)}, compute the percentage inflation as ((end/start)-1)*100. Return only the number with up to 6 decimals, no symbols or extra text.`;
      const models = ["gpt-4o-mini", "gpt-4o", "gpt-4o-mini-2024-07-18"];
      for (const model of models) {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "You are a precise math assistant." },
              { role: "user", content: prompt },
            ],
            temperature: 0,
          }),
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          reason = `OpenAI error for ${model}: ${txt}`;
          continue;
        }
        const data = await resp.json();
        const content: string | undefined = data?.choices?.[0]?.message?.content;
        const parsed = content ? parseFloat(content.replace(/[^0-9+\-\.eE]/g, "")) : NaN;
        if (Number.isFinite(parsed)) {
          aiPercent = parsed;
          reason = undefined;
          break;
        } else {
          reason = "Nu am putut interpreta răspunsul AI.";
        }
      }
    }

  const verified = aiPercent != null ? Math.abs(aiPercent - localPercent) < 1e-6 : false;

    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ localPercent, aiPercent, verified, saved: false, reason: reason ?? "MongoDB not configured" });
    }

    const db = await getDb();
    const now = new Date();
    await db.collection("contracts").updateOne(
      { id },
      {
        $set: {
          inflationVerified: verified,
          inflationVerifiedAt: now,
          inflationFromMonth: fromMonth,
          inflationToMonth: toM,
          inflationLocalPercent: localPercent,
          inflationAiPercent: aiPercent,
        },
      }
    );

    try {
      await logAction({
        action: "inflation.verify",
        targetType: "contract",
        targetId: id,
        meta: { fromMonth, toMonth: toM, localPercent, aiPercent, verified },
      });
    } catch {}

  return NextResponse.json({ localPercent, aiPercent, verified, saved: true, reason });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
