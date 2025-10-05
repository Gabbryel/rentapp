import { fetchContracts, effectiveEndDate } from "@/lib/contracts";
// Directly import the client component; Next.js will handle the client/server boundary.
// (Avoid dynamic(... { ssr:false }) in a Server Component – not permitted in Next 15.)
import StatsCards from "@/app/components/stats-cards";
import ActionButton from "@/app/components/action-button";
import { revalidatePath } from "next/cache";
import {
  computeInvoiceFromContract,
  findInvoiceByContractAndDate,
  issueInvoiceAndGeneratePdf,
  listInvoicesForMonth,
  deleteInvoiceById,
  invalidateYearInvoicesCache,
} from "@/lib/invoices";
import ConfirmSubmit from "@/app/components/confirm-submit";

// The client component itself contains its own loading skeletons.

function fmt(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    return d.toLocaleDateString("ro-RO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateIso;
  }
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" }).format(
    n
  );
const fmtRON = (n: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" }).format(
    n
  );

export default async function HomePage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const contracts = await fetchContracts();

  // Invoices issued this month (for duplication prevention only)
  const issuedThisMonth = await listInvoicesForMonth(year, month);
  const issuedByContractAndDate = new Set(
    issuedThisMonth.map((i) => `${i.contractId}|${i.issuedAt}`)
  );
  const issuedInvoiceMap = new Map(
    issuedThisMonth.map((i) => [`${i.contractId}|${i.issuedAt}`, i])
  );

  // Build list of due invoices (contract occurrences expected this month & not yet issued)
  const due: {
    contract: any;
    issuedAt: string; // yyyy-mm-dd
    amountEUR?: number;
  }[] = [];

  const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const monthDays = daysInMonth(year, month);

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, monthDays);

  for (const c of contracts) {
    if (!c.startDate) continue;
    const start = new Date(c.startDate);
    const end = new Date(effectiveEndDate(c));
    // Skip if contract not active during this month window
    if (end < monthStart || start > monthEnd) continue;

    if (c.rentType === "monthly") {
      // Determine the invoice day for this month: use monthlyInvoiceDay, else fallback to startDate day
      const baseDay =
        typeof c.monthlyInvoiceDay === "number"
          ? c.monthlyInvoiceDay
          : new Date(c.startDate).getDate();
      const day = Math.min(Math.max(1, baseDay), monthDays);
      const issuedAt = `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const issuedDate = new Date(issuedAt);
      // Ensure the invoice day itself lies within contract active range (for first/last months)
      if (issuedDate < start || issuedDate > end) continue;
      const key = `${c.id}|${issuedAt}`;
      // Always include; UI shows already-issued status
      due.push({ contract: c, issuedAt });
    } else if (c.rentType === "yearly") {
      const entries = (c as any).yearlyInvoices as
        | { month: number; day: number; amountEUR: number }[]
        | undefined;
      if (!entries) continue;
      for (const yi of entries) {
        if (yi.month !== month) continue;
        const day = Math.min(Math.max(1, yi.day), monthDays);
        const issuedAt = `${year}-${String(month).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        const issuedDate = new Date(issuedAt);
        if (issuedDate < start || issuedDate > end) continue;
        const key = `${c.id}|${issuedAt}`;
        due.push({ contract: c, issuedAt, amountEUR: yi.amountEUR });
      }
    }
  }

  async function issueDue(formData: FormData) {
    "use server";
    try {
      const contractId = String(formData.get("contractId"));
      const issuedAt = String(formData.get("issuedAt"));
      const amountEURRaw = formData.get("amountEUR");
      const amountOverride =
        typeof amountEURRaw === "string" ? Number(amountEURRaw) : undefined;
      const contract = contracts.find((c) => c.id === contractId);
      if (!contract) return;
      if (
        typeof (amountOverride ?? contract.amountEUR) !== "number" ||
        typeof contract.exchangeRateRON !== "number"
      )
        return;
      // Prevent duplicates
      try {
        const dupe = await findInvoiceByContractAndDate(contractId, issuedAt);
        if (dupe) return;
      } catch {}
      const inv = computeInvoiceFromContract({
        contract,
        issuedAt,
        amountEUROverride: amountOverride,
      });
      await issueInvoiceAndGeneratePdf(inv);
      try {
        invalidateYearInvoicesCache();
      } catch {}
    } catch {}
    // Removed revalidatePath to avoid forcing full page refresh; stats updated via client events.
  }

  async function deleteIssued(formData: FormData) {
    "use server";
    try {
      const contractId = String(formData.get("contractId"));
      const issuedAt = String(formData.get("issuedAt"));
      // Locate invoice
      const inv = await findInvoiceByContractAndDate(contractId, issuedAt);
      if (inv) {
        await deleteInvoiceById(inv.id);
        try {
          invalidateYearInvoicesCache();
        } catch {}
      }
    } catch {}
    // Removed revalidatePath to avoid forcing full page refresh; stats updated via client events.
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-12">
      <div className="mx-auto max-w-screen-2xl">
        <section className="mb-10">
          <h2 className="text-2xl font-semibold tracking-tight mb-4">
            Statistici
          </h2>
          <StatsCards />
        </section>
        <h1 className="text-fluid-4xl font-semibold tracking-tight mb-8">
          Facturi de emis luna aceasta
        </h1>
        {due.length === 0 ? null : (
          <section className="mb-8 rounded-xl border border-foreground/10 bg-background/70 p-5">
            <h2 className="text-lg font-semibold mb-3">Lista</h2>
            <ul className="divide-y divide-foreground/10">
              {due
                .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))
                .map((d) => {
                  const key = `${d.contract.id}|${d.issuedAt}`;
                  const already = issuedByContractAndDate.has(key);
                  const amtEUR =
                    typeof d.amountEUR === "number"
                      ? d.amountEUR
                      : typeof d.contract.amountEUR === "number"
                      ? d.contract.amountEUR
                      : undefined;
                  const rate =
                    typeof d.contract.exchangeRateRON === "number"
                      ? d.contract.exchangeRateRON
                      : undefined;
                  const corrPct =
                    typeof d.contract.correctionPercent === "number"
                      ? d.contract.correctionPercent
                      : 0;
                  const tvaPct =
                    typeof d.contract.tvaPercent === "number"
                      ? d.contract.tvaPercent
                      : 0;
                  const correctedEUR =
                    typeof amtEUR === "number"
                      ? amtEUR * (1 + corrPct / 100)
                      : undefined;
                  const netRON =
                    typeof correctedEUR === "number" && typeof rate === "number"
                      ? correctedEUR * rate
                      : undefined;
                  const vatRON =
                    typeof netRON === "number"
                      ? netRON * (tvaPct / 100)
                      : undefined;
                  const totalRON =
                    typeof netRON === "number"
                      ? netRON + (vatRON ?? 0)
                      : undefined;

                  return (
                    <li
                      key={key}
                      className="py-3 flex items-center gap-3 flex-wrap"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {d.contract.name}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[#E9E294] text-lg">
                            {d.contract.partner}
                          </span>
                          <span className="text-foreground/60">
                            · Data: {fmt(d.issuedAt)}
                          </span>
                        </div>
                        <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[1rem]">
                          <div>
                            <span className="text-foreground/60">EUR:</span>{" "}
                            <span className="font-medium text-indigo-700 dark:text-indigo-400">
                              {typeof amtEUR === "number"
                                ? fmtEUR(amtEUR)
                                : "Indisponibil"}
                            </span>
                          </div>
                          <div>
                            <span className="text-foreground/60">Curs:</span>{" "}
                            <span className="font-medium text-cyan-700 dark:text-cyan-400">
                              {typeof rate === "number"
                                ? `${rate.toFixed(4)} RON/EUR`
                                : "Indisponibil"}
                            </span>
                          </div>
                          <div>
                            <span className="text-foreground/60">
                              EUR după corecție
                            </span>{" "}
                            {corrPct ? (
                              <span className="text-foreground/60">
                                ({corrPct}%)
                              </span>
                            ) : null}
                            :{" "}
                            <span className="font-medium text-indigo-700 dark:text-indigo-400">
                              {typeof correctedEUR === "number"
                                ? fmtEUR(correctedEUR)
                                : "Indisponibil"}
                            </span>
                          </div>
                          <div>
                            <span className="text-foreground/60">
                              RON după corecție:
                            </span>{" "}
                            <span className="font-medium text-sky-700 dark:text-sky-400">
                              {typeof netRON === "number"
                                ? fmtRON(netRON)
                                : "Indisponibil"}
                            </span>
                          </div>
                          <div>
                            <span className="text-foreground/60">
                              TVA{tvaPct ? ` (${tvaPct}%)` : ""}:
                            </span>{" "}
                            <span className="font-medium text-rose-700 dark:text-rose-400">
                              {typeof vatRON === "number"
                                ? fmtRON(vatRON)
                                : "Indisponibil"}
                            </span>
                          </div>
                          <div>
                            <span className="text-foreground/60">
                              Total RON:
                            </span>{" "}
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">
                              {typeof totalRON === "number"
                                ? fmtRON(totalRON)
                                : "Indisponibil"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {already ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            title={`Factura emisă (#${
                              issuedInvoiceMap.get(key)?.number ||
                              issuedInvoiceMap.get(key)?.id ||
                              "–"
                            })`}
                          >
                            <svg
                              className="h-5 w-5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-label="Factura emisă"
                            >
                              <path d="M9 12l2 2 4-4" />
                              <circle cx="12" cy="12" r="9" />
                            </svg>
                          </span>
                          <form
                            action={deleteIssued}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="hidden"
                              name="contractId"
                              value={d.contract.id}
                            />
                            <input
                              type="hidden"
                              name="issuedAt"
                              value={d.issuedAt}
                            />
                            <ConfirmSubmit
                              className="rounded-md border px-2.5 py-1.5 text-base font-semibold flex items-center justify-center border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                              title="Șterge factura emisă"
                              successMessage="Factura a fost ștearsă"
                              confirmMessage="Sigur dorești să ștergi această factură emisă?"
                              triggerStatsRefresh
                              data-delta-mode="delete"
                              data-delta-month-ron={
                                typeof totalRON === "number"
                                  ? String(totalRON)
                                  : undefined
                              }
                              data-delta-month-net-ron={
                                typeof netRON === "number"
                                  ? String(netRON)
                                  : undefined
                              }
                              data-delta-month-eur={
                                typeof correctedEUR === "number"
                                  ? String(correctedEUR)
                                  : undefined
                              }
                              data-delta-annual-ron={
                                typeof totalRON === "number"
                                  ? String(totalRON)
                                  : undefined
                              }
                              data-delta-annual-net-ron={
                                typeof netRON === "number"
                                  ? String(netRON)
                                  : undefined
                              }
                              data-delta-annual-eur={
                                typeof correctedEUR === "number"
                                  ? String(correctedEUR)
                                  : undefined
                              }
                            >
                              <svg
                                className="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-label="Șterge factura emisă"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                                <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
                              </svg>
                            </ConfirmSubmit>
                          </form>
                        </div>
                      ) : (
                        <form
                          action={issueDue}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="contractId"
                            value={d.contract.id}
                          />
                          <input
                            type="hidden"
                            name="issuedAt"
                            value={d.issuedAt}
                          />
                          {typeof d.amountEUR === "number" ? (
                            <input
                              type="hidden"
                              name="amountEUR"
                              value={String(d.amountEUR)}
                            />
                          ) : null}
                          <ActionButton
                            className="rounded-md border px-2.5 py-1.5 text-base font-semibold flex items-center justify-center border-foreground/20 hover:bg-foreground/5"
                            title="Emite factura"
                            successMessage="Factura a fost emisă"
                            triggerStatsRefresh
                            data-delta-mode="issue"
                            data-delta-month-ron={
                              typeof totalRON === "number"
                                ? String(totalRON)
                                : undefined
                            }
                            data-delta-month-net-ron={
                              typeof netRON === "number"
                                ? String(netRON)
                                : undefined
                            }
                            data-delta-month-eur={
                              typeof correctedEUR === "number"
                                ? String(correctedEUR)
                                : undefined
                            }
                            data-delta-annual-ron={
                              typeof totalRON === "number"
                                ? String(totalRON)
                                : undefined
                            }
                            data-delta-annual-net-ron={
                              typeof netRON === "number"
                                ? String(netRON)
                                : undefined
                            }
                            data-delta-annual-eur={
                              typeof correctedEUR === "number"
                                ? String(correctedEUR)
                                : undefined
                            }
                          >
                            <svg
                              className="h-5 w-5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-label="Emite factura"
                            >
                              <path d="M12 5v14" />
                              <path d="M5 12h14" />
                              <circle cx="12" cy="12" r="9" />
                            </svg>
                          </ActionButton>
                        </form>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
