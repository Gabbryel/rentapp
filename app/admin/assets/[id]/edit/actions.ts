"use server";

import { AssetSchema } from "@/lib/schemas/asset";
import { getAssetById, upsertAsset } from "@/lib/assets";
import { deleteScanByUrl, saveScanFile } from "@/lib/storage";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";

export type FormState = {
  ok: boolean;
  message?: string;
  values: Record<string, unknown>;
  redirectTo?: string;
};

export async function updateAssetAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = (formData.get("id") as string) || "";
  const name = (formData.get("name") as string) || "";
  const address = (formData.get("address") as string) || "";

  if (!process.env.MONGODB_URI) {
    return {
      ok: false,
      message: "MongoDB nu este configurat.",
      values: { id, name, address },
    };
  }

  const current = await getAssetById(id);
  if (!current) {
    return { ok: false, message: "Asset inexistent", values: { id, name, address } };
  }

  // Existing scans handling
  const existingUrls = (formData.getAll("existingUrl") as string[]) || [];
  const existingTitles = (formData.getAll("existingTitle") as string[]) || [];
  const removeIdxSet = new Set(
    ((formData.getAll("existingRemoveIdx") as string[]) || []).map((s) => String(s))
  );

  const keptScans: { url: string; title?: string }[] = [];
  const removedUrls: string[] = [];
  for (let i = 0; i < existingUrls.length; i++) {
    const url = existingUrls[i];
    const title = (existingTitles[i] || "").trim() || undefined;
    if (removeIdxSet.has(String(i))) {
      removedUrls.push(url);
    } else {
      keptScans.push({ url, title });
    }
  }

  // Delete removed scans from storage where possible (GridFS/local only)
  for (const u of removedUrls) {
    try {
      await deleteScanByUrl(u);
    } catch {}
  }

  // New uploads
  const files = (formData.getAll("scanFiles") as File[]).filter((f) => f && f.size > 0);
  // Enforce total payload limit of 2MB across all uploaded files
  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
  if (totalSize > 2 * 1024 * 1024) {
    return {
      ok: false,
      message: "Dimensiunea totală a fișierelor depășește 2MB",
      values: { id, name, address },
    };
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
      return {
        ok: false,
        message: "Fișierele trebuie să fie PDF sau imagini",
        values: { id, name, address },
      };
    }
    if (f.size > 2 * 1024 * 1024) {
      return {
        ok: false,
        message: `Fișierul \"${f.name}\" depășește limita de 2MB`,
        values: { id, name, address },
      };
    }
    const res = await saveScanFile(
      f,
      `${id}-${f.name.replace(/\.[^.]+$/, "")}`,
      {}
    );
    keptScans.push({ url: res.url });
  }

  // New URL scans + titles
  const scanUrlsRaw = (formData.getAll("scanUrls") as string[]).filter(Boolean);
  const scanTitlesRaw = (formData.getAll("scanTitles") as string[]).filter(() => true);
  for (let i = 0; i < scanUrlsRaw.length; i++) {
    const url = scanUrlsRaw[i];
    const title = (scanTitlesRaw[i] || "").trim() || undefined;
    if (url) keptScans.push({ url, title });
  }

  const payload = {
    id,
    name,
    address,
    scans: keptScans,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString().slice(0, 10),
  };

  const parsed = AssetSchema.safeParse(payload);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((iss) => iss.message).join("; ");
    return { ok: false, message: msg, values: { id, name, address } };
  }

  await upsertAsset(parsed.data);
  await logAction({
    action: "asset.update",
    targetType: "asset",
    targetId: id,
    meta: {
      name,
      address,
      scansBefore: current.scans?.length ?? 0,
      scansAfter: parsed.data.scans?.length ?? 0,
      removed: removedUrls.length,
      added: parsed.data.scans.length - (current.scans?.length ?? 0) + removedUrls.length,
    },
  });
  try {
    const before = current.scans?.length ?? 0;
    const after = parsed.data.scans?.length ?? 0;
    const removed = removedUrls.length;
    const added = after - before + removed;
    await createMessage({ text: `Asset actualizat: ${name} • Adresă: ${address} • Scanuri: ${before} → ${after} (adăugate ${added}, șterse ${removed})` });
  } catch {}

  return { ok: true, values: {}, redirectTo: `/admin/assets/${id}` };
}
