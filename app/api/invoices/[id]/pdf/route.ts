import { NextResponse } from "next/server";
import { renderInvoicePdf, fetchInvoiceById, computeInvoiceFromContract } from "@/lib/invoices";
import { fetchContractById } from "@/lib/contracts";
import { saveBufferAsUpload } from "@/lib/storage";
import { getDb } from "@/lib/mongodb";
import { readJson, writeJson } from "@/lib/local-store";
import { type Invoice, InvoiceSchema } from "@/lib/schemas/invoice";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    let inv = await fetchInvoiceById(id);
    if (!inv) {
      // Optional fallback if id looks like contractId-YYYY-MM-DD
      const m = /^(.*)-(\d{4}-\d{2}-\d{2})$/.exec(id);
      if (m) {
        const [, contractId, issuedAt] = m;
        const contract = await fetchContractById(contractId);
        if (contract) inv = computeInvoiceFromContract({ contract, issuedAt, number: id });
      }
    }
    if (!inv) return new NextResponse("Not found", { status: 404 });
    // If we already have a stored URL, redirect there
    if (inv.pdfUrl) {
      const target = new URL(inv.pdfUrl, new URL(req.url).origin).toString();
      return NextResponse.redirect(target, 307);
    }
    // Otherwise, generate and store the PDF, persist pdfUrl, then redirect
    const pdf = await renderInvoicePdf(inv);
    const saved = await saveBufferAsUpload(new Uint8Array(pdf), `${id}.pdf`, "application/pdf", {
      contractId: inv.contractId,
      partnerId: inv.partnerId,
    });
    const updated: Invoice = InvoiceSchema.parse({ ...inv, pdfUrl: saved.url, updatedAt: new Date().toISOString() });
    if (process.env.MONGODB_URI) {
      try {
        const db = await getDb();
        await db.collection<Invoice>("invoices").updateOne({ id: updated.id }, { $set: { pdfUrl: updated.pdfUrl, updatedAt: updated.updatedAt } });
      } catch {
        // fall back to local json
        const all = await readJson<Invoice[]>("invoices.json", []);
        const idx = all.findIndex((x) => x.id === updated.id);
        if (idx >= 0) all[idx] = updated; else all.push(updated);
        await writeJson("invoices.json", all);
      }
    } else {
      const all = await readJson<Invoice[]>("invoices.json", []);
      const idx = all.findIndex((x) => x.id === updated.id);
      if (idx >= 0) all[idx] = updated; else all.push(updated);
      await writeJson("invoices.json", all);
    }
    const target = new URL(saved.url, new URL(req.url).origin).toString();
    return NextResponse.redirect(target, 307);
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
