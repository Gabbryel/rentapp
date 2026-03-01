import { NextResponse } from "next/server";
import { fetchContractById, listInvoicesForContract } from "@/lib/contracts";
import { prepareInvoicePreview } from "@/lib/invoice-custom-period";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const contractId = String(body.contractId || "").trim();
    const issuedAt = String(body.issuedAt || "").trim();
    const fromDate = String(body.fromDate || "").trim();
    const toDate = String(body.toDate || "").trim();
    const mode = String(body.mode || "custom_period").trim();
    const manualAmountEUR =
      body.amountEUR === undefined || body.amountEUR === null || String(body.amountEUR).trim() === ""
        ? undefined
        : Number(body.amountEUR);

    if (!contractId || !issuedAt) {
      return NextResponse.json(
        { error: "contractId și issuedAt sunt obligatorii" },
        { status: 400 }
      );
    }

    const contract = await fetchContractById(contractId);
    if (!contract) {
      return NextResponse.json({ error: "Contract inexistent" }, { status: 404 });
    }

    const existingInvoices = await listInvoicesForContract(contractId);

    const preview = await prepareInvoicePreview({
      contract,
      existingInvoices,
      issuedAt,
      kind: mode === "custom_period" ? "custom_period" : "standard",
      fromDate,
      toDate,
      manualAmountEUR:
        typeof manualAmountEUR === "number" && Number.isFinite(manualAmountEUR) && manualAmountEUR > 0
          ? manualAmountEUR
          : undefined,
      partnerKey: [
        String(body.partnerKey || "").trim(),
        contract.partnerId,
        contract.partner,
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    });

    if (!preview) {
      return NextResponse.json(
        { error: "Nu mai există sumă de facturat pentru perioada selectată" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      previewToken: preview.previewToken,
      kind: preview.kind,
      billedAt: preview.billedAt,
      periodFrom: preview.periodFrom,
      periodTo: preview.periodTo,
      totalDays: preview.totalDays,
      billedDays: preview.billedDays,
      computedAmountEUR: preview.computedAmountEUR,
      effectiveAmountEUR: preview.effectiveAmountEUR,
      exchangeRateRON: preview.exchangeRateRON,
      exchangeRateDate: preview.exchangeRateDate,
      breakdown: {
        correctedAmountEUR: preview.invoice.correctedAmountEUR,
        netRON: preview.invoice.netRON,
        vatRON: preview.invoice.vatRON,
        totalRON: preview.invoice.totalRON,
        tvaPercent: preview.invoice.tvaPercent,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Eroare la previzualizarea facturii";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
