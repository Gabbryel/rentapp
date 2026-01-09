"use server";

import { revalidatePath } from "next/cache";
import {
  currentRentAmount,
  fetchContractById,
  upsertContract,
} from "@/lib/contracts";
import { fetchPartnerById } from "@/lib/partners";
import { fetchOwnerById } from "@/lib/owners";
import { getAssetById } from "@/lib/assets";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";
import { saveScanFile, deleteScanByUrl } from "@/lib/storage";
import { ContractSchema } from "@/lib/schemas/contract";
import { getEuroInflationPercent } from "@/lib/inflation";

export type ScanActionState = { ok: boolean; message?: string };
export type IndexingNoticeState = { ok: boolean; message?: string };

function isAcceptableScanUrl(url: string): boolean {
  try {
    if (!url || typeof url !== "string") return false;
    if (url.startsWith("/")) {
      return /(\.(pdf|png|jpe?g|gif|webp|svg)(?:$|[?#]))|(^\/api\/uploads\/[a-f\d]{24}(?:$|[?#]))/i.test(
        url
      );
    }
    const u = new URL(url);
    return /(\.(pdf|png|jpe?g|gif|webp|svg)(?:$|[?#]))/i.test(u.pathname);
  } catch {
    return false;
  }
}

export async function addScanAction(_: ScanActionState, formData: FormData): Promise<ScanActionState> {
  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false, message: "ID contract lipsă" };
  const titleRaw = String(formData.get("scanTitle") || "");
  const title = titleRaw.trim() || undefined;
  const file = formData.get("scanFile");
  const urlRaw = String(formData.get("scanUrl") || "").trim();

  try {
    const prev = await fetchContractById(id);
    if (!prev) return { ok: false, message: "Contract inexistent" };

    let url: string | undefined = undefined;
    if (file && file instanceof File && file.size > 0) {
      const okType = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ].includes(file.type);
      if (!okType) {
        return { ok: false, message: "Fișierul trebuie să fie PDF sau imagine (png/jpg/jpeg/gif/webp/svg)" };
      }
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize)
        return { ok: false, message: "Fișierul este prea mare (max 5MB)" };
      const orig = file.name || "scan";
      const base = orig.replace(/\.[^.]+$/, "");
      const res = await saveScanFile(file, `${id}-${base}`, { contractId: id });
      url = res.url;
    } else if (urlRaw) {
      if (!isAcceptableScanUrl(urlRaw)) return { ok: false, message: "URL invalid sau format neacceptat" };
      url = urlRaw;
    } else {
      return { ok: false, message: "Selectează un fișier sau completează URL-ul" };
    }

    const scans = Array.isArray((prev as any).scans) ? ([...(prev as any).scans] as { url: string; title?: string }[]) : [];
    scans.push({ url: url!, title });

    const next = { ...prev, scans, scanUrl: scans[0]?.url };
  const parsed = ContractSchema.safeParse(next);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Date invalide" };

    await upsertContract(parsed.data);
    try {
      await logAction({ action: "contract.scan.add", targetType: "contract", targetId: id, meta: { url, title } });
    } catch {}
    try {
      const what = file && file instanceof File && file.size > 0 ? `fișier uploadat` : `URL`;
      await createMessage({
        text: `Contract: ${prev.name} • Scan adăugat (${what}) • URL: ${url}${title ? ` • Titlu: ${title}` : ""} • Total scanuri: ${scans.length}`,
      });
    } catch {}
    revalidatePath(`/contracts/${id}`);
    return { ok: true };
  } catch (e) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as any).message) : String(e);
    return { ok: false, message: msg };
  }
}

export async function issueIndexingNoticeAction(
  _: IndexingNoticeState,
  formData: FormData
): Promise<IndexingNoticeState> {
  const contractId = String(formData.get("contractId") || "");
  const contractNumberRaw = String(formData.get("contractNumber") || "").trim();
  const contractSignedAtRaw = String(
    formData.get("contractSignedAt") || ""
  ).trim();
  const noteRaw = String(formData.get("note") || "").trim();
  if (!contractId) return { ok: false, message: "ID contract lipsă" };
  if (!contractNumberRaw) return { ok: false, message: "Număr contract lipsă" };
  const contractSignedAtIso = contractSignedAtRaw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contractSignedAtIso)) {
    return { ok: false, message: "Data semnării contractului este invalidă" };
  }
  const contract = await fetchContractById(contractId);
  if (!contract) return { ok: false, message: "Contract inexistent" };

  const rent = currentRentAmount(contract);
  if (typeof rent !== "number") {
    return { ok: false, message: "Chiria curentă nu este disponibilă." };
  }

  const twelveMonthsAgo = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d;
  })();

  // Try cache-first, then force refresh to mitigate temporary ECB outages
  let inflation = await getEuroInflationPercent({ from: twelveMonthsAgo });
  if (!inflation) {
    inflation = await getEuroInflationPercent({ from: twelveMonthsAgo, forceRefresh: true });
  }
  if (!inflation) {
    return {
      ok: false,
      message: "Indicele de inflație nu este disponibil acum. Încearcă din nou mai târziu.",
    };
  }

  const deltaPercent = inflation.percent;
  const deltaAmount = (rent * deltaPercent) / 100;

  const now = new Date();
  const validFrom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  )
    .toISOString()
    .slice(0, 10);

  const contractNumber = contractNumberRaw;
  const contractSignedAt = contractSignedAtIso;

  // Optional enrichment for notice template rendering
  let partnerAddress: string | undefined;
  let partnerCui: string | undefined;
  let partnerRepresentative: string | undefined;
  try {
    if (contract.partnerId) {
      const partner = await fetchPartnerById(String(contract.partnerId));
      if (partner) {
        partnerAddress = partner.headquarters;
        partnerCui = partner.vatNumber;
        const reps = Array.isArray(partner.representatives)
          ? partner.representatives
          : [];
        const primary = reps.find((r) => r?.primary && r?.fullname);
        const first = reps.find((r) => r?.fullname);
        partnerRepresentative =
          String(primary?.fullname || first?.fullname || "").trim() || undefined;
      }
    }
  } catch {}

  let ownerName: string | undefined;
  try {
    if ((contract as any).ownerId) {
      const owner = await fetchOwnerById(String((contract as any).ownerId));
      ownerName = owner?.name;
    }
  } catch {}
  if (!ownerName) {
    ownerName = typeof (contract as any).owner === "string" ? (contract as any).owner : undefined;
  }

  let assetAddress: string | undefined;
  try {
    if ((contract as any).assetId) {
      const asset = await getAssetById(String((contract as any).assetId));
      assetAddress = asset?.address;
    }
  } catch {}

  await logAction({
    action: "indexing.notice.issue",
    targetType: "contract",
    targetId: contractId,
    meta: {
      ...(contractNumber ? { contractNumber } : {}),
      ...(contractSignedAt ? { contractSignedAt } : {}),
      ...(noteRaw ? { note: noteRaw } : {}),
      validFrom,
      partnerName: (contract as any).partner,
      partnerId: (contract as any).partnerId,
      partnerAddress,
      partnerCui,
      partnerRepresentative,
      ownerName,
      ownerId: (contract as any).ownerId,
      assetAddress,
      rentEUR: rent,
      deltaPercent,
      deltaAmountEUR: deltaAmount,
      fromMonth: inflation.fromMonth,
      toMonth: inflation.toMonth,
    },
  });

  revalidatePath(`/contracts/${contractId}`);
  return {
    ok: true,
    message: `Notificare emisă: +${deltaPercent.toFixed(2)}% (+${deltaAmount.toFixed(2)} EUR)`,
  };
}

export async function updateScanTitleAction(_prevState: ScanActionState, formData: FormData): Promise<ScanActionState> {
  const id = String(formData.get("id") || "").trim();
  const index = Number(String(formData.get("index") || ""));
  const titleRaw = String(formData.get("scanTitle") || "");
  const title = titleRaw.trim() || undefined;
  if (!id) return { ok: false, message: "ID contract lipsă" };
  if (!Number.isInteger(index) || index < 0) return { ok: false, message: "Index invalid" };
  try {
    const prev = await fetchContractById(id);
    if (!prev) return { ok: false, message: "Contract inexistent" };
  const scans = Array.isArray((prev as any).scans) ? ([...(prev as any).scans] as { url: string; title?: string }[]) : [];
  if (index >= scans.length) return { ok: false, message: "Index în afara limitelor" };
  const before = scans[index]?.title;
  scans[index] = { ...scans[index], title };
    const next = { ...prev, scans, scanUrl: scans[0]?.url };
  const parsed = ContractSchema.safeParse(next);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Date invalide" };
    await upsertContract(parsed.data);
    try {
      await logAction({ action: "contract.scan.update", targetType: "contract", targetId: id, meta: { index, title } });
    } catch {}
    try {
      await createMessage({
        text: `Contract: ${prev.name} • Titlu scan #${index + 1} actualizat: ${before ? `"${before}" → ` : ""}${title ? `"${title}"` : "(fără titlu)"}`,
      });
    } catch {}
    revalidatePath(`/contracts/${id}`);
    return { ok: true };
  } catch (e) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as any).message) : String(e);
    return { ok: false, message: msg };
  }
}

export async function deleteScanAction(_prevState: ScanActionState, formData: FormData): Promise<ScanActionState> {
  const id = String(formData.get("id") || "").trim();
  const index = Number(String(formData.get("index") || ""));
  if (!id) return { ok: false, message: "ID contract lipsă" };
  if (!Number.isInteger(index) || index < 0) return { ok: false, message: "Index invalid" };
  try {
    const prev = await fetchContractById(id);
    if (!prev) return { ok: false, message: "Contract inexistent" };
  const scans = Array.isArray((prev as any).scans) ? ([...(prev as any).scans] as { url: string; title?: string }[]) : [];
  if (index >= scans.length) return { ok: false, message: "Index în afara limitelor" };
  const removed = scans.splice(index, 1)[0];
    const next = { ...prev, scans, scanUrl: scans[0]?.url };
  const parsed = ContractSchema.safeParse(next);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Date invalide" };
    await upsertContract(parsed.data);
    try {
      await logAction({ action: "contract.scan.delete", targetType: "contract", targetId: id, meta: { removedUrl: removed?.url } });
    } catch {}
    try {
      await createMessage({
        text: `Contract: ${prev.name} • Scan șters • URL: ${removed?.url}${removed?.title ? ` • Titlu: ${removed.title}` : ""} • Total scanuri: ${scans.length}`,
      });
    } catch {}
    try {
      await deleteScanByUrl(removed?.url);
    } catch {}
    revalidatePath(`/contracts/${id}`);
    return { ok: true };
  } catch (e) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as any).message) : String(e);
    return { ok: false, message: msg };
  }
}

export async function updateVatPercentAction(
  _: ScanActionState,
  formData: FormData
): Promise<ScanActionState> {
  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false, message: "ID contract lipsă" };

  const rawVat = String(formData.get("tvaPercent") ?? "").trim();
  let nextVat: number | undefined;

  if (rawVat.length > 0) {
    const parsed = Number(rawVat);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
      return {
        ok: false,
        message: "TVA trebuie să fie un număr întreg între 0 și 100.",
      };
    }
    nextVat = parsed;
  }

  try {
    const prev = await fetchContractById(id);
    if (!prev) return { ok: false, message: "Contract inexistent" };

    const currentVat = typeof (prev as any).tvaPercent === "number" ? (prev as any).tvaPercent : undefined;
    const next = { ...prev } as Record<string, unknown>;
    if (typeof nextVat === "number") {
      next.tvaPercent = nextVat;
    } else {
      delete next.tvaPercent;
    }

    const parsedContract = ContractSchema.safeParse(next);
    if (!parsedContract.success) {
      return {
        ok: false,
        message: parsedContract.error.issues[0]?.message || "Date TVA invalide",
      };
    }

    await upsertContract(parsedContract.data);

    try {
      await logAction({
        action: "contract.vat.update",
        targetType: "contract",
        targetId: id,
        meta: { from: currentVat ?? null, to: nextVat ?? null },
      });
    } catch {}

    try {
      const toLabel = typeof nextVat === "number" ? `${nextVat}%` : "—";
      const fromLabel = typeof currentVat === "number" ? `${currentVat}%` : "—";
      await createMessage({
        text: `Contract: ${prev.name} • TVA actualizat ${fromLabel} → ${toLabel}`,
      });
    } catch {}

    revalidatePath(`/contracts/${id}`);

    return {
      ok: true,
      message:
        typeof nextVat === "number"
          ? `TVA actualizat la ${nextVat}%`
          : "TVA eliminat din contract",
    };
  } catch (e) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as any).message)
        : String(e);
    return { ok: false, message: msg };
  }
}
