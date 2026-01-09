import { notFound } from "next/navigation";
import { fetchInvoiceById, computeInvoiceFromContract } from "@/lib/contracts";
import { fetchContractById } from "@/lib/contracts";

function fmtEUR(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}
function fmtRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 2,
  }).format(n);
}

export default async function InvoiceHtmlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let inv = await fetchInvoiceById(id);
  if (!inv) {
    const m = /^(.*)-(\d{4}-\d{2}-\d{2})$/.exec(id);
    if (m) {
      const [, contractId, issuedAt] = m;
      const contract = await fetchContractById(contractId);
      if (contract)
        inv = computeInvoiceFromContract({ contract, issuedAt, number: id });
    }
  }
  if (!inv) return notFound();

  return (
    <div className="p-6 print:p-0 max-w-3xl mx-auto text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Factura</h1>
          <div className="text-foreground/70">Număr: {inv.id}</div>
          <div className="text-foreground/70">Data: {inv.issuedAt}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{inv.owner}</div>
          <div className="text-foreground/70">Vânzător</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-foreground/60">
            Client
          </div>
          <div className="font-medium">{inv.partner}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-foreground/60">
            Contract
          </div>
          <div className="font-medium">{inv.contractName}</div>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-foreground/15 overflow-hidden">
        <table className="w-full">
          <thead className="bg-foreground/5 text-foreground/70">
            <tr>
              <th className="text-left px-3 py-2">Descriere</th>
              <th className="text-right px-3 py-2">Valoare</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-foreground/10">
              <td className="px-3 py-2">Suma (EUR)</td>
              <td className="px-3 py-2 text-right">{fmtEUR(inv.amountEUR)}</td>
            </tr>
            <tr className="border-t border-foreground/10">
              <td className="px-3 py-2">
                Corecție {inv.correctionPercent}% (EUR după corecție)
              </td>
              <td className="px-3 py-2 text-right">
                {fmtEUR(inv.correctedAmountEUR)}
              </td>
            </tr>
            <tr className="border-t border-foreground/10">
              <td className="px-3 py-2">Curs RON/EUR</td>
              <td className="px-3 py-2 text-right">
                {inv.exchangeRateRON.toFixed(4)}
              </td>
            </tr>
            <tr className="border-t border-foreground/10">
              <td className="px-3 py-2">Bază RON</td>
              <td className="px-3 py-2 text-right">{fmtRON(inv.netRON)}</td>
            </tr>
            <tr className="border-t border-foreground/10">
              <td className="px-3 py-2">TVA {inv.tvaPercent}%</td>
              <td className="px-3 py-2 text-right">{fmtRON(inv.vatRON)}</td>
            </tr>
            <tr className="border-t border-foreground/10 bg-foreground/5 font-semibold">
              <td className="px-3 py-2">Total de plată</td>
              <td className="px-3 py-2 text-right">{fmtRON(inv.totalRON)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-xs text-foreground/60">
        Factură generată pentru contractul „{inv.contractName}”.
      </div>
    </div>
  );
}
