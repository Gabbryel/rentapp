import { lookupCompanyByCui, normalizeCui } from "@/lib/anaf";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("cui") ?? "";
  if (!normalizeCui(raw)) {
    return NextResponse.json(
      { error: "CUI invalid. Introdu doar cifrele (opțional prefixat cu RO)." },
      { status: 400 }
    );
  }
  try {
    const company = await lookupCompanyByCui(raw);
    if (!company) {
      return NextResponse.json(
        { error: "CUI-ul nu a fost găsit în registrul ANAF." },
        { status: 404 }
      );
    }
    return NextResponse.json(company);
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? "ANAF nu a răspuns la timp. Încearcă din nou."
        : "Interogarea ANAF a eșuat. Completează datele manual.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
