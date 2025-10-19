"use server";

import { fetchContractById, upsertContract } from "@/lib/contracts";
import { logAction } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function addYearlyInvoiceEntryAction(_prev: any, formData: FormData) {
  const contractId = String(formData.get("contractId") || "");
  const month = Number(String(formData.get("month") || ""));
  const day = Number(String(formData.get("day") || ""));
  const amount = Number(String(formData.get("amountEUR") || "").replace(",", "."));
  if (!contractId) return { ok: false, message: "Lipsește contractId" };
  if (!Number.isInteger(month) || month < 1 || month > 12)
    return { ok: false, message: "Luna invalidă" };
  if (!Number.isInteger(day) || day < 1 || day > 31)
    return { ok: false, message: "Zi invalidă" };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, message: "Sumă invalidă" };
  const existing = await fetchContractById(contractId);
  if (!existing) return { ok: false, message: "Contract inexistent" };
  const prev = Array.isArray((existing as any).irregularInvoices)
    ? ((existing as any).irregularInvoices as any[]).slice()
    : Array.isArray((existing as any).yearlyInvoices)
    ? ((existing as any).yearlyInvoices as any[]).slice()
    : [];
  const filtered = prev.filter((r) => !(r.month === month && r.day === day));
  filtered.push({ month, day, amountEUR: amount });
  filtered.sort((a, b) => a.month - b.month || a.day - b.day);
  await upsertContract({ ...(existing as any), irregularInvoices: filtered } as any);
  await logAction({
    action: "contract.irregularInvoices.add",
    targetType: "contract",
    targetId: contractId,
    meta: { month, day, amountEUR: amount },
  });
  revalidatePath(`/contracts/${contractId}`);
  return { ok: true };
}

export async function removeYearlyInvoiceEntryAction(_prev: any, formData: FormData) {
  const contractId = String(formData.get("contractId") || "");
  const month = Number(String(formData.get("month") || ""));
  const day = Number(String(formData.get("day") || ""));
  if (!contractId) return { ok: false, message: "Lipsește contractId" };
  if (!Number.isInteger(month) || month < 1 || month > 12)
    return { ok: false, message: "Luna invalidă" };
  if (!Number.isInteger(day) || day < 1 || day > 31)
    return { ok: false, message: "Zi invalidă" };
  const existing = await fetchContractById(contractId);
  if (!existing) return { ok: false, message: "Contract inexistent" };
  const prev = Array.isArray((existing as any).irregularInvoices)
    ? ((existing as any).irregularInvoices as any[]).slice()
    : Array.isArray((existing as any).yearlyInvoices)
    ? ((existing as any).yearlyInvoices as any[]).slice()
    : [];
  const filtered = prev.filter((r) => !(r.month === month && r.day === day));
  await upsertContract({ ...(existing as any), irregularInvoices: filtered } as any);
  await logAction({
    action: "contract.irregularInvoices.remove",
    targetType: "contract",
    targetId: contractId,
    meta: { month, day },
  });
  revalidatePath(`/contracts/${contractId}`);
  return { ok: true };
}
