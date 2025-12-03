"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";
import {
  WrittenContractDraftSchema,
  type WrittenContractDraft,
} from "@/lib/schemas/written-contract";
import { upsertWrittenContract } from "@/lib/written-contracts";

export type FormState = {
  ok: boolean;
  message?: string;
  id?: string;
  redirectTo?: string;
};

export async function saveWrittenContractAction(
  _prevState: FormState | null,
  formData: FormData
): Promise<FormState> {
  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.trim() === "") {
    return {
      ok: false,
      message: "Datele documentului nu au fost trimise.",
    };
  }

  let draft: WrittenContractDraft;
  try {
    const parsed = JSON.parse(raw) as unknown;
    draft = WrittenContractDraftSchema.parse(parsed);
  } catch (error) {
    return {
      ok: false,
      message: "Nu am putut valida conținutul contractului scris.",
    };
  }

  if (draft.body.trim().length === 0) {
    return {
      ok: false,
      message: "Contractul trebuie să conțină text.",
    };
  }

  const user = await currentUser();

  try {
    const saved = await upsertWrittenContract({
      ...draft,
      authorEmail: user?.email ?? undefined,
    });

    await logAction({
      action: draft.id ? "written-contract.update" : "written-contract.create",
      targetType: "written-contract",
      targetId: saved.id,
      meta: {
        title: saved.title,
        contractId: saved.contractId ?? null,
      },
      userEmail: user?.email ?? undefined,
    });

    try {
      await createMessage({
        text: `${draft.id ? "Contract scris actualizat" : "Contract scris generat"}: ${saved.title}`,
      });
    } catch {}

    revalidatePath("/admin/written-contracts");
    if (saved.contractId) {
      revalidatePath(`/contracts/${saved.contractId}`);
    }

    return {
      ok: true,
      id: saved.id,
      redirectTo: `/contracts/written-contract?writtenContractId=${encodeURIComponent(
        saved.id
      )}`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Nu am putut salva contractul scris.",
    };
  }
}
