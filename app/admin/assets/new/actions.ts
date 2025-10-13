"use server";

import { AssetSchema } from "@/lib/schemas/asset";
import { upsertAsset, getAssetById } from "@/lib/assets";
import { saveScanFile } from "@/lib/storage";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";

export type FormState = { ok: boolean; message?: string; values: Record<string, unknown>; redirectTo?: string };

export async function createAssetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = (formData.get("name") as string) || "";
  const address = (formData.get("address") as string) || "";
  const scanUrlsRaw = (formData.getAll("scanUrls") as string[]).filter(Boolean);
  const scanTitlesRaw = (formData.getAll("scanTitles") as string[]).filter(() => true);
  const files = (formData.getAll("scanFiles") as File[]).filter((f) => f && f.size > 0);
  try {
  // Compute slug id from name and ensure uniqueness
  const safeSlug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  let baseId = safeSlug(name);
  if (!baseId) baseId = `a-${Date.now()}`;
  let id = baseId;
  if (process.env.MONGODB_URI) {
    let counter = 1;
    while (counter < 100) {
      const exists = await getAssetById(id);
      if (!exists) break;
      counter++;
      id = `${baseId}-${counter}`;
    }
  }
  // Merge URLs and optional titles by index
  let scans: { url: string; title?: string }[] = scanUrlsRaw.map((u, i) => ({ url: u, title: (scanTitlesRaw[i] || "").trim() || undefined }));
    // Upload files
    // Enforce total payload limit of 2MB across all uploaded files
    const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
    if (totalSize > 2 * 1024 * 1024) {
      return { ok: false, message: "Dimensiunea totală a fișierelor depășește 2MB", values: { id, name, address, scanUrls: scanUrlsRaw } };
    }
    for (const f of files) {
      const okType = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ].includes(f.type);
      if (!okType) {
        return { ok: false, message: "Fișierele trebuie să fie PDF sau imagini", values: { id, name, address, scanUrls: scanUrlsRaw } };
      }
      if (f.size > 2 * 1024 * 1024) {
        return { ok: false, message: `Fișierul "${f.name}" depășește limita de 2MB`, values: { id, name, address, scanUrls: scanUrlsRaw } };
      }
      const res = await saveScanFile(f, `${id}-${f.name.replace(/\.[^.]+$/, "")}`, {});
      scans.push({ url: res.url, title: undefined });
    }
  const payload = { id, name, address, scans };
    const parsed = AssetSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((iss) => iss.message).join("; ");
  return { ok: false, message: msg, values: { id, name, address, scanUrls: scanUrlsRaw } };
    }
    if (!process.env.MONGODB_URI) {
      return { ok: false, message: "MongoDB nu este configurat.", values: { id, name, address, scanUrls: scanUrlsRaw } };
    }
    await upsertAsset({ ...parsed.data, createdAt: new Date().toISOString().slice(0,10), updatedAt: new Date().toISOString().slice(0,10) });
    await logAction({ action: "asset.create", targetType: "asset", targetId: id, meta: { name, address, scans } });
    try {
      await createMessage({ text: `Asset nou: ${name} • Adresă: ${address} • Scanuri: ${scans.length}` });
    } catch {}
    return { ok: true, values: {}, redirectTo: `/admin/assets/${id}` };
  } catch (e) {
    const msg = e && typeof e === "object" && (e as any).message ? String((e as any).message) : String(e);
    return { ok: false, message: msg, values: { name, address, scanUrls: scanUrlsRaw } };
  }
}
