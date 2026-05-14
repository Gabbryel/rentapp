"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";
import {
  deleteWrittenContract,
  getWrittenContractById,
  upsertWrittenContract,
} from "@/lib/written-contracts";
import { ContractSchema } from "@/lib/schemas/contract";
import {
  fetchContractById,
  upsertContract,
  computeFutureIndexingDates,
} from "@/lib/contracts";

export type DeleteWrittenContractResult = {
  ok: boolean;
  message?: string;
};

export async function deleteWrittenContractAction(
  id: string
): Promise<DeleteWrittenContractResult> {
  const trimmedId = id?.trim();
  if (!trimmedId) {
    return {
      ok: false,
      message: "ID-ul documentului este invalid.",
    };
  }

  const existing = await getWrittenContractById(trimmedId);
  if (!existing) {
    return {
      ok: false,
      message: "Documentul nu există sau a fost deja șters.",
    };
  }

  const deleted = await deleteWrittenContract(trimmedId);
  if (!deleted) {
    return {
      ok: false,
      message: "Nu am putut șterge documentul scris.",
    };
  }

  const user = await currentUser();

  try {
    await logAction({
      action: "written-contract.delete",
      targetType: "written-contract",
      targetId: trimmedId,
      meta: {
        title: existing.title,
        contractId: existing.contractId ?? null,
      },
      userEmail: user?.email ?? undefined,
    });
  } catch {}

  try {
    await createMessage({
      text: `Contract scris șters: ${existing.title}`,
    });
  } catch {}

  revalidatePath("/admin/written-contracts");
  if (existing.contractId) {
    revalidatePath(`/contracts/${existing.contractId}`);
  }

  return { ok: true };
}

export type ToggleSignedResult = {
  ok: boolean;
  message?: string;
};

export async function toggleSignedStatusAction(
  id: string,
  signed: boolean
): Promise<ToggleSignedResult> {
  try {
    const existing = await getWrittenContractById(id);
    if (!existing) {
      return {
        ok: false,
        message: "Contractul scris nu a fost găsit.",
      };
    }

    await upsertWrittenContract({
      ...existing,
      signed,
    });

    const user = await currentUser();

    try {
      await logAction({
        action: "written-contract.update",
        targetType: "written-contract",
        targetId: id,
        meta: {
          title: existing.title,
          contractId: existing.contractId ?? null,
          field: "signed",
          oldValue: existing.signed,
          newValue: signed,
        },
        userEmail: user?.email ?? undefined,
      });
    } catch {}

    revalidatePath("/admin/written-contracts");
    if (existing.contractId) {
      revalidatePath(`/contracts/${existing.contractId}`);
    }

    return {
      ok: true,
    };
  } catch (error) {
    console.error("Error toggling signed status:", error);
    return {
      ok: false,
      message: "Nu am putut actualiza statusul de semnare.",
    };
  }
}

export type GenerateContractResult = {
  ok: boolean;
  message?: string;
  contractId?: string;
};

export async function generateContractFromWrittenContractAction(
  id: string
): Promise<GenerateContractResult> {
  const wc = await getWrittenContractById(id);
  if (!wc) return { ok: false, message: "Documentul nu a fost găsit." };
  if (wc.contractId)
    return {
      ok: false,
      message: "Există deja un contract asociat acestui document.",
    };

  const partnerName = wc.partnerName?.trim();
  const ownerName = wc.ownerName?.trim();
  const signedAt = wc.contractSignedAt?.trim();
  const startDate = wc.contractStartDate?.trim();
  const endDate = wc.contractEndDate?.trim();

  const missing: string[] = [];
  if (!partnerName) missing.push("partener");
  if (!ownerName) missing.push("proprietar");
  if (!signedAt) missing.push("dată semnare");
  if (!startDate) missing.push("dată start");
  if (!endDate) missing.push("dată end");
  if (missing.length > 0)
    return { ok: false, message: `Câmpuri lipsă în contractul scris: ${missing.join(", ")}` };

  const parseIntField = (s?: string, min = 0, max = 999) => {
    if (!s) return undefined;
    const n = Number(s.trim().replace(",", "."));
    return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
  };
  const parseFloatField = (s?: string, min = 0, max = 1e9) => {
    if (!s) return undefined;
    const n = Number(s.trim().replace(",", "."));
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
  };

  const amountEUR = (() => {
    const raw = wc.rentAmount?.trim() || wc.rentAmountText?.trim();
    if (!raw) return undefined;
    const match = raw.replace(",", ".").match(/[\d.]+/);
    if (!match) return undefined;
    const n = Number(match[0]);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  })();

  const safeSlug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

  const baseName = wc.assetName
    ? `${wc.assetName} ${partnerName}`.trim()
    : partnerName!;
  const baseId = `c_${safeSlug(baseName)}` || `c_${Date.now()}`;

  let uniqueId = baseId;
  let counter = 1;
  while (counter < 100) {
    const exists = await fetchContractById(uniqueId);
    if (!exists) break;
    uniqueId = `${baseId}-${counter++}`;
  }

  const indexingMonth = parseIntField(wc.indexingMonth, 1, 12);
  const draft = {
    id: uniqueId,
    name: baseName,
    assetId: wc.assetId || undefined,
    asset: wc.assetName?.trim() || undefined,
    partnerId: wc.partnerId || undefined,
    partner: partnerName!,
    ownerId: wc.ownerId || undefined,
    owner: ownerName!,
    signedAt: signedAt!,
    startDate: startDate!,
    endDate: endDate!,
    tvaPercent: parseIntField(wc.tvaPercent, 0, 100),
    tvaType: wc.tvaType?.trim() || undefined,
    correctionPercent: parseFloatField(wc.correctionPercent, 0, 100),
    monthlyInvoiceDay: parseIntField(wc.monthlyInvoiceDay, 1, 31),
    paymentDueDays: parseIntField(wc.paymentDueDays, 0, 120),
    invoiceMonthMode: (wc.invoiceMonthMode === "next" ? "next" : "current") as
      | "current"
      | "next",
    indexingMonth,
    indexingDates: [] as { forecastDate: string; done: boolean; newRentAmount?: number }[],
    scans: [] as { url: string }[],
    mementos: [] as never[],
    rentType: "monthly" as const,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fut = computeFutureIndexingDates(draft as any);
  let indexingDates: { forecastDate: string; done: boolean; actualDate?: string; newRentAmount?: number }[] =
    (fut as { forecastDate: string; done: boolean; actualDate?: string; newRentAmount?: number }[])
      .map((r) => ({
        forecastDate: String(r.forecastDate),
        done: Boolean(r.done),
        actualDate: r.actualDate ? String(r.actualDate) : undefined,
        newRentAmount: typeof r.newRentAmount === "number" ? r.newRentAmount : undefined,
      }))
      .sort((a, b) => a.forecastDate.localeCompare(b.forecastDate));

  if (typeof amountEUR === "number") {
    if (indexingDates.length > 0) {
      indexingDates[0] = { ...indexingDates[0], newRentAmount: amountEUR };
    } else {
      indexingDates = [{ forecastDate: startDate!, actualDate: startDate!, newRentAmount: amountEUR, done: false }];
    }
  }

  const parsed = ContractSchema.safeParse({ ...draft, indexingDates });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((e) => e.message).join("; "),
    };
  }

  try {
    await upsertContract(parsed.data);
    await upsertWrittenContract({ ...wc, contractId: uniqueId });

    const user = await currentUser();
    try {
      await logAction({
        action: "contract.create",
        targetType: "contract",
        targetId: uniqueId,
        meta: { fromWrittenContractId: id, name: baseName },
        userEmail: user?.email ?? undefined,
      });
    } catch {}

    try {
      await createMessage({
        text: `Contract generat din contract scris: ${baseName}`,
      });
    } catch {}

    revalidatePath("/admin/written-contracts");
    revalidatePath("/contracts");
    revalidatePath("/");

    return { ok: true, contractId: uniqueId };
  } catch (error) {
    console.error("Error generating contract:", error);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Nu am putut genera contractul.",
    };
  }
}
