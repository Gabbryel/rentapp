import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import ContractScans from "@/app/components/contract-scans";
import ManageContractScans from "./scans/ManageContractScans";
import InvoiceViewer from "@/app/components/invoice-viewer";
import ConfirmSubmit from "@/app/components/confirm-submit";
import ActionButton from "@/app/components/action-button";
import {
  effectiveEndDate,
  fetchContractById,
  upsertContract,
  currentRentAmount,
} from "@/lib/contracts";
import { logAction } from "@/lib/audit";
import {
  listInvoicesForContract,
  computeInvoiceFromContract,
  issueInvoiceAndGeneratePdf,
  deleteInvoiceById,
  updateInvoiceNumber,
} from "@/lib/invoices";
import { computeNextMonthProration } from "@/lib/advance-billing";
import {
  createDeposit,
  listDepositsForContract,
  updateDeposit,
  deleteDepositById,
  toggleDepositDeposited,
} from "@/lib/deposits";
import { publishToast } from "@/lib/sse";

const RO_MONTHS_SHORT = [
  "ian.",
  "feb.",
  "mar.",
  "apr.",
  "mai",
  "iun.",
  "iul.",
  "aug.",
  "sept.",
  "oct.",
  "nov.",
  "dec.",
];

function fmt(iso: string) {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d))
    return s;
  const monthName = RO_MONTHS_SHORT[Math.max(0, Math.min(11, mo - 1))];
  return `${String(d).padStart(2, "0")} ${monthName} ${y}`;
}

// Actions
async function saveIndexing(formData: FormData) {
  "use server";
  const contractId = String(formData.get("contractId") || "");
  if (!contractId) return;
  const forecastDate = String(formData.get("forecastDate") || "");
  const actualDate = String(formData.get("actualDate") || "");
  const document = String(formData.get("document") || "");
  const done = String(formData.get("done") || "") === "1";
  const newRentAmount = (() => {
    const raw = formData.get("newRentAmount");
    if (typeof raw === "string" && raw.trim() !== "") {
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }
    return undefined;
  })();
  const existing = await fetchContractById(contractId);
  if (!existing) return;
  const documentNormalized = document.trim();
  const current = Array.isArray((existing as any).indexingDates)
    ? ((existing as any).indexingDates as any[])
    : [];
  let found = false;
  const idxs = current.map((it) => {
    if (it && it.forecastDate === forecastDate) {
      found = true;
      return {
        ...it,
        actualDate: actualDate || it.actualDate || undefined,
        document:
          documentNormalized.length > 0
            ? documentNormalized
            : it.document,
        newRentAmount: typeof newRentAmount === "number" ? newRentAmount : it.newRentAmount,
        done: done || it.done,
      };
    }
    return it;
  });
  if (!found && forecastDate) {
    idxs.push({
      forecastDate,
      actualDate: actualDate || undefined,
      document: documentNormalized.length > 0 ? documentNormalized : undefined,
      newRentAmount,
      done,
    });
  }
  let patch: any = { indexingDates: idxs };
  // rent amount is now derived from rentHistory; do not write rentAmountEuro on Contract
  await upsertContract({ ...(existing as any), ...patch } as any);
  revalidatePath(`/contracts/${contractId}`);
}

async function issueInvoice(formData: FormData) {
  "use server";
  const contractId = formData.get("contractId") as string;
  if (!contractId) return;
  // Support various inputs: direct issuedAt, or year/month/day, or dateKey = MM-DD
  let issuedAt = (formData.get("issuedAt") as string) || "";
  if (!issuedAt) {
    const dateKey = (formData.get("dateKey") as string) || ""; // format MM-DD
    let year = Number(String(formData.get("year") || ""));
    let month = Number(String(formData.get("month") || ""));
    let day = Number(String(formData.get("day") || ""));
    if (dateKey && (!month || !day)) {
      const m = dateKey.match(/^(\d{1,2})-(\d{1,2})$/);
      if (m) {
        month = Number(m[1]);
        day = Number(m[2]);
      }
    }
    if (!year || !Number.isInteger(year)) {
      const t = new Date();
      year = t.getFullYear();
    }
    if (Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const y = String(year).padStart(4, "0");
      const m = String(month).padStart(2, "0");
      const d = String(day).padStart(2, "0");
      issuedAt = `${y}-${m}-${d}`;
    }
  }
  if (!issuedAt) issuedAt = new Date().toISOString().slice(0, 10);
  const contract = await fetchContractById(contractId);
  if (!contract) return;
  try {
    const amountOverride = (() => {
      const raw = formData.get("amountEUR");
      if (typeof raw === "string" && raw.trim() !== "") {
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      }
      return undefined;
    })();
    const partners: Array<{ id?: string; name: string; sharePercent?: number }> = Array.isArray((contract as any).partners)
      ? (((contract as any).partners as any[]).map((p) => ({ id: p?.id, name: p?.name, sharePercent: typeof p?.sharePercent === 'number' ? p.sharePercent : undefined })))
      : [];
    const sumShares = partners.reduce((s, p) => s + (typeof p.sharePercent === 'number' ? p.sharePercent : 0), 0);
    if (partners.length > 1 && sumShares > 0) {
      // Split issuance per partner
      // Determine base EUR for this date if no override
      const baseInv = computeInvoiceFromContract({ contract, issuedAt, amountEUROverride: amountOverride });
      const baseEUR = amountOverride ?? baseInv.amountEUR;
      for (const p of partners) {
        const share = typeof p.sharePercent === 'number' ? p.sharePercent / 100 : 0;
        if (share <= 0) continue;
        const invPart = computeInvoiceFromContract({ contract, issuedAt, amountEUROverride: baseEUR * share });
        // Override partner on the invoice
        const patched = { ...invPart, partner: p.name, partnerId: p.id || p.name } as any;
        await issueInvoiceAndGeneratePdf(patched);
      }
    } else {
      const invoiceData = computeInvoiceFromContract({ contract, issuedAt, amountEUROverride: amountOverride });
      await issueInvoiceAndGeneratePdf(invoiceData);
    }
  await logAction({
    action: "invoice.issue",
    targetType: "contract",
    targetId: contractId,
    meta: { issuedAt },
  });
  } catch (err: any) {
    const msg = (err && (err.message || err.toString())) || "Eroare la emiterea facturii";
    publishToast(String(msg), "error");
  }
  revalidatePath(`/contracts/${contractId}`);
}

async function createDepositAction(formData: FormData) {
  "use server";
  const contractId = String(formData.get("contractId") || "");
  const type = String(formData.get("type") || "bank_transfer");
  const returned = Boolean(formData.get("returned"));
  const amountEUR = (() => {
    if (!formData.has("amountEUR")) return undefined;
    const raw = String(formData.get("amountEUR") || "").trim();
    if (raw === "") return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  })();
  const amountRON = (() => {
    if (!formData.has("amountRON")) return undefined;
    const raw = String(formData.get("amountRON") || "").trim();
    if (raw === "") return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  })();
  const note = formData.get("note")
    ? String(formData.get("note") || "")
    : undefined;
  if (!contractId) return;
  await createDeposit({
    contractId,
    type: type as any,
    isDeposited: false,
    returned,
    amountEUR,
    amountRON,
    note,
  } as any);
  revalidatePath(`/contracts/${contractId}`);
}

async function editDepositAction(formData: FormData) {
  "use server";
  const depositId = String(formData.get("depositId") || "");
  const contractId = String(formData.get("contractId") || "");
  if (!depositId) return;
  const patch: any = {};
  if (formData.get("type")) patch.type = String(formData.get("type"));
  if (formData.has("amountEUR")) {
    const raw = String(formData.get("amountEUR") || "").trim();
    patch.amountEUR = raw === "" ? null : parseFloat(raw);
  }
  if (formData.has("amountRON")) {
    const raw = String(formData.get("amountRON") || "").trim();
    patch.amountRON = raw === "" ? null : parseFloat(raw);
  }
  if (formData.get("note")) patch.note = String(formData.get("note"));
  patch.isDeposited = formData.get("isDeposited") ? true : false;
  patch.returned = formData.get("returned") ? true : false;
  await updateDeposit({ id: depositId, contractId, ...patch } as any);
  revalidatePath(`/contracts/${contractId}`);
}

async function deleteDepositAction(formData: FormData) {
  "use server";
  const depositId = String(formData.get("depositId") || "");
  const contractId = String(formData.get("contractId") || "");
  if (!depositId) return;
  await deleteDepositById(depositId);
  revalidatePath(`/contracts/${contractId}`);
}

async function toggleDepositAction(formData: FormData) {
  "use server";
  const depositId = String(formData.get("depositId") || "");
  const contractId = String(formData.get("contractId") || "");
  if (!depositId) return;
  await toggleDepositDeposited(depositId);
  revalidatePath(`/contracts/${contractId}`);
}

// Update correctionPercent directly from the contract page (quick edit)
async function updateCorrectionPercentAction(formData: FormData) {
  "use server";
  const contractId = String(formData.get("contractId") || "");
  if (!contractId) return;
  const raw = String(formData.get("correctionPercent") || "").trim();
  let value: number | undefined = undefined;
  if (raw !== "") {
    const n = Number(raw.replace(",", "."));
    if (Number.isFinite(n)) value = Math.max(0, Math.min(100, n));
  }
  const existing = await fetchContractById(contractId);
  if (!existing) return;
  try {
    const patch: any = { ...(existing as any) };
    if (typeof value === "number") patch.correctionPercent = value; else delete patch.correctionPercent;
    await upsertContract(patch);
    await logAction({
      action: "contract.correction.update",
      targetType: "contract",
      targetId: contractId,
      meta: { correctionPercent: value },
    });
    publishToast("Corecția a fost actualizată", "success");
  } catch (e: any) {
    const msg = (e && (e.message || String(e))) || "Eroare la actualizarea corecției";
    publishToast(String(msg), "error");
  }
  revalidatePath(`/contracts/${contractId}`);
}

// Update partner shares (percent per partner) on this contract
async function updatePartnerSharesAction(formData: FormData) {
  "use server";
  const contractId = String(formData.get("contractId") || "");
  if (!contractId) return;
  const existing = await fetchContractById(contractId);
  if (!existing) return;
  const ids = (formData.getAll("partnerId") as string[]) || [];
  const names = (formData.getAll("partnerName") as string[]) || [];
  const sharesRaw = (formData.getAll("sharePercent") as string[]) || [];
  const rows: Array<{ id?: string; name: string; sharePercent?: number }> = [];
  for (let i = 0; i < Math.max(ids.length, names.length, sharesRaw.length); i++) {
    const name = (names[i] || "").trim();
    if (!name) continue;
    const id = (ids[i] || "").trim() || undefined;
    const raw = (sharesRaw[i] || "").trim();
    const pct = raw === "" ? undefined : Number(raw.replace(",", "."));
    rows.push({ id, name, sharePercent: typeof pct === "number" && isFinite(pct) ? Math.max(0, Math.min(100, pct)) : undefined });
  }
  try {
    const patch: any = { ...(existing as any), partners: rows.length > 0 ? rows : undefined };
    // Keep legacy single partner fields in sync with first partner
    if (rows.length > 0) {
      patch.partner = rows[0].name;
      patch.partnerId = rows[0].id ?? rows[0].name;
    }
    await upsertContract(patch);
    await logAction({ action: "contract.partners.shares.update", targetType: "contract", targetId: contractId, meta: { partners: rows } });
    publishToast("Procentaje parteneri actualizate", "success");
  } catch (e: any) {
    publishToast("Eroare la actualizarea procentelor", "error");
  }
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

// (funcția addExtension definită mai jos)

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

// Adaugă o prelungire (contractExtensions) pe contract din pagina de gestionare
async function addExtension(formData: FormData) {
  "use server";
  const contractId = String(formData.get("contractId") || "");
  const docDate = String(formData.get("docDate") || "");
  const document = String(formData.get("document") || "");
  const extendedUntil = String(formData.get("extendedUntil") || "");
  if (!contractId) return;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(docDate) || !iso.test(extendedUntil)) return;
  const existing = await fetchContractById(contractId);
  if (!existing) return;
  const norm = (s: string) => String(s).slice(0, 10);
  const newEntry = {
    docDate: norm(docDate),
    document: document.trim() || "act adițional",
    extendedUntil: norm(extendedUntil),
  };

  // Server-side guardrails against common mistakes
  const signedAt = new Date(existing.signedAt);
  const currentEffectiveEnd = new Date(effectiveEndDate(existing));
  const until = new Date(newEntry.extendedUntil);
  const docDt = new Date(newEntry.docDate);

  const errors: string[] = [];
  if (until < currentEffectiveEnd) {
    errors.push(
      `Data prelungirii trebuie să fie după sau egal cu data de expirare curentă (${norm(
        String(currentEffectiveEnd.toISOString())
      )})`
    );
  }
  if (docDt < signedAt) {
    errors.push(
      `Data actului de prelungire trebuie să fie după sau egală cu data semnării (${norm(
        String(signedAt.toISOString())
      )})`
    );
  }
  if (docDt > until) {
    errors.push("Data documentului nu poate fi după data prelungirii");
  }
  if (errors.length) {
    publishToast(errors.join("\n"), "error");
    // No DB write; just refresh the page to keep UI consistent
    revalidatePath(`/contracts/${contractId}`);
    return;
  }
  const prev = Array.isArray((existing as any).contractExtensions)
    ? ((existing as any).contractExtensions as Array<{
        docDate?: string;
        document?: string;
        extendedUntil?: string;
      }>)
    : [];
  const deduped = prev.some(
    (r) =>
      norm(String(r.extendedUntil || "")) === newEntry.extendedUntil &&
      norm(String(r.docDate || "")) === newEntry.docDate &&
      String(r.document || "").trim() === newEntry.document
  )
    ? prev
    : [...prev, newEntry];
  const patch: any = {
    ...(existing as any),
    contractExtensions: deduped,
  };
  try {
    await upsertContract(patch);
  } catch (err: any) {
    const msg =
      (err && (err.message || err.toString())) ||
      "Eroare la salvarea prelungirii";
    publishToast(String(msg), "error");
    revalidatePath(`/contracts/${contractId}`);
    return;
  }
  await logAction({
    action: "contract.extend",
    targetType: "contract",
    targetId: contractId,
    meta: newEntry,
  });
  revalidatePath(`/contracts/${contractId}`);
}

async function deleteExtension(formData: FormData) {
  "use server";
  const contractId = String(formData.get("contractId") || "");
  const docDate = String(formData.get("docDate") || "");
  const documentName = String(formData.get("document") || "");
  const extendedUntil = String(formData.get("extendedUntil") || "");
  if (!contractId) return;
  const existing = await fetchContractById(contractId);
  if (!existing) return;
  const norm = (s: string) => String(s).slice(0, 10);
  const list = Array.isArray((existing as any).contractExtensions)
    ? ((existing as any).contractExtensions as Array<{
        docDate?: string;
        document?: string;
        extendedUntil?: string;
      }>)
    : [];
  const targetDocDate = docDate ? norm(docDate) : "";
  const targetExtendedUntil = extendedUntil ? norm(extendedUntil) : "";
  const targetDocument = documentName.trim();
  const matchIdx = list.findIndex((row) => {
    const rowDoc = norm(String(row.docDate || ""));
    const rowUntil = norm(String(row.extendedUntil || ""));
    const rowDocument = String((row.document || "").trim());
    return (
      rowDoc === targetDocDate &&
      rowUntil === targetExtendedUntil &&
      rowDocument === targetDocument
    );
  });
  if (matchIdx < 0) {
    publishToast("Prelungirea nu a fost găsită.", "error");
    revalidatePath(`/contracts/${contractId}`);
    return;
  }
  const updated = list.filter((_, idx) => idx !== matchIdx);
  try {
    await upsertContract({
      ...(existing as any),
      contractExtensions: updated,
    } as any);
  } catch (err: any) {
    const msg =
      (err && (err.message || err.toString())) ||
      "Eroare la ștergerea prelungirii";
    publishToast(String(msg), "error");
    revalidatePath(`/contracts/${contractId}`);
    return;
  }
  await logAction({
    action: "contract.extend.delete",
    targetType: "contract",
    targetId: contractId,
    meta: {
      docDate: docDate ? norm(docDate) : undefined,
      document: documentName.trim() || undefined,
      extendedUntil: extendedUntil ? norm(extendedUntil) : undefined,
    },
  });
  publishToast("Prelungirea a fost ștearsă.", "success");
  revalidatePath(`/contracts/${contractId}`);
}

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

  const indexingDatesArr: {
    forecastDate: string;
    actualDate?: string;
    document?: string;
    newRentAmount?: number;
    done?: boolean;
  }[] = Array.isArray((contract as any).indexingDates)
    ? ((contract as any).indexingDates as any[])
    : [];
  const unsavedFuture = indexingDatesArr
    .filter((x) => x && typeof x.forecastDate === "string" && !x.done)
    .map((x) => x.forecastDate)
    .sort();
  // Stable ISO for comparisons (server-rendered string). Avoid using dynamic values for defaultValue props.
  const todayISOForLists = new Date().toISOString().slice(0, 10);
  const nextIndexingDate = unsavedFuture.find((d) => d >= todayISOForLists);

  // Compute days left until nextIndexingDate (server-side stable string math)
  const daysToNextIndexing: number | undefined = (() => {
    if (!nextIndexingDate) return undefined;
    const start = new Date(todayISOForLists + "T00:00:00Z").getTime();
    const target = new Date(nextIndexingDate + "T00:00:00Z").getTime();
    const diff = Math.ceil((target - start) / 86400000);
    return diff < 0 ? 0 : diff;
  })();

  const alreadyIssuedForThisMonth = Boolean(
    dueAt && invoices.some((inv) => inv.issuedAt === dueAt)
  );

  // Build rent series and indexation history from indexingDates entries.
  type Indexation = {
    date: string; // effective (actualDate or forecastDate)
    appliedAt: string; // actualDate if present, else forecastDate
    from: number;
    to: number;
  };
  const hasFuture = false;
  const deposits = await listDepositsForContract(contract.id);
  // Next/last scheduling using new model (todayISOForLists, futureIndexingDates, nextIndexingDate already defined above)
  const lastApplicable = null as any; // eliminat din UI

  // Build the chart series from indexingDates with numeric amounts
  type SeriesPoint = { date: string; value: number };
  const idxRows: Array<{ eff: string; appliedAt: string; value: number }> = Array.isArray((contract as any).indexingDates)
    ? ((contract as any).indexingDates as any[])
        .filter((it) => it && typeof it.newRentAmount === "number")
        .map((it) => {
          const eff = String((it.actualDate || it.forecastDate) || "").slice(0, 10);
          const appliedAt = String((it.actualDate || it.forecastDate) || "").slice(0, 10);
          return { eff, appliedAt, value: Number(it.newRentAmount) };
        })
        .filter((r) => r.eff)
        .sort((a, b) => a.eff.localeCompare(b.eff))
    : [];
  const series: SeriesPoint[] = [];
  if (idxRows.length > 0) {
    const firstValue = idxRows[0].value;
    const startAt = String(contract.startDate || idxRows[0].eff);
    series.push({ date: startAt, value: firstValue });
    idxRows.forEach((r) => series.push({ date: r.eff, value: r.value }));
  }
  // Derive indexations for the history list from these rows
  const indexations: Indexation[] = (() => {
    const out: Indexation[] = [];
    for (let i = 0; i < idxRows.length; i++) {
      const row = idxRows[i];
      const from = i > 0 ? idxRows[i - 1].value : row.value;
      out.push({ date: row.eff, appliedAt: row.appliedAt, from, to: row.value });
    }
    out.sort((a, b) => b.date.localeCompare(a.date));
    return out;
  })();
  // Ensure a stable last point: cap at effective contract end date rather than today to avoid hydration drift
  if (series.length > 0) {
    const last = series[series.length - 1];
    const capISO = String(effectiveEndDate(contract));
    if (last.date !== capISO) series.push({ date: capISO, value: last.value });
  }

  // Deposits summary
  const depositSummary = (() => {
    const all = deposits || [];
    const count = all.length;
    let totalEUR = 0;
    let totalRON = 0;
    let depositedEUR = 0;
    let depositedRON = 0;
    let pendingEUR = 0;
    let pendingRON = 0;
    for (const d of all) {
      const eur =
        typeof (d as any).amountEUR === "number" ? (d as any).amountEUR : 0;
      const ron =
        typeof (d as any).amountRON === "number" ? (d as any).amountRON : 0;
      totalEUR += eur;
      totalRON += ron;
      if (d.isDeposited) {
        depositedEUR += eur;
        depositedRON += ron;
      } else {
        pendingEUR += eur;
        pendingRON += ron;
      }
    }
    return {
      count,
      totalEUR,
      totalRON,
      depositedEUR,
      depositedRON,
      pendingEUR,
      pendingRON,
    };
  })();
  // Compute display-only summaries and sparkline data
  const depositsSummary = (() => {
    const all = deposits || [];
    const totalCount = all.length;
    const totalAmount = all.reduce(
      (s, d) => s + (typeof d.amountEUR === "number" ? d.amountEUR : 0),
      0
    );
    const deposited = all.filter((d) => d.isDeposited);
    const depositedCount = deposited.length;
    const depositedAmount = deposited.reduce(
      (s, d) => s + (typeof d.amountEUR === "number" ? d.amountEUR : 0),
      0
    );
    const pendingCount = totalCount - depositedCount;
    const pendingAmount = totalAmount - depositedAmount;
    const ratio = totalAmount > 0 ? depositedAmount / totalAmount : 0;
    return {
      totalCount,
      totalAmount,
      depositedCount,
      depositedAmount,
      pendingCount,
      pendingAmount,
      ratio,
    };
  })();

  const spark = (() => {
    // Build a small sparkline from the indexingDates-derived series values
    const vals = series.length > 0 ? series.map((p) => p.value) : [];
    const width = 240;
    const height = 60;
    const padX = 6;
    const padY = 6;
    if (vals.length === 0) return { width, height, points: "", min: 0, max: 0 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(0.0001, max - min);
    const n = vals.length;
    const step = n > 1 ? (width - padX * 2) / (n - 1) : 0;
    const points = vals
      .map((v, i) => {
        const x = padX + i * step;
        const y = height - padY - ((v - min) / span) * (height - padY * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { width, height, points, min, max };
  })();

  return (
    <main id="contract-page" className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm text-foreground/70 hover:underline">
          ← Înapoi la listă
        </Link>
      </div>
      <header
        id="contract-header"
        className="flex items-start justify-between gap-4 flex-wrap"
      >
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
          <Link
            href={`/contracts/${contract.id}/pdf`}
            className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/5"
          >
            Exportă PDF
          </Link>
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
        <div id="contract-left" className="space-y-3 lg:col-span-1">
          <div
            id="contract-details"
            className="rounded-lg border border-foreground/15 p-4 bg-[#334443]"
          >
            <h2 className="text-base font-semibold">Detalii</h2>
            <div className="mt-4 space-y-6 text-sm">
              <div id="contract-meta">
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
                  {Array.isArray((contract as any).partners) && (contract as any).partners.length > 0 && (
                    <div className="col-span-2">
                      <span className="block text-foreground/60">Parteneri</span>
                      <div className="mt-1 flex flex-wrap gap-1 text-xs">
                        {(((contract as any).partners) as any[]).map((p, idx) => (
                          <span key={(p?.id||p?.name||idx)} className="inline-flex items-center gap-1 rounded bg-foreground/5 px-2 py-0.5">
                            <Link href={`/partners/${encodeURIComponent(p?.id || p?.name || '')}`} className="hover:underline">
                              {String(p?.name || '')}
                            </Link>
                            {typeof p?.sharePercent === 'number' && (
                              <span className="text-foreground/60">({p.sharePercent}%)</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
                  {(() => {
                    const arr = Array.isArray((contract as any).contractExtensions)
                      ? ((contract as any).contractExtensions as Array<{
                          docDate?: string;
                          document?: string;
                          extendedUntil?: string;
                        }>)
                      : [];
                    if (arr.length === 0) return null;
                    return (
                      <div className="col-span-2">
                        <span className="block text-foreground/60">
                          Prelungiri contract
                        </span>
                        <div className="mt-1 flex flex-col gap-1 text-sm">
                          {arr
                            .slice()
                            .sort((a, b) => String(a.extendedUntil || "").localeCompare(String(b.extendedUntil || "")))
                            .map((r, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="rounded bg-foreground/5 px-2 py-0.5">
                                  până la {r.extendedUntil ? fmt(String(r.extendedUntil)) : "—"}
                                </span>
                                <span className="text-foreground/60">•</span>
                                <span className="rounded bg-foreground/5 px-2 py-0.5">
                                  doc {r.docDate ? fmt(String(r.docDate)) : "—"}
                                </span>
                                {r.document && (
                                  <span className="rounded bg-foreground/5 px-2 py-0.5 truncate">
                                    {r.document}
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })()}
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

              <div id="contract-billing">
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
                  {typeof contract.paymentDueDays === "number" && (
                    <span
                      className="rounded bg-foreground/5 px-2 py-1"
                      title="Termen plată"
                    >
                      Termen plată: {contract.paymentDueDays} zile
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
                  {Array.isArray((contract as any).irregularInvoices) &&
                    (contract as any).irregularInvoices.length > 0 && (
                      <span
                        className="rounded bg-foreground/5 px-2 py-1"
                        title="Intrări facturi anuale"
                      >
                        {(contract as any).irregularInvoices.length} facturi/an
                      </span>
                    )}
                </div>
              </div>

              {typeof currentRentAmount(contract) === "number" &&
                typeof contract.exchangeRateRON === "number" && (
                  <div id="contract-value">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50 mb-2">
                      Valoare
                    </h3>
                    {(() => {
                      const baseRon =
                        (currentRentAmount(contract) as number) *
                        contract.exchangeRateRON;
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
                              {(
                                (currentRentAmount(contract) as number)
                              ).toFixed(2)}{" "}
                              EUR
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
                          <div id="contract-depozite" className="mt-3">
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/40">
                              Depozite
                            </div>
                            {depositSummary.count === 0 ? (
                              <div className="text-foreground/50 italic">
                                Niciun depozit înregistrat
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="rounded bg-foreground/5 px-2 py-1">
                                    {depositSummary.count} buc
                                  </span>
                                  <span className="rounded bg-foreground/5 px-2 py-1 text-indigo-700 dark:text-indigo-400">
                                    Total: {depositSummary.totalEUR.toFixed(2)}{" "}
                                    EUR · {depositSummary.totalRON.toFixed(2)}{" "}
                                    RON
                                  </span>
                                  <span className="rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-1">
                                    Depuse{" "}
                                    {depositSummary.depositedEUR.toFixed(2)} EUR
                                    · {depositSummary.depositedRON.toFixed(2)}{" "}
                                    RON
                                  </span>
                                  <span className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1">
                                    În așteptare{" "}
                                    {depositSummary.pendingEUR.toFixed(2)} EUR ·{" "}
                                    {depositSummary.pendingRON.toFixed(2)} RON
                                  </span>
                                </div>
                                <div className="flex flex-col gap-2">
                                  {deposits.map((d) => (
                                    <div
                                      key={d.id}
                                      className="rounded bg-foreground/5 px-2 py-1"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-xs">
                                          {String(d.type).replace("_", " ")}
                                        </span>
                                        <span className="text-foreground/60 text-xs">
                                          {typeof d.amountEUR === "number" &&
                                          d.amountEUR > 0
                                            ? `${d.amountEUR.toFixed(2)} EUR`
                                            : ""}
                                          {typeof d.amountRON === "number" &&
                                          d.amountRON > 0
                                            ? ` · ${d.amountRON.toFixed(2)} RON`
                                            : ""}
                                        </span>
                                        {d.note && (
                                          <span className="text-foreground/50 text-xs italic">
                                            • {d.note}
                                          </span>
                                        )}
                                        <span
                                          className={`ml-2 rounded px-2 py-0.5 text-[10px] font-semibold ${
                                            (d as any).returned
                                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                              : "bg-foreground/10 text-foreground/70"
                                          }`}
                                        >
                                          {(d as any).returned
                                            ? "returnat"
                                            : "custodie"}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

              {indexations.length > 0 && (
                <div id="contract-indexari-efectuate">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50 mb-2">
                    Indexare
                  </h3>
                  {/* Rent history chart */}
                  {(() => {
                    const pts = series || [];
                    if (!Array.isArray(pts) || pts.length < 2) {
                      return (
                        <div
                          id="contract-rent-history-chart"
                          className="text-xs text-foreground/50 mb-3"
                        >
                          Insuficiente date pentru grafic.
                        </div>
                      );
                    }
                    const width = 640;
                    const height = 160;
                    const m = { top: 10, right: 12, bottom: 18, left: 36 };
                    const xs = pts
                      .map((p) => new Date(p.date).getTime())
                      .filter((n) => Number.isFinite(n));
                    const ys = pts
                      .map((p) => p.value)
                      .filter((n) => Number.isFinite(n));
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    const spanX = Math.max(1, maxX - minX);
                    const spanY = Math.max(0.0001, maxY - minY);
                    const x = (t: number) =>
                      m.left +
                      ((t - minX) / spanX) * (width - m.left - m.right);
                    const y = (v: number) =>
                      height -
                      m.bottom -
                      ((v - minY) / spanY) * (height - m.top - m.bottom);
                    const line = pts
                      .map(
                        (p, i) =>
                          `${i === 0 ? "M" : "L"} ${x(
                            new Date(p.date).getTime()
                          ).toFixed(2)} ${y(p.value).toFixed(2)}`
                      )
                      .join(" ");
                    const area = `${line} L ${x(maxX).toFixed(2)} ${y(
                      minY
                    ).toFixed(2)} L ${x(minX).toFixed(2)} ${y(minY).toFixed(
                      2
                    )} Z`;
                    const ticksY = 4;
                    const yTicks = Array.from(
                      { length: ticksY + 1 },
                      (_, i) => minY + (i * (maxY - minY)) / ticksY
                    );
                    return (
                      <div
                        id="contract-rent-history-chart"
                        className="mb-4 rounded-md border border-foreground/10 bg-foreground/[0.03]"
                      >
                        <svg
                          viewBox={`0 0 ${width} ${height}`}
                          width="100%"
                          height="auto"
                          preserveAspectRatio="none"
                          role="img"
                          aria-label="Evoluție chirie (EUR)"
                        >
                          <defs>
                            <linearGradient
                              id="rentGradient"
                              x1="0"
                              x2="0"
                              y1="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="rgb(16 185 129)"
                                stopOpacity="0.35"
                              />
                              <stop
                                offset="100%"
                                stopColor="rgb(16 185 129)"
                                stopOpacity="0.02"
                              />
                            </linearGradient>
                            <filter
                              id="glow"
                              x="-50%"
                              y="-50%"
                              width="200%"
                              height="200%"
                            >
                              <feGaussianBlur
                                stdDeviation="1.2"
                                result="blur"
                              />
                              <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>
                          {/* Y grid */}
                          {yTicks.map((tv, i) => {
                            const yy = y(tv);
                            return (
                              <g key={i}>
                                <line
                                  x1={m.left}
                                  x2={width - m.right}
                                  y1={yy}
                                  y2={yy}
                                  stroke="currentColor"
                                  opacity={0.08}
                                />
                                <text
                                  x={m.left - 8}
                                  y={yy + 3}
                                  fontSize={10}
                                  textAnchor="end"
                                  fill="currentColor"
                                  opacity={0.6}
                                >
                                  {tv.toFixed(0)}
                                </text>
                              </g>
                            );
                          })}
                          {/* Chart area + line */}
                          <path d={area} fill="url(#rentGradient)" />
                          <path
                            d={line}
                            fill="none"
                            stroke="rgb(16 185 129)"
                            strokeWidth={2}
                            filter="url(#glow)"
                          />
                          {/* Indexing date markers: circles for applied, crosses for scheduled */}
                          {(() => {
                            // Only mark indexations that change the rent amount (value differs from previous)
                            const rows = (Array.isArray((contract as any).indexingDates)
                              ? ((contract as any).indexingDates as any[])
                              : [])
                              .filter((it) => it && typeof it.newRentAmount === 'number')
                              .map((it) => ({
                                eff: String((it.actualDate || it.forecastDate) || '').slice(0, 10),
                                v: Number(it.newRentAmount),
                                done: Boolean(it.done),
                              }))
                              .filter((r) => r.eff)
                              .sort((a, b) => a.eff.localeCompare(b.eff));
                            const items: { eff: string; v: number; done: boolean }[] = [];
                            for (let i = 1; i < rows.length; i++) {
                              const prev = rows[i - 1];
                              const cur = rows[i];
                              if (Number.isFinite(cur.v) && Number.isFinite(prev.v) && cur.v !== prev.v) {
                                items.push(cur);
                              }
                            }
                            if (items.length === 0) return null;
                            return (
                              <g id="indexing-markers">
                                {items.map((m, i) => {
                                  const cx = x(new Date(m.eff).getTime());
                                  const cy = y(m.v);
                                  if (m.done) {
                                    // Applied: small circle
                                    return (
                                      <circle
                                        key={`idxc-${i}`}
                                        cx={cx}
                                        cy={cy}
                                        r={3}
                                        fill="rgb(59 130 246)" /* blue-500 */
                                        stroke="white"
                                        strokeWidth={1}
                                      >
                                        <title>{`Indexare aplicată • ${m.eff}`}</title>
                                      </circle>
                                    );
                                  }
                                  // Scheduled: small cross
                                  const s = 3.5;
                                  return (
                                    <g key={`idxx-${i}`} stroke="rgb(245 158 11)" strokeWidth={1.5}>
                                      <line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} />
                                      <line x1={cx - s} y1={cy + s} x2={cx + s} y2={cy - s} />
                                      <title>{`Indexare programată • ${m.eff}`}</title>
                                    </g>
                                  );
                                })}
                              </g>
                            );
                          })()}
                        </svg>
                      </div>
                    );
                  })()}
                  <div className="flex flex-col gap-3 text[11px]">
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/40">
                        Efectuate
                      </div>
                      {nextIndexingDate && (
                        <div id="contract-indexari-urmatoare" className="mb-1">
                          {(() => {
                            const d = daysToNextIndexing;
                            const cls =
                              typeof d !== "number"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : d < 5
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 ring-1 ring-rose-400/30 animate-pulse"
                                : d < 15
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                : d < 60
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
                            return (
                              <span
                                className={`rounded px-2 py-0.5 text-[11px] ${cls}`}
                                title="Următoarea indexare programată"
                              >
                                Următoarea: {fmt(nextIndexingDate)}
                                {typeof d === "number"
                                  ? ` • în ${d} ${d === 1 ? "zi" : "zile"}`
                                  : ""}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        {indexations.map((ix) => {
                          const diffPct =
                            ix.from !== 0
                              ? ((ix.to - ix.from) / ix.from) * 100
                              : 0;
                          const docLabel = (() => {
                            const match = indexingDatesArr.find(
                              (d) => d.forecastDate === ix.date
                            );
                            return match?.document;
                          })();
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
                              {docLabel ? (
                                <>
                                  <span className="text-foreground/50">•</span>
                                  <span className="text-foreground/60">
                                    {docLabel}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      {indexations.length === 0 && (
                        <div className="italic text-foreground/40">
                          Nicio indexare efectuată încă
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {advanceFraction &&
                advanceFraction > 0 &&
                advanceFraction < 1 && (
                  <div
                    id="contract-proration-note"
                    className="mt-4 text-xs text-amber-600 dark:text-amber-400"
                  >
                    Facturare parțială în avans:{" "}
                    {Math.round(advanceFraction * 100)}%
                  </div>
                )}
            </div>
          </div>
        </div>

        <div id="contract-right" className="lg:col-span-2">
          <ContractScans
            scans={
              (contract as { scans?: { url: string; title?: string }[] })
                .scans ||
              (contract.scanUrl ? [{ url: String(contract.scanUrl) }] : [])
            }
            contractName={contract.name}
          />
          <ManageContractScans
            id={contract.id}
            scans={
              (contract as { scans?: { url: string; title?: string }[] })
                .scans ||
              (contract.scanUrl ? [{ url: String(contract.scanUrl) }] : [])
            }
            mongoConfigured={Boolean(process.env.MONGODB_URI)}
            rentType={contract.rentType}
            irregularInvoices={(contract as any).irregularInvoices || []}
            wrapChildrenInCard={false}
          >
            {/* Gestionează contract (mutat în manage-contract-section) */}
            {Array.isArray((contract as any).partners) && (contract as any).partners.length > 1 ? (
              <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4 space-y-3">
                <div className="text-[11px] uppercase tracking-wide text-white/60">Procentaje parteneri</div>
                <form action={updatePartnerSharesAction} className="space-y-2">
                  <input type="hidden" name="contractId" value={contract.id} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    {(((contract as any).partners as any[]) || []).map((p: any, i: number) => (
                      <div key={(p?.id || p?.name || i) + "-share"} className="rounded bg-white/5 px-2 py-2 flex items-end gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate" title={String(p?.name || "")}>
                            {String(p?.name || "")}
                          </div>
                          <input type="hidden" name="partnerId" value={p?.id || ""} />
                          <input type="hidden" name="partnerName" value={p?.name || ""} />
                        </div>
                        <div className="shrink-0">
                          <label className="block text-white/60 text-[11px]">%</label>
                          <input
                            name="sharePercent"
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            defaultValue={typeof p?.sharePercent === 'number' ? p.sharePercent : ("" as any)}
                            className="rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs w-32 min-w-[7rem]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-1">
                    <button type="submit" className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">
                      Salvează procentele
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
            {contract.rentType === "yearly" ? (
              <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4 space-y-3">
                <div className="text-[11px] uppercase tracking-wide text-white/60">
                  Facturi anuale – date suplimentare
                </div>
                <div className="text-xs text-white/70">
                  Adaugă sau editează zilele/lunile pentru facturile anuale ale contractului.
                </div>
                {((((contract as any).irregularInvoices)?.length) ?? 0) > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {((((contract as any).irregularInvoices) || []) as any[])
                      .slice()
                      .sort((a, b) => a.month - b.month || a.day - b.day)
                      .map((r, i) => (
                        <li
                          key={`${r.month}-${r.day}-${i}`}
                          className="flex items-center justify-between rounded bg-white/5 px-2 py-1"
                        >
                          <div className="flex items-center gap-3">
                            <span className="rounded bg-foreground/10 px-2 py-0.5 text-xs">
                              {String(r.day).padStart(2, "0")}/{String(r.month).padStart(2, "0")}
                            </span>
                            <span className="text-foreground/70 text-xs">
                              {typeof r.amountEUR === "number" ? `${r.amountEUR.toFixed(2)} EUR` : "—"}
                            </span>
                          </div>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="text-xs text-white/70">Nu există date definite.</div>
                )}
              </div>
            ) : null}
            {(() => {
              const arr = Array.isArray((contract as any).contractExtensions)
                ? ((contract as any).contractExtensions as Array<{
                    docDate?: string;
                    document?: string;
                    extendedUntil?: string;
                  }>)
                : [];
              if (arr.length === 0) return null;
              return (
                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4 space-y-2">
                  <div className="text-[11px] uppercase tracking-wide text-white/60">Prelungiri existente</div>
                  <details className="md:col-span-3 w-full border border-white/12 rounded-md p-3 space-y-2">
                    <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-white/70">
                      Afișează toate prelungirile
                    </summary>
                  <ul className="mt-2 space-y-2">
                    {arr
                      .slice()
                      .sort((a, b) =>
                        String(a.extendedUntil || "").localeCompare(
                          String(b.extendedUntil || "")
                        )
                      )
                      .map((r, i) => {
                        const docDate = String(r.docDate || "");
                        const documentLabel = String(r.document || "");
                        const extendedUntil = String(r.extendedUntil || "");
                        const docLabel = docDate ? fmt(docDate) : undefined;
                        const extendedLabel = extendedUntil
                          ? fmt(extendedUntil)
                          : undefined;
                        const confirmMessage = `Sigur dorești să ștergi această prelungire${
                          extendedLabel
                            ? ` cu valabilitate până la ${extendedLabel}`
                            : ""
                        }${
                          docLabel ? ` (act emis la ${docLabel})` : ""
                        }?`;
                        return (
                          <li
                            key={`${docDate}-${extendedUntil}-${documentLabel}-${i}`}
                            className="flex flex-col gap-2 rounded bg-foreground/5 px-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="space-y-1">
                              <div className="font-medium">
                                Până la:{" "}
                                {extendedUntil ? fmt(extendedUntil) : "—"}
                              </div>
                              <div className="text-foreground/60">
                                Doc: {docDate ? fmt(docDate) : "—"}
                                {documentLabel ? ` • ${documentLabel}` : ""}
                              </div>
                            </div>
                            <form
                              action={deleteExtension}
                              className="flex items-center gap-2 self-start sm:self-auto"
                            >
                              <input
                                type="hidden"
                                name="contractId"
                                value={contract.id}
                              />
                              <input
                                type="hidden"
                                name="docDate"
                                value={docDate}
                              />
                              <input
                                type="hidden"
                                name="extendedUntil"
                                value={extendedUntil}
                              />
                              <input
                                type="hidden"
                                name="document"
                                value={documentLabel}
                              />
                              <ConfirmSubmit
                                className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/10"
                                title="Șterge prelungirea"
                                successMessage="Prelungire ștearsă"
                                confirmMessage={confirmMessage}
                              >
                                Șterge
                              </ConfirmSubmit>
                            </form>
                          </li>
                        );
                      })}
                  </ul>
                  </details>
                </div>
                );
            })()}
            <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4 mt-4">
              <div className="text-[11px] uppercase tracking-wide text-white/60 mb-2">Adaugă prelungire</div>
            <form action={addExtension} className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end text-sm">
              <input type="hidden" name="contractId" value={contract.id} />
              <div>
                <label className="block text-white/60 mb-1">
                  Data document
                </label>
                <input
                  name="docDate"
                  type="date"
                  min={String(contract.signedAt)}
                  max={String(effectiveEndDate(contract))}
                  className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1"
                  required
                />
              </div>
              <div>
                <label className="block text-white/60 mb-1">
                  Document
                </label>
                <input
                  name="document"
                  type="text"
                  placeholder="Act adițional"
                  className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-white/60 mb-1">
                  Prelungire până la
                </label>
                <input
                  name="extendedUntil"
                  type="date"
                  min={String(effectiveEndDate(contract))}
                  className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1"
                  required
                />
              </div>
              <button
                type="submit"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
              >
                Adaugă prelungire
              </button>
            </form>
            </div>
            <div id="contract-indexari-programate" className="rounded-xl border border-white/12 bg-white/[0.04] p-4 text-sm mt-4">
              <div className="text-[11px] uppercase tracking-wide text-white/60 mb-2">Indexări programate</div>
              <form
                action={saveIndexing}
                className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-5 sm:items-end text-[11px]"
              >
                <input type="hidden" name="contractId" value={contract.id} />
                <div className="space-y-1">
                  <label className="block text-white/60">Dată programată</label>
                  <input required name="forecastDate" type="date" min={String(contract.signedAt)} className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1" />
                </div>
                <div className="space-y-1">
                  <label className="block text-white/60">Dată efectivă</label>
                  <input name="actualDate" type="date" className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1" />
                </div>
                <div className="space-y-1">
                  <label className="block text-white/60">Document</label>
                  <input name="document" type="text" maxLength={200} placeholder="ex: Decizie indexare" className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1" />
                </div>
                <div className="space-y-1">
                  <label className="block text-white/60">Chirie nouă (EUR)</label>
                  <input name="newRentAmount" type="number" step="0.01" min={0} className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 text-white/60">
                    <input type="checkbox" name="done" value="1" className="rounded border-white/30" />
                    <span>Marchează ca aplicată</span>
                  </label>
                  <button type="submit" className="ml-auto rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10" title="Adaugă indexare">Adaugă indexare</button>
                </div>
              </form>
              {Array.isArray((contract as any).indexingDates) &&
              ((contract as any).indexingDates as any[]).filter(
                (x: any) => !x.done
              ).length === 0 ? (
                <div className="text-white/70 text-xs italic">
                  Nicio indexare viitoare programată.
                </div>
              ) : (
                (() => {
                  const upcoming = (
                    Array.isArray((contract as any).indexingDates)
                      ? ((contract as any).indexingDates as any[]).filter((it: any) => !it.done)
                      : []
                  ) as {
                    forecastDate: string;
                    actualDate?: string;
                    document?: string;
                    newRentAmount?: number;
                    done?: boolean;
                  }[];
                  if (upcoming.length === 0) return null;
                  const sorted = upcoming
                    .slice()
                    .sort((a, b) => String(a.forecastDate).localeCompare(String(b.forecastDate)));
                  const nextIt =
                    sorted.find((x) => String(x.forecastDate) >= todayISOForLists) || sorted[0];
                  const it = nextIt;
                  return (
                    <ul className="space-y-3 text-[11px]">
                      <li key={contract.id + it.forecastDate} className="rounded-lg border border-white/15 bg-white/5 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                              Indexare programată
                            </div>
                            <div className="text-sm font-medium text-foreground">
                              {fmt(it.forecastDate)}
                            </div>
                            {it.document ? (
                              <div className="text-xs text-foreground/60">
                                Document:{" "}
                                <span className="font-medium text-foreground/80">{it.document}</span>
                              </div>
                            ) : null}
                          </div>
                          <form action={saveIndexing} className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-end">
                            <input type="hidden" name="contractId" value={contract.id} />
                            <input type="hidden" name="forecastDate" value={it.forecastDate} />
                            <input type="hidden" name="done" value="1" />
                            <div className="space-y-1">
                              <label className="block text-foreground/60 text-[11px]">Data efectivă</label>
                              <input
                                name="actualDate"
                                type="date"
                                defaultValue={it.actualDate ?? ""}
                                className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-foreground/60 text-[11px]">Document</label>
                              <input
                                name="document"
                                type="text"
                                maxLength={200}
                                defaultValue={it.document ?? ""}
                                placeholder="ex: Decizie indexare"
                                className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-foreground/60 text-[11px]">Chirie nouă (EUR)</label>
                              <input
                                name="newRentAmount"
                                type="number"
                                step="0.01"
                                min={0}
                                defaultValue={typeof it.newRentAmount === "number" ? it.newRentAmount : ("" as any)}
                                className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1 text-xs"
                              />
                            </div>
                            <div className="sm:justify-self-end">
                              <button
                                type="submit"
                                className={`w-full whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold border ${
                                  it.done
                                    ? "border-emerald-400 bg-emerald-500/10 text-emerald-700"
                                    : "border-foreground/20 hover:bg-foreground/5"
                                }`}
                                title="Marchează ca validat și actualizează chiria"
                              >
                                {it.done ? "Validat" : "Marchează"}
                              </button>
                            </div>
                          </form>
                        </div>
                      </li>
                    </ul>
                  );
                })()
              )}

              {(() => {
                const validated: {
                  forecastDate: string;
                  actualDate?: string;
                  document?: string;
                  newRentAmount?: number;
                  done?: boolean;
                }[] = Array.isArray((contract as any).indexingDates)
                  ? ((contract as any).indexingDates as any[]).filter((it: any) => it && it.done)
                  : [];
                if (validated.length === 0) return null;
                return (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
                      Afișează indexări validate
                    </summary>
                    <ul className="mt-3 space-y-3 text-[11px]">
                      {validated
                        .slice()
                        .sort((a, b) => String(b.actualDate || b.forecastDate).localeCompare(String(a.actualDate || a.forecastDate)))
                        .map((it) => (
                          <li key={contract.id + it.forecastDate} className="rounded-lg border border-foreground/15 bg-background/40 p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="space-y-1">
                                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                                  Indexare validată
                                </div>
                                <div className="text-sm font-medium text-foreground">
                                  {fmt(it.forecastDate)}
                                  {it.actualDate ? (
                                    <span className="ml-2 text-foreground/60 text-xs">(aplicată {fmt(it.actualDate)})</span>
                                  ) : null}
                                </div>
                                {it.document ? (
                                  <div className="text-xs text-foreground/60">
                                    Document: <span className="font-medium text-foreground/80">{it.document}</span>
                                  </div>
                                ) : null}
                              </div>
                              <form action={saveIndexing} className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-end">
                                <input type="hidden" name="contractId" value={contract.id} />
                                <input type="hidden" name="forecastDate" value={it.forecastDate} />
                                <div className="space-y-1">
                                  <label className="block text-foreground/60 text-[11px]">Data efectivă</label>
                                  <input
                                    name="actualDate"
                                    type="date"
                                    defaultValue={it.actualDate ?? ""}
                                    className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-foreground/60 text-[11px]">Document</label>
                                  <input
                                    name="document"
                                    type="text"
                                    maxLength={200}
                                    defaultValue={it.document ?? ""}
                                    placeholder="ex: Decizie indexare"
                                    className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-foreground/60 text-[11px]">Chirie nouă (EUR)</label>
                                  <input
                                    name="newRentAmount"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    defaultValue={typeof it.newRentAmount === "number" ? it.newRentAmount : ("" as any)}
                                    className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1 text-xs"
                                  />
                                </div>
                                <div className="sm:justify-self-end">
                              <button type="submit" className="w-full whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold border border-white/20 hover:bg-white/10" title="Salvează modificările">
                                Salvează
                              </button>
                                </div>
                              </form>
                            </div>
                          </li>
                        ))}
                    </ul>
                  </details>
                );
              })()}

              <div id="contract-deposits-list" className="rounded-xl border border-white/12 bg-white/[0.04] p-4 mt-4">
                <div className="text-[11px] uppercase tracking-wide text-white/60 mb-2">Depozite</div>
                {deposits.length === 0 ? (
                  <div className="text-white/70 text-xs">
                    Niciun depozit.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 text-[11px]">
                    {deposits.map((d) => (
                      <div
                        key={`${d.id}-${d.updatedAt ?? ""}`}
                        className="rounded bg-white/5 px-2 py-1"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">
                              {String(d.type).replace("_", " ")}
                              <span className={`ml-2 align-middle rounded px-1.5 py-0.5 text-[10px] font-semibold ${(d as any).returned ? "bg-emerald-500/10 text-emerald-300" : "bg-white/10 text-white/70"}`}>
                                {(d as any).returned ? "returnat" : "custodie"}
                              </span>
                            </div>
                            <div className="text-white/70 text-xs">
                              {(() => {
                                const parts: string[] = [];
                                if (
                                  typeof d.amountEUR === "number" &&
                                  d.amountEUR > 0
                                )
                                  parts.push(`${d.amountEUR.toFixed(2)} EUR`);
                                if (
                                  typeof (d as any).amountRON === "number" &&
                                  (d as any).amountRON > 0
                                )
                                  parts.push(
                                    `${(d as any).amountRON.toFixed(2)} RON`
                                  );
                                const amountStr =
                                  parts.length > 0 ? parts.join(" · ") : "";
                                const withNote = d.note
                                  ? amountStr
                                    ? `${amountStr} • ${d.note}`
                                    : d.note
                                  : amountStr || "—";
                                return withNote;
                              })()}
                            </div>
                            <div className="text-white/50 text-[10px] mt-1">
                              Creat: {d.createdAt ?? "—"} • Actualizat:{" "}
                              {d.updatedAt ?? "—"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <form action={toggleDepositAction}>
                              <input
                                type="hidden"
                                name="depositId"
                                value={d.id}
                              />
                              <input
                                type="hidden"
                                name="contractId"
                                value={contract.id}
                              />
                              <button type="submit" className={`rounded px-2 py-1 text-xs ${d.isDeposited ? "bg-emerald-500/10 text-emerald-300" : "bg-white/10 text-white/70"}`}>
                                {d.isDeposited ? "Depus" : "Marchează ca depus"}
                              </button>
                            </form>
                            <details className="relative">
                              <summary className="cursor-pointer text-sm text-foreground/70">
                                Editează
                              </summary>
                              <form
                                action={editDepositAction}
                                className="mt-2 flex flex-wrap items-end gap-2"
                              >
                                <input
                                  type="hidden"
                                  name="depositId"
                                  value={d.id}
                                />
                                <input
                                  type="hidden"
                                  name="contractId"
                                  value={contract.id}
                                />
                                <select
                                  name="type"
                                  defaultValue={d.type}
                                className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                                >
                                  <option value="bank_transfer">
                                    Transfer bancar
                                  </option>
                                  <option value="check">Cec</option>
                                  <option value="promissory_note">
                                    Cambie
                                  </option>
                                </select>
                                <input
                                  name="amountEUR"
                                  type="number"
                                  step="0.01"
                                  defaultValue={
                                    typeof d.amountEUR === "number"
                                      ? d.amountEUR
                                      : ("" as any)
                                  }
                                className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                                />
                                <input
                                  name="amountRON"
                                  type="number"
                                  step="0.01"
                                  defaultValue={
                                    typeof (d as any).amountRON === "number"
                                      ? (d as any).amountRON
                                      : ("" as any)
                                  }
                                className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                                />
                                <input
                                  name="note"
                                  defaultValue={d.note ?? ""}
                                  className="rounded-md border border-foreground/20 bg-background px-2 py-1"
                                />
                                <label className="text-xs flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    name="isDeposited"
                                    defaultChecked={Boolean(d.isDeposited)}
                                  />{" "}
                                  Depus
                                </label>
                                <label className="text-xs flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    name="returned"
                                    defaultChecked={Boolean(
                                      (d as any).returned
                                    )}
                                  />{" "}
                                  Returnat
                                </label>
                                <button
                                  type="submit"
                                  className="rounded-md border border-white/20 px-2 py-1 text-sm hover:bg-white/10"
                                >
                                  Salvează
                                </button>
                              </form>
                            </details>
                            <form action={deleteDepositAction}>
                              <input
                                type="hidden"
                                name="depositId"
                                value={d.id}
                              />
                              <input
                                type="hidden"
                                name="contractId"
                                value={contract.id}
                              />
                              <ConfirmSubmit
                                className="text-sm text-red-300 underline-offset-2 hover:underline"
                                title="Șterge depozitul"
                                successMessage="Depozit șters"
                                confirmMessage="Sigur dorești să ștergi acest depozit?"
                              >
                                Șterge
                              </ConfirmSubmit>
                            </form>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div id="contract-deposits-create" className="rounded-xl border border-white/12 bg-white/[0.04] p-4 mt-4">
                  <div className="text-[11px] uppercase tracking-wide text-white/60 mb-2">Adaugă depozit</div>
                  <form action={createDepositAction} className="flex flex-wrap items-end gap-3 text-[11px]">
                    <input
                      type="hidden"
                      name="contractId"
                      value={contract.id}
                    />
                    <div>
                      <label className="block text-white/60 mb-1">
                        Tip
                      </label>
                      <select
                        name="type"
                        className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                        required
                      >
                        <option value="bank_transfer">Transfer bancar</option>
                        <option value="check">Cec</option>
                        <option value="promissory_note">Cambie</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1">
                        Sumă (EUR)
                      </label>
                      <input
                        name="amountEUR"
                        type="number"
                        step="0.01"
                        min={0}
                        className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1">
                        Sumă (RON)
                      </label>
                      <input
                        name="amountRON"
                        type="number"
                        step="0.01"
                        min={0}
                        className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1">
                        Notă
                      </label>
                      <input
                        name="note"
                        className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                      />
                    </div>
                    <label className="text-xs flex items-center gap-2 mb-2 text-white/80">
                      <input type="checkbox" name="returned" /> Returnat
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-2 font-semibold hover:bg-white/10"
                    >
                      Adaugă
                    </button>
                  </form>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4 mt-4">
              <div className="text-[11px] uppercase tracking-wide text-white/60 mb-2">Corecție contract</div>
              <form action={updateCorrectionPercentAction} className="flex flex-wrap items-end gap-3 text-[11px]">
                <input type="hidden" name="contractId" value={contract.id} />
                <div>
                  <label className="block text-white/60 mb-1">Corecție %</label>
                  <input name="correctionPercent" type="number" step="0.01" min={0} max={100} defaultValue={typeof contract.correctionPercent === "number" ? contract.correctionPercent : ("" as any)} className="rounded-md border border-white/20 bg-transparent px-2 py-1" />
                </div>
                <button type="submit" className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-2 font-semibold hover:bg-white/10">Salvează corecția</button>
              </form>
            </div>
          </ManageContractScans>
        </div>
      </section>

      {contract.rentType === "yearly" &&
        (((contract as any).irregularInvoices?.length) ?? 0) > 0 && (
          <section id="contract-yearly-invoices" className="mt-8">
            <div className="rounded-lg border border-foreground/15 p-4">
              <h2 className="text-base font-semibold">Facturi anuale</h2>
              {(() => {
                const totalEUR = ((((contract as any).irregularInvoices) || []) as any[]).reduce(
                  (sum, r) => sum + (typeof r.amountEUR === "number" ? r.amountEUR : 0),
                  0
                );
                const monthlyEq = totalEUR / 12;
                const rate = typeof contract.exchangeRateRON === "number" ? contract.exchangeRateRON : undefined;
                const corrPct = typeof contract.correctionPercent === "number" ? contract.correctionPercent : 0;
                const tvaPct = typeof contract.tvaPercent === "number" ? contract.tvaPercent : 0;
                const correctedEUR = totalEUR * (1 + corrPct / 100);
                const netRON = typeof rate === "number" ? correctedEUR * rate : undefined;
                const totalRON =
                  typeof netRON === "number" ? netRON * (1 + tvaPct / 100) : undefined;
                const fmtEURLocal = (v: number) =>
                  new Intl.NumberFormat("ro-RO", {
                    style: "currency",
                    currency: "EUR",
                  }).format(v);
                const fmtRONLocal = (v: number) =>
                  new Intl.NumberFormat("ro-RO", {
                    style: "currency",
                    currency: "RON",
                  }).format(v);
                return (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-md bg-foreground/5 p-3">
                      <div className="text-foreground/60 text-xs">Venit anual</div>
                      <div className="text-base font-semibold text-indigo-700 dark:text-indigo-400">
                        {fmtEURLocal(correctedEUR)}
                      </div>
                    </div>
                    <div className="rounded-md bg-foreground/5 p-3">
                      <div className="text-foreground/60 text-xs">Echivalent lunar</div>
                      <div className="text-base font-semibold text-indigo-700 dark:text-indigo-400">
                        {fmtEURLocal(monthlyEq)}
                      </div>
                    </div>
                    <div className="rounded-md bg-foreground/5 p-3">
                      <div className="text-foreground/60 text-xs">Total RON estimat</div>
                      <div className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
                        {typeof totalRON === "number" ? fmtRONLocal(totalRON) : "–"}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Issue form for yearly entries */}
              <div className="mt-4 rounded-md bg-foreground/5 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60 mb-2">Emitere factură după grafic</div>
                <form action={issueInvoice} className="grid grid-cols-1 gap-2 sm:grid-cols-5 sm:items-end text-sm">
                  <input type="hidden" name="contractId" value={contract.id} />
                  <div>
                    <label className="block text-foreground/60 mb-1">An</label>
                    <input
                      type="number"
                      name="year"
                      min={2000}
                      max={9999}
                      defaultValue={new Date().getFullYear()}
                      className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-foreground/60 mb-1">Data din grafic</label>
                    <select name="dateKey" className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1">
                      {((((contract as any).irregularInvoices) || []) as any[])
                        .slice()
                        .sort((a, b) => a.month - b.month || a.day - b.day)
                        .map((r, i) => (
                          <option key={`${r.month}-${r.day}-${i}`} value={`${r.month}-${r.day}`}>
                            {String(r.day).padStart(2, "0")}/{String(r.month).padStart(2, "0")} – {new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" }).format(r.amountEUR)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-foreground/60 mb-1">Suprascrie EUR (opțional)</label>
                    <input
                      name="amountEUR"
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="ex: 100.00"
                      className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1"
                    />
                  </div>
                  <div className="sm:justify-self-end">
                    <ActionButton
                      className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/5"
                      title="Emite factura pentru data selectată"
                      successMessage="Factura a fost emisă"
                      triggerStatsRefresh
                    >
                      Emite
                    </ActionButton>
                  </div>
                </form>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4">
                {(((contract as any).irregularInvoices) as { month:number; day:number; amountEUR:number }[]).map((inv, idx) => {
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
                  const currentYear = new Date().getFullYear();
                  const issuedDate = new Date(currentYear, inv.month - 1, inv.day);
                  const issuedIso = issuedDate.toISOString().slice(0, 10);
                  const existingInvoice = invoices.find((it) => it.issuedAt === issuedIso);
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
                            {new Intl.NumberFormat("ro-RO", {
                              style: "currency",
                              currency: "EUR",
                            }).format(eur)}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">RON: </span>
                          <span className="font-medium">
                            {typeof baseRon === "number"
                              ? new Intl.NumberFormat("ro-RO", {
                                  style: "currency",
                                  currency: "RON",
                                  maximumFractionDigits: 2,
                                }).format(baseRon)
                              : "Indisponibil"}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">
                            Corecție{corrPct ? ` (${corrPct}%)` : ""}:{" "}
                          </span>
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            {typeof correctionRon === "number"
                              ? new Intl.NumberFormat("ro-RO", {
                                  style: "currency",
                                  currency: "RON",
                                  maximumFractionDigits: 2,
                                }).format(correctionRon)
                              : "Indisponibil"}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">
                            EUR după corecție:{" "}
                          </span>
                          <span className="font-medium text-indigo-700 dark:text-indigo-400">
                            {new Intl.NumberFormat("ro-RO", {
                              style: "currency",
                              currency: "EUR",
                            }).format(correctedEur)}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">
                            RON după corecție:{" "}
                          </span>
                          <span className="font-medium text-sky-700 dark:text-sky-400">
                            {typeof correctedRon === "number"
                              ? new Intl.NumberFormat("ro-RO", {
                                  style: "currency",
                                  currency: "RON",
                                  maximumFractionDigits: 2,
                                }).format(correctedRon)
                              : "Indisponibil"}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">
                            RON cu TVA{tvaPct ? ` (${tvaPct}%)` : ""}:{" "}
                          </span>
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {typeof withVat === "number"
                              ? new Intl.NumberFormat("ro-RO", {
                                  style: "currency",
                                  currency: "RON",
                                  maximumFractionDigits: 2,
                                }).format(withVat)
                              : "Indisponibil"}
                          </span>
                        </div>
                        <div>
                          <span className="text-foreground/60">TVA: </span>
                          <span className="font-medium text-rose-700 dark:text-rose-400">
                            {typeof vatAmount === "number"
                              ? new Intl.NumberFormat("ro-RO", {
                                  style: "currency",
                                  currency: "RON",
                                  maximumFractionDigits: 2,
                                }).format(vatAmount)
                              : "Indisponibil"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {existingInvoice ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M9 12l2 2 4-4" />
                              <circle cx="12" cy="12" r="9" />
                            </svg>
                            Emisă ({existingInvoice.number || existingInvoice.id})
                          </span>
                        ) : (
                          <form action={issueInvoice} className="inline-flex items-center gap-2">
                            <input type="hidden" name="contractId" value={contract.id} />
                            <input type="hidden" name="issuedAt" value={issuedIso} />
                            <ActionButton
                              className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-medium hover:bg-foreground/5"
                              title="Emite factura anuală"
                              successMessage="Factura a fost emisă"
                              triggerStatsRefresh
                            >
                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M12 5v14" />
                                <path d="M5 12h14" />
                                <circle cx="12" cy="12" r="9" />
                              </svg>
                              Emite
                            </ActionButton>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

      <section id="contract-invoices" className="mt-8">
        <div className="rounded-lg border border-foreground/15 p-4">
          <h2 className="text-base font-semibold">Facturi emise</h2>
          <form
            action={issueInvoice}
            className="mt-3 flex items-center gap-2 text-sm"
            id="contract-invoices-issue-form"
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
              defaultValue={dueAt ?? todayISOForLists}
            />
            <button
              type="submit"
              className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                Boolean(dueAt && invoices.some((inv) => inv.issuedAt === dueAt))
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 cursor-not-allowed"
                  : "border-foreground/20 hover:bg-foreground/5"
              }`}
              disabled={Boolean(
                dueAt && invoices.some((inv) => inv.issuedAt === dueAt)
              )}
            >
              Emite factura
            </button>
            {Boolean(
              dueAt && invoices.some((inv) => inv.issuedAt === dueAt)
            ) && (
              <span className="inline-block rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px]">
                deja emisă pentru luna curentă{dueAt ? ` (${dueAt})` : ""}
              </span>
            )}
          </form>
          <div
            id="contract-invoices-list"
            className="mt-3 grid grid-cols-1 gap-3"
          >
            {invoices.length === 0 ? (
              <div className="text-sm text-foreground/60">
                Nicio factură emisă.
              </div>
            ) : (
              invoices.map((inv) => {
                const confirmMessage = `Sigur dorești să ștergi factura emisă la ${fmt(
                  inv.issuedAt
                )}${inv.number ? ` (nr. ${inv.number})` : ""}?`;
                return (
                  <div
                    key={inv.id}
                    className="rounded-md bg-foreground/5 p-3 flex flex-col gap-2"
                    id={`invoice-${inv.id}`}
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
                          {inv.exchangeRateRON.toFixed(4)} · TVA{" "}
                          {inv.tvaPercent}%
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
                        <ConfirmSubmit
                          className="rounded-md border border-red-300 text-red-600 px-2 py-1 text-xs font-semibold hover:bg-red-50/10"
                          title="Șterge factura"
                          successMessage="Factura a fost ștearsă"
                          confirmMessage={confirmMessage}
                        >
                          Șterge
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
