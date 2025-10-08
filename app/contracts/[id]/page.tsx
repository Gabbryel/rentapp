import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import ContractScans from "@/app/components/contract-scans";
import ManageContractScans from "./scans/ManageContractScans";
import InvoiceViewer from "@/app/components/invoice-viewer";
import { effectiveEndDate, fetchContractById, upsertContract } from "@/lib/contracts";
import { logAction } from "@/lib/audit";
import {
  listInvoicesForContract,
  computeInvoiceFromContract,
  issueInvoiceAndGeneratePdf,
  deleteInvoiceById,
  updateInvoiceNumber,
} from "@/lib/invoices";
import { computeNextMonthProration } from "@/lib/advance-billing";

// Helpers ------------------------------------------------------
function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" }).format(
    n
  );

const fmtRON = (n: number) =>
  new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 2,
  }).format(n);

// Server Actions ------------------------------------------------
async function applyDoneIndexing(formData: FormData) {
  "use server";
  const contractId = formData.get("contractId") as string;
  const indexingDate = formData.get("indexingDate") as string; // required
  const newAmountEUR = parseFloat(String(formData.get("newAmountEUR")));
  if (!contractId || !indexingDate || isNaN(newAmountEUR)) return;
  const existing = await fetchContractById(contractId);
  if (!existing) return;
  const effEnd = new Date(effectiveEndDate(existing));
  const idxDate = new Date(indexingDate);
  const today = new Date();
  if (isNaN(idxDate.getTime()) || idxDate > today || idxDate >= effEnd) {
    await logAction({
      action: "contract.indexing.done.rejected",
      targetType: "contract",
      targetId: contractId,
      meta: {
        indexingDate,
        reason: isNaN(idxDate.getTime())
          ? "invalid-date"
          : idxDate > today
          ? "future-date"
          : "on-or-after-effective-end",
      },
    });
    return;
  }
  // Yearly restriction
  const year = idxDate.getFullYear();
  const history = Array.isArray((existing as any).rentHistory)
    ? (existing as any).rentHistory
    : [];
  const existingYear = history.some((h: any) => {
    if (!h || typeof h.note !== "string" || !h.note.startsWith("indexare"))
      return false;
    const token = h.note.split(/\s+/)[1];
    if (!token || token === "imediat") return false;
    const d = new Date(token);
    return !isNaN(d.getTime()) && d.getFullYear() === year;
  });
  if (existingYear) {
    await logAction({
      action: "contract.indexing.done.rejected",
      targetType: "contract",
      targetId: contractId,
      meta: { indexingDate, reason: "already-indexed-year", year },
    });
    return;
  }
  const rentHistory = Array.isArray(existing.rentHistory)
    ? [...existing.rentHistory]
    : [];
  rentHistory.push({
    changedAt: new Date().toISOString().slice(0, 10),
    amountEUR: existing.amountEUR,
    exchangeRateRON: existing.exchangeRateRON,
    correctionPercent: existing.correctionPercent,
    tvaPercent: existing.tvaPercent,
    note: `indexare ${indexingDate}`,
  } as any);
  // indexingDates removed (scheduled future dates deprecated)
  await upsertContract({ ...existing, amountEUR: newAmountEUR, rentHistory } as any);
  await logAction({
    action: "contract.indexing.done",
    targetType: "contract",
    targetId: contractId,
    meta: { indexingDate, newAmountEUR, removedScheduled: true },
  });
  revalidatePath(`/contracts/${contractId}`);
}

async function undoLastIndexing(formData: FormData) {
  "use server";
  const contractId = formData.get("contractId") as string;
  if (!contractId) return;
  const existing = await fetchContractById(contractId);
  if (!existing) return;
  const rentHistory = Array.isArray((existing as any).rentHistory)
    ? [...(existing as any).rentHistory]
    : [];
  const indexationSnapshots = rentHistory.filter(
    (h: any) => h && typeof h.note === "string" && h.note.startsWith("indexare")
  );
  if (indexationSnapshots.length === 0) return;
  indexationSnapshots.sort((a: any, b: any) =>
    String(a.changedAt).localeCompare(String(b.changedAt))
  );
  const last = indexationSnapshots[indexationSnapshots.length - 1];
  const lastIdx = rentHistory.indexOf(last);
  if (lastIdx === -1) return;
  const previousAmount = last.amountEUR;
  rentHistory.splice(lastIdx, 1);
  await upsertContract({
    ...existing,
    amountEUR: previousAmount,
    rentHistory,
  } as any);
  await logAction({
    action: "contract.indexing.undo",
    targetType: "contract",
    targetId: contractId,
    meta: { revertedTo: previousAmount, undoneChangedAt: last.changedAt },
  });
  revalidatePath(`/contracts/${contractId}`);
}

async function issueInvoice(formData: FormData) {
  "use server";
  const contractId = formData.get("contractId") as string;
  if (!contractId) return;
  const issuedAt =
    (formData.get("issuedAt") as string) ||
    new Date().toISOString().slice(0, 10);
  const contract = await fetchContractById(contractId);
  if (!contract) return;
  const invoiceData = computeInvoiceFromContract({ contract, issuedAt });
  const savedInvoice = await issueInvoiceAndGeneratePdf(invoiceData);
  await logAction({
    action: "invoice.issue",
    targetType: "contract",
    targetId: contractId,
    meta: { issuedAt, invoiceId: savedInvoice.id },
  });
  revalidatePath(`/contracts/${contractId}`);
}

async function deleteInvoice(formData: FormData) {
  "use server";
  const invoiceId = formData.get("invoiceId") as string;
  if (!invoiceId) return;
  await deleteInvoiceById(invoiceId);
  await logAction({
    action: "invoice.delete",
    targetType: "invoice",
    targetId: invoiceId,
  });
  revalidatePath("/contracts");
}

async function editInvoiceNumber(formData: FormData) {
  "use server";
  const invoiceId = formData.get("invoiceId") as string;
  const number = formData.get("number") as string;
  if (!invoiceId) return;
  if (number) await updateInvoiceNumber(invoiceId, number);
  await logAction({
    action: "invoice.number.update",
    targetType: "invoice",
    targetId: invoiceId,
    meta: { number },
  });
  revalidatePath("/contracts");
}

// Page Component ------------------------------------------------
export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await fetchContractById(id);
  if (!contract) return notFound();
  const invoices = await listInvoicesForContract(contract.id);

  const today = new Date();
  const isExpired = new Date(effectiveEndDate(contract)) < today;

  const invoiceMonthMode =
    (contract as any).invoiceMonthMode === "next" ? "next" : "current";
  let dueAt: string | undefined;
  if (
    contract.rentType === "monthly" &&
    typeof contract.monthlyInvoiceDay === "number"
  ) {
    const day = contract.monthlyInvoiceDay;
    const base = new Date(today.getFullYear(), today.getMonth(), day);
    const target =
      invoiceMonthMode === "next"
        ? new Date(today.getFullYear(), today.getMonth() + 1, day)
        : base;
    const start = new Date(contract.startDate);
    const end = new Date(effectiveEndDate(contract));
    if (target >= start && target <= end)
      dueAt = target.toISOString().slice(0, 10);
  }

  let advanceFraction: number | undefined;
  if (invoiceMonthMode === "next") {
    const { include, fraction } = computeNextMonthProration(
      contract as any,
      today.getFullYear(),
      today.getMonth() + 1
    );
    advanceFraction = include ? fraction : undefined;
  }

  // indexingDates removed: no future scheduling

  const alreadyIssuedForThisMonth = Boolean(
    dueAt && invoices.some((inv) => inv.issuedAt === dueAt)
  );

  // Build indexation history from rentHistory snapshots
  const historyRaw = Array.isArray((contract as any).rentHistory)
    ? (contract as any).rentHistory.filter(
        (h: any) =>
          h &&
          typeof h === "object" &&
          typeof h.changedAt === "string" &&
          typeof h.amountEUR === "number" &&
          typeof h.note === "string" &&
          h.note.startsWith("indexare")
      )
    : [];
  historyRaw.sort((a: any, b: any) => a.changedAt.localeCompare(b.changedAt));
  type Indexation = {
    date: string;
    appliedAt: string;
    from: number;
    to: number;
  };
  const indexations: Indexation[] = [];
  for (let i = 0; i < historyRaw.length; i++) {
    const snap = historyRaw[i];
    const parts = snap.note.split(/\s+/);
    const maybeDate = parts[1];
    let effectiveDate = snap.changedAt;
    if (
      maybeDate &&
      maybeDate !== "imediat" &&
      /\d{4}-\d{2}-\d{2}/.test(maybeDate)
    )
      effectiveDate = maybeDate;
    const from = snap.amountEUR;
    let to: number;
    if (i + 1 < historyRaw.length)
      to = historyRaw[i + 1].amountEUR; // next snapshot previous amount
    else
      to = typeof contract.amountEUR === "number" ? contract.amountEUR : from;
    // Always record the indexing, even if to === from (0% change) so the action is visible.
    indexations.push({
      date: effectiveDate,
      appliedAt: snap.changedAt,
      from,
      to,
    });
  }
  indexations.sort((a, b) => b.date.localeCompare(a.date));
  const hasFuture = false; // always false (feature removed)

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm text-foreground/70 hover:underline">
          ← Înapoi la listă
        </Link>
      </div>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-base text-[#E9E294] font-semibold tracking-wide">
            {contract.partnerId ? (
              <Link
                href={`/partners/${contract.partnerId}`}
                className="hover:underline decoration-dotted underline-offset-4"
              >
                {contract.partner}
              </Link>
            ) : (
              <Link
                href={`/partners/${encodeURIComponent(contract.partner)}`}
                className="hover:underline decoration-dotted underline-offset-4"
              >
                {contract.partner}
              </Link>
            )}
          </p>
          <h1 className="text-fluid-4xl font-bold leading-tight">
            {contract.name}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {process.env.MONGODB_URI ? (
            <Link
              href={`/contracts/${contract.id}/edit`}
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/5"
            >
              Editează
            </Link>
          ) : null}
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ring-1 ${
              isExpired
                ? "ring-red-500/20 text-red-600 dark:text-red-400"
                : "ring-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {isExpired ? "Expirat" : "Activ"}
          </span>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <div className="rounded-lg border border-foreground/15 p-4 bg-[#334443]">
            <h2 className="text-base font-semibold">Detalii</h2>
            <div className="mt-4 space-y-6 text-sm">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50 mb-2">
                  Contract
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="col-span-2 flex items-baseline gap-2">
                    <span className="text-foreground/60">Proprietar:</span>
                    <span className="font-medium truncate">
                      {String(
                        (contract as { owner?: string }).owner || ""
                      ).trim() || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-foreground/60">Semnat</span>
                    <span className="font-medium">
                      {fmt(contract.signedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-foreground/60">Început</span>
                    <span className="font-medium">
                      {fmt(contract.startDate)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-foreground/60">Expiră</span>
                    <span className="font-medium">
                      {fmt(effectiveEndDate(contract))}
                    </span>
                  </div>
                  {contract.extensionDate ? (
                    <div>
                      <span className="block text-foreground/60">
                        Prelungire
                      </span>
                      <span className="font-medium">
                        {fmt(contract.extensionDate)}
                      </span>
                    </div>
                  ) : null}
                  {typeof contract.paymentDueDays === "number" ? (
                    <div>
                      <span className="block text-foreground/60">
                        Termen plată
                      </span>
                      <span className="font-medium">
                        {contract.paymentDueDays} zile
                      </span>
                    </div>
                  ) : null}
                  {(contract as any).asset ? (
                    <div className="col-span-2">
                      <span className="block text-foreground/60">Asset</span>
                      <span className="font-medium break-all">
                        {String((contract as any).asset)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50 mb-2">
                  Facturare
                </h3>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {contract.rentType && (
                    <span className="rounded bg-foreground/5 px-2 py-1">
                      {contract.rentType === "monthly"
                        ? "Chirie lunară"
                        : "Chirie anuală"}
                    </span>
                  )}
                  {contract.rentType === "monthly" && (
                    <span
                      className="rounded bg-foreground/5 px-2 py-1"
                      title="Mod facturare"
                    >
                      {invoiceMonthMode === "next" ? "Anticipat" : "Curent"}
                    </span>
                  )}
                  {contract.rentType === "monthly" &&
                    typeof contract.monthlyInvoiceDay === "number" && (
                      <span
                        className="rounded bg-foreground/5 px-2 py-1"
                        title="Zi facturare"
                      >
                        Zi: {contract.monthlyInvoiceDay}
                      </span>
                    )}
                  {typeof contract.tvaPercent === "number" && (
                    <span
                      className="rounded bg-foreground/5 px-2 py-1"
                      title="TVA"
                    >
                      TVA {contract.tvaPercent}%
                    </span>
                  )}
                  {Array.isArray(contract.yearlyInvoices) &&
                    contract.yearlyInvoices.length > 0 && (
                      <span
                        className="rounded bg-foreground/5 px-2 py-1"
                        title="Intrări facturi anuale"
                      >
                        {contract.yearlyInvoices.length} facturi/an
                      </span>
                    )}
                </div>
              </div>

              {typeof contract.amountEUR === "number" &&
                typeof contract.exchangeRateRON === "number" && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50 mb-2">
                      Valoare
                    </h3>
                    {(() => {
                      const baseRon =
                        contract.amountEUR * contract.exchangeRateRON;
                      const corrPct =
                        typeof contract.correctionPercent === "number"
                          ? contract.correctionPercent
                          : 0;
                      const tvaPct =
                        typeof contract.tvaPercent === "number"
                          ? contract.tvaPercent
                          : 0;
                      const correctedRon = baseRon * (1 + corrPct / 100);
                      const withVatRon = correctedRon * (1 + tvaPct / 100);
                      return (
                        <div className="space-y-1 text-[11px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-foreground/5 px-2 py-1 text-indigo-700 dark:text-indigo-400 font-medium">
                              {contract.amountEUR.toFixed(2)} EUR
                            </span>
                            <span className="text-foreground/50">@</span>
                            <span className="rounded bg-foreground/5 px-2 py-1 text-cyan-700 dark:text-cyan-400">
                              {contract.exchangeRateRON.toFixed(4)} RON/EUR
                            </span>
                            <span className="text-foreground/50">=</span>
                            <span className="rounded bg-foreground/5 px-2 py-1 text-sky-700 dark:text-sky-400 font-medium">
                              {baseRon.toFixed(2)} RON
                            </span>
                          </div>
                          {corrPct > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-foreground/60">
                                Corecție {corrPct}%
                              </span>
                              <span className="rounded bg-foreground/5 px-2 py-1 text-sky-700 dark:text-sky-400">
                                {correctedRon.toFixed(2)} RON
                              </span>
                            </div>
                          )}
                          {tvaPct > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-foreground/60">
                                Cu TVA {tvaPct}%
                              </span>
                              <span className="rounded bg-foreground/5 px-2 py-1 text-emerald-700 dark:text-emerald-400 font-medium">
                                {withVatRon.toFixed(2)} RON
                              </span>
                              <span className="text-foreground/50 italic">
                                (TVA {(withVatRon - correctedRon).toFixed(2)}{" "}
                                RON)
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

              {indexations.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50 mb-2">
                    Indexare
                  </h3>
                  <div className="flex flex-col gap-3 text-[11px]">
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/40">
                        Efectuate
                      </div>
                      <div className="flex flex-col gap-1">
                        {indexations.length === 0 && (
                          <div className="italic text-foreground/40">
                            Nicio indexare efectuată încă
                          </div>
                        )}
                        {indexations.map((ix) => {
                          const diffPct =
                            ix.from !== 0
                              ? ((ix.to - ix.from) / ix.from) * 100
                              : 0;
                          return (
                            <div
                              key={ix.date + ix.appliedAt + ix.from + ix.to}
                              className="inline-flex flex-wrap items-center gap-2 rounded bg-foreground/5 px-2 py-1"
                              title={`Indexare aplicată (înregistrat ${fmt(
                                ix.appliedAt
                              )})`}
                            >
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                ✓
                              </span>
                              <span>{fmt(ix.date)}</span>
                              <span className="text-foreground/50">•</span>
                              <span className="text-indigo-700 dark:text-indigo-400 font-medium">
                                {ix.from.toFixed(2)} → {ix.to.toFixed(2)} EUR
                              </span>
                              <span
                                className={
                                  diffPct > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : diffPct < 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-foreground/40"
                                }
                              >
                                ({diffPct > 0 ? "+" : diffPct < 0 ? "" : "±"}
                                {diffPct.toFixed(2)}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Future indexings removed */}
                  </div>
                </div>
              )}

              <form
                action={applyDoneIndexing}
                className="mt-3 flex flex-wrap items-end gap-3 text-[11px] border-t border-foreground/10 pt-3"
              >
                <input type="hidden" name="contractId" value={contract.id} />
                <div>
                  <label className="block text-foreground/60 mb-1">
                    Data indexării
                  </label>
                  <input
                    name="indexingDate"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                    className="rounded-md border border-foreground/20 bg-background px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block text-foreground/60 mb-1">
                    Noua chirie (EUR)
                  </label>
                  <input
                    name="newAmountEUR"
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    placeholder={
                      typeof contract.amountEUR === "number"
                        ? contract.amountEUR.toFixed(2)
                        : "ex: 1500"
                    }
                    className="w-32 rounded-md border border-foreground/20 bg-background px-2 py-1"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-600 hover:bg-emerald-500/20"
                  title="Salvează indexarea efectuată"
                >
                  Done
                </button>
              </form>
              {indexations.length > 0 && (
                <form
                  action={undoLastIndexing}
                  className="mt-2 flex items-center gap-2 text-[11px]"
                >
                  <input type="hidden" name="contractId" value={contract.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-md border border-red-400/40 bg-red-500/10 px-2.5 py-1.5 font-semibold text-red-600 hover:bg-red-500/20"
                    title="Anulează ultima indexare"
                  >
                    Undo ultima indexare
                  </button>
                </form>
              )}
              {indexations.length === 0 && (
                <div className="mt-2 text-[11px] text-foreground/50 italic">
                  Nicio indexare înregistrată încă. Adaugă una folosind
                  formularul.
                </div>
              )}

              {advanceFraction &&
                advanceFraction > 0 &&
                advanceFraction < 1 && (
                  <div className="mt-4 text-xs text-amber-600 dark:text-amber-400">
                    Facturare parțială în avans:{" "}
                    {Math.round(advanceFraction * 100)}%
                  </div>
                )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <ContractScans
            scans={
              (contract as { scans?: { url: string; title?: string }[] })
                .scans || (contract.scanUrl ? [{ url: contract.scanUrl }] : [])
            }
            contractName={contract.name}
          />
          {process.env.MONGODB_URI && (
            <ManageContractScans
              id={contract.id}
              scans={
                (contract as { scans?: { url: string; title?: string }[] })
                  .scans ||
                (contract.scanUrl ? [{ url: contract.scanUrl }] : [])
              }
              mongoConfigured={Boolean(process.env.MONGODB_URI)}
            />
          )}
        </div>
      </section>

      {contract.rentType === "yearly" &&
        (contract.yearlyInvoices?.length ?? 0) > 0 && (
          <section className="mt-8">
            <div className="rounded-lg border border-foreground/15 p-4">
              <h2 className="text-base font-semibold">Facturi anuale</h2>
              <div className="mt-3 grid grid-cols-1 gap-4">
                {contract.yearlyInvoices!.map((inv, idx) => {
                  const eur = inv.amountEUR;
                  const rate =
                    typeof contract.exchangeRateRON === "number"
                      ? contract.exchangeRateRON
                      : undefined;
                  const corrPct =
                    typeof contract.correctionPercent === "number"
                      ? contract.correctionPercent
                      : 0;
                  const tvaPct =
                    typeof contract.tvaPercent === "number"
                      ? contract.tvaPercent
                      : 0;
                  const baseRon =
                    typeof rate === "number" ? eur * rate : undefined;
                  const correctedEur = eur * (1 + corrPct / 100);
                  const correctionRon =
                    typeof baseRon === "number"
                      ? baseRon * (corrPct / 100)
                      : undefined;
                  const correctedRon =
                    typeof baseRon === "number"
                      ? baseRon * (1 + corrPct / 100)
                      : undefined;
                  const vatAmount =
                    typeof correctedRon === "number"
                      ? correctedRon * (tvaPct / 100)
                      : undefined;
                  const withVat =
                    typeof correctedRon === "number"
                      ? correctedRon * (1 + tvaPct / 100)
                      : undefined;
                  const monthStr = String(inv.month).padStart(2, "0");
                  const dayStr = String(inv.day).padStart(2, "0");
                  return (
                    <div
                      key={`${idx}-${inv.month}-${inv.day}`}
                      className="rounded-md bg-foreground/5 p-3"
                    >
                      <div className="text-sm text-foreground/60">
                        Data: {dayStr}/{monthStr}
                      </div>
                      <div className="mt-1 space-y-1 text-sm">
                        <div>
                          <span className="text-foreground/60">EUR: </span>
                          <span className="font-medium text-indigo-700 dark:text-indigo-400">
                            {fmtEUR(eur)}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">RON: </span>
                          <span className="font-medium">
                            {typeof baseRon === "number"
                              ? fmtRON(baseRon)
                              : "Indisponibil"}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">
                            Corecție{corrPct ? ` (${corrPct}%)` : ""}:{" "}
                          </span>
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            {typeof correctionRon === "number"
                              ? fmtRON(correctionRon)
                              : "Indisponibil"}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">
                            EUR după corecție:{" "}
                          </span>
                          <span className="font-medium text-indigo-700 dark:text-indigo-400">
                            {fmtEUR(correctedEur)}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">
                            RON după corecție:{" "}
                          </span>
                          <span className="font-medium text-sky-700 dark:text-sky-400">
                            {typeof correctedRon === "number"
                              ? fmtRON(correctedRon)
                              : "Indisponibil"}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">
                            RON cu TVA{tvaPct ? ` (${tvaPct}%)` : ""}:{" "}
                          </span>
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {typeof withVat === "number"
                              ? fmtRON(withVat)
                              : "Indisponibil"}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">TVA: </span>
                          <span className="font-medium text-rose-700 dark:text-rose-400">
                            {typeof vatAmount === "number"
                              ? fmtRON(vatAmount)
                              : "Indisponibil"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

      <section className="mt-8">
        <div className="rounded-lg border border-foreground/15 p-4">
          <h2 className="text-base font-semibold">Facturi emise</h2>
          <form
            action={issueInvoice}
            className="mt-3 flex items-center gap-2 text-sm"
          >
            <input type="hidden" name="contractId" value={contract.id} />
            <label className="text-foreground/60" htmlFor="issuedAt">
              Emite la data
            </label>
            <input
              id="issuedAt"
              name="issuedAt"
              type="date"
              className="rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm"
              defaultValue={dueAt ?? new Date().toISOString().slice(0, 10)}
            />
            <button
              type="submit"
              className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                alreadyIssuedForThisMonth
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 cursor-not-allowed"
                  : "border-foreground/20 hover:bg-foreground/5"
              }`}
              disabled={alreadyIssuedForThisMonth}
            >
              Emite factura
            </button>
            {alreadyIssuedForThisMonth && (
              <span className="inline-block rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px]">
                deja emisă pentru luna curentă{dueAt ? ` (${dueAt})` : ""}
              </span>
            )}
          </form>
          <div className="mt-3 grid grid-cols-1 gap-3">
            {invoices.length === 0 ? (
              <div className="text-sm text-foreground/60">
                Nicio factură emisă.
              </div>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-md bg-foreground/5 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <div className="font-medium">
                        {inv.issuedAt} · Total{" "}
                        {new Intl.NumberFormat("ro-RO", {
                          style: "currency",
                          currency: "RON",
                        }).format(inv.totalRON)}{" "}
                        · Nr {inv.number ?? "—"}
                      </div>
                      <div className="text-foreground/60">
                        EUR {inv.amountEUR.toFixed(2)} → corecție{" "}
                        {inv.correctionPercent}% · curs{" "}
                        {inv.exchangeRateRON.toFixed(4)} · TVA {inv.tvaPercent}%
                      </div>
                    </div>
                    <InvoiceViewer
                      pdfUrl={inv.pdfUrl}
                      id={inv.id}
                      title={`Factura ${inv.number || inv.id}`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <form
                      action={editInvoiceNumber}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="invoiceId" value={inv.id} />
                      <input
                        name="number"
                        placeholder="Număr factură"
                        defaultValue={inv.number ?? ""}
                        className="rounded-md border border-foreground/20 bg-background px-2 py-1 text-xs"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5"
                      >
                        Salvează
                      </button>
                    </form>
                    <form action={deleteInvoice} className="ml-auto">
                      <input type="hidden" name="invoiceId" value={inv.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-red-300 text-red-600 px-2 py-1 text-xs font-semibold hover:bg-red-50/10"
                      >
                        Șterge
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
