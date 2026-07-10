"use server";

import { fetchContractById, upsertContract } from "@/lib/contracts";
import { logAction } from "@/lib/audit";
import { revalidatePath } from "next/cache";

type Entry = { date: string; amountEUR: number };

function parseDate(raw: FormDataEntryValue | null): string | null {
  const s = String(raw || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : s;
}

function parseAmount(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw || "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function currentEntries(existing: Record<string, unknown>): Entry[] {
  const arr = Array.isArray(existing.customInvoices)
    ? (existing.customInvoices as Entry[])
    : [];
  return arr
    .filter((r) => typeof r?.date === "string" && typeof r?.amountEUR === "number")
    .map((r) => ({ date: r.date, amountEUR: r.amountEUR }));
}

async function saveEntries(existing: Record<string, unknown>, entries: Entry[]) {
  entries.sort((a, b) => a.date.localeCompare(b.date));
  await upsertContract({
    ...(existing as object),
    rentType: "custom",
    customInvoices: entries,
    // Drop deprecated recurring schedule once the contract uses explicit dates
    irregularInvoices: undefined,
    yearlyInvoices: undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

export async function addCustomInvoiceEntryAction(_prev: unknown, formData: FormData) {
  const contractId = String(formData.get("contractId") || "");
  const date = parseDate(formData.get("date"));
  const amountEUR = parseAmount(formData.get("amountEUR"));
  if (!contractId) return { ok: false, message: "Lipsește contractId" };
  if (!date) return { ok: false, message: "Dată invalidă" };
  if (!amountEUR) return { ok: false, message: "Sumă invalidă" };
  const existing = await fetchContractById(contractId);
  if (!existing) return { ok: false, message: "Contract inexistent" };
  const entries = currentEntries(existing as Record<string, unknown>).filter(
    (r) => r.date !== date
  );
  entries.push({ date, amountEUR });
  await saveEntries(existing as Record<string, unknown>, entries);
  await logAction({
    action: "contract.customInvoices.add",
    targetType: "contract",
    targetId: contractId,
    meta: { date, amountEUR },
  });
  revalidatePath(`/contracts/${contractId}`);
  return { ok: true };
}

export async function updateCustomInvoiceEntryAction(_prev: unknown, formData: FormData) {
  const contractId = String(formData.get("contractId") || "");
  const originalDate = parseDate(formData.get("originalDate"));
  const date = parseDate(formData.get("date"));
  const amountEUR = parseAmount(formData.get("amountEUR"));
  if (!contractId) return { ok: false, message: "Lipsește contractId" };
  if (!originalDate) return { ok: false, message: "Rând invalid" };
  if (!date) return { ok: false, message: "Dată invalidă" };
  if (!amountEUR) return { ok: false, message: "Sumă invalidă" };
  const existing = await fetchContractById(contractId);
  if (!existing) return { ok: false, message: "Contract inexistent" };
  const entries = currentEntries(existing as Record<string, unknown>);
  const idx = entries.findIndex((r) => r.date === originalDate);
  if (idx === -1) return { ok: false, message: "Rândul nu mai există" };
  if (date !== originalDate && entries.some((r) => r.date === date)) {
    return { ok: false, message: "Există deja o factură la această dată" };
  }
  entries[idx] = { date, amountEUR };
  await saveEntries(existing as Record<string, unknown>, entries);
  await logAction({
    action: "contract.customInvoices.update",
    targetType: "contract",
    targetId: contractId,
    meta: { originalDate, date, amountEUR },
  });
  revalidatePath(`/contracts/${contractId}`);
  return { ok: true };
}

export async function removeCustomInvoiceEntryAction(_prev: unknown, formData: FormData) {
  const contractId = String(formData.get("contractId") || "");
  const date = parseDate(formData.get("date"));
  if (!contractId) return { ok: false, message: "Lipsește contractId" };
  if (!date) return { ok: false, message: "Dată invalidă" };
  const existing = await fetchContractById(contractId);
  if (!existing) return { ok: false, message: "Contract inexistent" };
  const entries = currentEntries(existing as Record<string, unknown>).filter(
    (r) => r.date !== date
  );
  if (entries.length === 0) {
    return {
      ok: false,
      message:
        "Nu poți șterge ultima factură din grafic — contractul custom are nevoie de cel puțin una.",
    };
  }
  await saveEntries(existing as Record<string, unknown>, entries);
  await logAction({
    action: "contract.customInvoices.remove",
    targetType: "contract",
    targetId: contractId,
    meta: { date },
  });
  revalidatePath(`/contracts/${contractId}`);
  return { ok: true };
}
