"use server";

import { revalidatePath } from "next/cache";
import { fetchContractById, upsertContract } from "@/lib/contracts";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";
import { saveScanFile, deleteScanByUrl } from "@/lib/storage";
import { ContractSchema } from "@/lib/schemas/contract";

export type ScanActionState = { ok: boolean; message?: string };

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
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize)
        return { ok: false, message: "Fișierul este prea mare (max 2MB)" };
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

export async function updateScanTitleAction(_: ScanActionState, formData: FormData): Promise<ScanActionState> {
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

export async function deleteScanAction(_: ScanActionState, formData: FormData): Promise<ScanActionState> {
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
