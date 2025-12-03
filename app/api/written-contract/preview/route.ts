import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { renderWrittenContractPdf } from "@/lib/written-contract-pdf";
import { WrittenContractDraftSchema } from "@/lib/schemas/written-contract";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const documentPayload =
      (payload && typeof payload === "object" && "document" in payload
        ? (payload as { document?: unknown }).document
        : payload) ?? null;
    if (!documentPayload || typeof documentPayload !== "object") {
      return NextResponse.json(
        { error: "Solicitare invalidă. Lipsesc datele contractului." },
        { status: 400 }
      );
    }

    const parsed = WrittenContractDraftSchema.parse(documentPayload);
    const pdfBytes = await renderWrittenContractPdf(parsed);
    const pdfBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    );

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=contract-scris-preview.pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Date invalide pentru generarea contractului scris.",
        },
        { status: 400 }
      );
    }
    console.error("Nu am putut genera PDF-ul contractului scris", error);
    return NextResponse.json(
      { error: "Nu am putut genera PDF-ul contractului." },
      { status: 500 }
    );
  }
}
