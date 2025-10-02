import { NextResponse } from "next/server";
import { fetchContractById } from "@/lib/contracts";
import { computeInvoiceFromContract, issueInvoiceAndGeneratePdf } from "@/lib/invoices";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const contractId = String(body.contractId || "").trim();
    const issuedAt = String(body.issuedAt || "").trim(); // YYYY-MM-DD
    if (!contractId || !issuedAt) {
      return NextResponse.json({ error: "contractId și issuedAt sunt obligatorii" }, { status: 400 });
    }
    const contract = await fetchContractById(contractId);
    if (!contract) return NextResponse.json({ error: "Contract inexistent" }, { status: 404 });
    if (typeof contract.amountEUR !== "number" || typeof contract.exchangeRateRON !== "number") {
      return NextResponse.json({ error: "Contractul nu are sumă EUR și curs RON/EUR definite" }, { status: 400 });
    }
    const inv = computeInvoiceFromContract({ contract, issuedAt, number: body.number });
    const saved = await issueInvoiceAndGeneratePdf(inv);
    return NextResponse.json(saved, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Eroare";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
