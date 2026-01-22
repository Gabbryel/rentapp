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
