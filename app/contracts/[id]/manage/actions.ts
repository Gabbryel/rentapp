"use server";

import { revalidatePath } from "next/cache";
import {
  effectiveEndDate,
  fetchContractById,
  upsertContract,
} from "@/lib/contracts";
import type { WrittenContract } from "@/lib/schemas/written-contract";
import { listWrittenContractsByContractId } from "@/lib/written-contracts";
import {
  createDeposit,
  updateDeposit,
  deleteDepositById,
  toggleDepositDeposited,
} from "@/lib/deposits";
import { logAction } from "@/lib/audit";
import { publishToast } from "@/lib/sse";
import { normalizeIsoDate } from "@/lib/utils/date";

function latestWrittenContractEnd(writtenContracts: WrittenContract[]): string | null {
  const ends = writtenContracts
    .map((wc) => normalizeIsoDate((wc as any)?.contractEndDate))
    .filter((d): d is string => Boolean(d));
  if (ends.length === 0) return null;
  ends.sort((a, b) => b.localeCompare(a));
  return ends[0] ?? null;
}

function resolveEndDateWithWritten(baseEnd: unknown, writtenEnd: unknown): string {
  const base = normalizeIsoDate(baseEnd);
  const written = normalizeIsoDate(writtenEnd);
  return written || base || "";
}

export async function createDepositAction(formData: FormData) {
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

  const note = formData.get("note") ? String(formData.get("note") || "") : undefined;

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

export async function editDepositAction(formData: FormData) {
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

export async function deleteDepositAction(formData: FormData) {
  const depositId = String(formData.get("depositId") || "");
  const contractId = String(formData.get("contractId") || "");
  if (!depositId) return;
  await deleteDepositById(depositId);
  revalidatePath(`/contracts/${contractId}`);
}

export async function toggleDepositAction(formData: FormData) {
  const depositId = String(formData.get("depositId") || "");
  const contractId = String(formData.get("contractId") || "");
  if (!depositId) return;
  await toggleDepositDeposited(depositId);
  revalidatePath(`/contracts/${contractId}`);
}

export async function updateCorrectionPercentAction(formData: FormData) {
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
    if (typeof value === "number") patch.correctionPercent = value;
    else delete patch.correctionPercent;
    await upsertContract(patch);

    await logAction({
      action: "contract.correction.update",
      targetType: "contract",
      targetId: contractId,
      meta: { correctionPercent: value },
    });

    publishToast("Corecția a fost actualizată", "success");
  } catch (e: any) {
    const msg =
      (e && (e.message || String(e))) || "Eroare la actualizarea corecției";
    publishToast(String(msg), "error");
  }

  revalidatePath(`/contracts/${contractId}`);
}

export async function addExtensionAction(formData: FormData) {
  const contractId = String(formData.get("contractId") || "");
  const docDate = String(formData.get("docDate") || "");
  const document = String(formData.get("document") || "");
  const extendedUntil = String(formData.get("extendedUntil") || "");

  if (!contractId) return;

  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(docDate) || !iso.test(extendedUntil)) return;

  const existing = await fetchContractById(contractId);
  if (!existing) return;

  const writtenContracts = await listWrittenContractsByContractId(contractId);
  const latestWrittenEnd = latestWrittenContractEnd(writtenContracts);
  const norm = (s: string) => String(s).slice(0, 10);

  const newEntry = {
    docDate: norm(docDate),
    document: document.trim() || "act adițional",
    extendedUntil: norm(extendedUntil),
  };

  // Guardrails against common mistakes
  const signedAt = new Date(existing.signedAt);
  const currentEffectiveEnd = new Date(
    resolveEndDateWithWritten(effectiveEndDate(existing), latestWrittenEnd)
  );
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

export async function deleteExtensionAction(formData: FormData) {
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
