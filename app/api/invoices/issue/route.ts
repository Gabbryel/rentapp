import { NextResponse } from "next/server";
import { fetchContractById, listInvoicesForContract } from "@/lib/contracts";
import { computeInvoiceFromContract, issueInvoiceAndGeneratePdf } from "@/lib/contracts";
import { resolveBilledPeriodDate } from "@/lib/contracts";
import { prepareInvoicePreview } from "@/lib/invoice-custom-period";

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

    let inv;
    if (contract.rentType === "monthly") {
      const existingInvoices = await listInvoicesForContract(contractId);
      const preview = await prepareInvoicePreview({
        contract,
        existingInvoices,
        issuedAt,
        kind: "standard",
        partnerKey: [contract.partnerId, contract.partner].filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        ),
      });
      if (!preview) {
        return NextResponse.json(
          { error: "Nu mai există sumă de facturat pentru această perioadă" },
          { status: 409 }
        );
      }
      inv = { ...preview.invoice, number: body.number };
    } else {
      inv = computeInvoiceFromContract({
        contract,
        issuedAt,
        number: body.number,
        billedAt: resolveBilledPeriodDate(contract, issuedAt),
      });
    }

    const saved = await issueInvoiceAndGeneratePdf(inv as any);
    return NextResponse.json(saved, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Eroare";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
