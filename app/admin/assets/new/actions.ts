"use server";

import { AssetSchema, type ScanItem } from "@/lib/schemas/asset";
import { upsertAsset, getAssetById } from "@/lib/assets";
import { saveScanFile } from "@/lib/storage";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";

export type FormState = { ok: boolean; message?: string; values: Record<string, unknown>; redirectTo?: string };

export async function createAssetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = (formData.get("name") as string) || "";
  const address = (formData.get("address") as string) || "";
  const areaSqmStr = String(formData.get("areaSqm") ?? "");
  const ownerId = (formData.get("ownerId") as string) || "";
  const owner = (formData.get("owner") as string) || "";
  const areaSqm = areaSqmStr.trim() === "" ? undefined : Number(areaSqmStr);
  const scanUrlsRaw = (formData.getAll("scanUrls") as string[]).filter((url): url is string => Boolean(url));
  const scanTitlesRaw = (formData.getAll("scanTitles") as string[]).map((title) => title ?? "");
  const files = (formData.getAll("scanFiles") as File[]).filter((file) => file && file.size > 0);
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
    const scans: ScanItem[] = scanUrlsRaw.map((url, index) => ({
      url,
      title: scanTitlesRaw[index]?.trim() || undefined,
    }));
    // Upload files
    // Enforce total payload limit of 2MB across all uploaded files
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    if (totalSize > 2 * 1024 * 1024) {
      return { ok: false, message: "Dimensiunea totală a fișierelor depășește 2MB", values: { id, name, address, areaSqm, scanUrls: scanUrlsRaw } };
    }
    for (const file of files) {
      const okType = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ].includes(file.type);
      if (!okType) {
        return { ok: false, message: "Fișierele trebuie să fie PDF sau imagini", values: { id, name, address, areaSqm, scanUrls: scanUrlsRaw } };
      }
      if (file.size > 2 * 1024 * 1024) {
        return { ok: false, message: `Fișierul "${file.name}" depășește limita de 2MB`, values: { id, name, address, areaSqm, scanUrls: scanUrlsRaw } };
      }
      const saved = await saveScanFile(file, `${id}-${file.name.replace(/\.[^.]+$/, "")}`, {});
      scans.push({ url: saved.url, title: undefined });
    }
    const payload = { id, name, address, areaSqm, ownerId: ownerId || undefined, owner: owner || undefined, scans };
    const parsed = AssetSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((iss) => iss.message).join("; ");
      return { ok: false, message: msg, values: { id, name, address, ownerId, owner, areaSqm, scanUrls: scanUrlsRaw } };
    }
    if (!process.env.MONGODB_URI) {
      return { ok: false, message: "MongoDB nu este configurat.", values: { id, name, address, areaSqm, scanUrls: scanUrlsRaw } };
    }
    const nowIso = new Date().toISOString().slice(0, 10);
    await upsertAsset({ ...parsed.data, createdAt: nowIso, updatedAt: nowIso });
    await logAction({ action: "asset.create", targetType: "asset", targetId: id, meta: { name, address, scans } });
    try {
      await createMessage({ text: `Asset nou: ${name} • Adresă: ${address} • Scanuri: ${scans.length}` });
    } catch {}
    return { ok: true, values: {}, redirectTo: `/admin/assets/${id}` };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "A apărut o eroare la crearea asset-ului.";
    return { ok: false, message, values: { name, address, areaSqm, scanUrls: scanUrlsRaw } };
  }
}
