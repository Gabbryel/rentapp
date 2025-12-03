"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";
import {
  deleteWrittenContract,
  getWrittenContractById,
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
