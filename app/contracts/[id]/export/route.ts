import {
  fetchContractById,
  renderContractPdf,
  listInvoicesForContract,
} from "@/lib/contracts";
import { listDepositsForContract } from "@/lib/deposits";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const contract = await fetchContractById(id);
    if (!contract) {
      return NextResponse.json({ error: "Contract inexistent" }, { status: 404 });
    }
    const [invoices, deposits] = await Promise.all([
      listInvoicesForContract(contract.id),
      listDepositsForContract(contract.id),
    ]);
    const pdf = await renderContractPdf(contract, { invoices, deposits });
    const pdfArray = new Uint8Array(pdf);
    return new Response(pdfArray, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=\"contract-${id}.pdf\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: (err && (err.message || err.toString())) || "Eroare la generarea PDF" },
      { status: 500 }
    );
  }
}
