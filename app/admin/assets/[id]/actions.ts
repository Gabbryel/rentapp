"use server";

import { revalidatePath } from "next/cache";
import { getAssetById, upsertAsset } from "@/lib/assets";
import { saveScanFile, deleteScanByUrl } from "@/lib/storage";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";

export type AssetScanActionState = { ok: boolean; message?: string };

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

export async function addAssetScanAction(
  _: AssetScanActionState,
  formData: FormData
): Promise<AssetScanActionState> {
  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false, message: "ID asset lipsă" };
  const titleRaw = String(formData.get("scanTitle") || "");
  const title = titleRaw.trim() || undefined;
  const file = formData.get("scanFile");
  const urlRaw = String(formData.get("scanUrl") || "").trim();

  try {
    const prev = await getAssetById(id);
    if (!prev) return { ok: false, message: "Asset inexistent" };

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
        return {
          ok: false,
          message:
            "Fișierul trebuie să fie PDF sau imagine (png/jpg/jpeg/gif/webp/svg)",
        };
      }
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize)
        return { ok: false, message: "Fișierul este prea mare (max 5MB)" };
      const orig = file.name || "scan";
      const base = orig.replace(/\.[^.]+$/, "");
      const res = await saveScanFile(file, `${id}-${base}`, { assetId: id });
      url = res.url;
    } else if (urlRaw) {
      if (!isAcceptableScanUrl(urlRaw))
        return { ok: false, message: "URL invalid sau format neacceptat" };
      url = urlRaw;
    } else {
      return {
        ok: false,
        message: "Selectează un fișier sau completează URL-ul",
      };
    }

    const scans = Array.isArray((prev as any).scans)
      ? ([...(prev as any).scans] as { url: string; title: string | undefined }[])
      : [];
    scans.push({ url: url!, title: title ?? undefined });

    const next = { ...prev, scans };
    await upsertAsset(next);

    try {
      await logAction({
        action: "asset.scan.add",
        targetType: "asset",
        targetId: id,
        meta: { url, title },
      });
    } catch {}

    try {
      const what =
        file && file instanceof File && file.size > 0
          ? `fișier uploadat`
          : `URL`;
      await createMessage({
        text: `Asset: ${prev.name} • Scan adăugat (${what}) • URL: ${url}${
          title ? ` • Titlu: ${title}` : ""
        } • Total scanuri: ${scans.length}`,
      });
    } catch {}

    revalidatePath(`/admin/assets/${id}`);
    return { ok: true };
  } catch (e) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as any).message)
        : String(e);
    return { ok: false, message: msg };
  }
}

export async function editAssetScanAction(
  formData: FormData
): Promise<AssetScanActionState> {
  const id = String(formData.get("id") || "").trim();
  const index = Number(String(formData.get("index") || ""));
  const titleRaw = String(formData.get("scanTitle") || "");
  const title = titleRaw.trim() || undefined;

  if (!id) return { ok: false, message: "ID asset lipsă" };
  if (!Number.isInteger(index) || index < 0)
    return { ok: false, message: "Index invalid" };

  try {
    const prev = await getAssetById(id);
    if (!prev) return { ok: false, message: "Asset inexistent" };

    const scans = Array.isArray((prev as any).scans)
      ? ([...(prev as any).scans] as { url: string; title: string | undefined }[])
      : [];
    if (index >= scans.length)
      return { ok: false, message: "Index în afara limitelor" };

    const before = scans[index]?.title;
    scans[index] = { ...scans[index], title: title ?? undefined };

    const next = { ...prev, scans };
    await upsertAsset(next);

    try {
      await logAction({
        action: "asset.scan.edit",
        targetType: "asset",
        targetId: id,
        meta: { index, before, after: title },
      });
    } catch {}

    try {
      await createMessage({
        text: `Asset: ${prev.name} • Titlu scan #${index + 1} actualizat: ${
          before ? `"${before}" → ` : ""
        }${title ? `"${title}"` : "(fără titlu)"}`,
      });
    } catch {}

    revalidatePath(`/admin/assets/${id}`);
    return { ok: true };
  } catch (e) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as any).message)
        : String(e);
    return { ok: false, message: msg };
  }
}

export async function deleteAssetScanAction(
  formData: FormData
): Promise<AssetScanActionState> {
  const id = String(formData.get("id") || "").trim();
  const index = Number(String(formData.get("index") || ""));

  if (!id) return { ok: false, message: "ID asset lipsă" };
  if (!Number.isInteger(index) || index < 0)
    return { ok: false, message: "Index invalid" };

  try {
    const prev = await getAssetById(id);
    if (!prev) return { ok: false, message: "Asset inexistent" };

    const scans = Array.isArray((prev as any).scans)
      ? ([...(prev as any).scans] as { url: string; title: string | undefined }[])
      : [];
    if (index >= scans.length)
      return { ok: false, message: "Index în afara limitelor" };

    const removed = scans.splice(index, 1)[0];

    const next = { ...prev, scans };
    await upsertAsset(next);

    try {
      await logAction({
        action: "asset.scan.delete",
        targetType: "asset",
        targetId: id,
        meta: { removedUrl: removed?.url },
      });
    } catch {}

    try {
      await createMessage({
        text: `Asset: ${prev.name} • Scan șters • URL: ${removed?.url}${
          removed?.title ? ` • Titlu: ${removed.title}` : ""
        } • Total scanuri: ${scans.length}`,
      });
    } catch {}

    try {
      await deleteScanByUrl(removed?.url);
    } catch {}

    revalidatePath(`/admin/assets/${id}`);
    return { ok: true };
  } catch (e) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as any).message)
        : String(e);
    return { ok: false, message: msg };
  }
}
