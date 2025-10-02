"use server";

import { getAssetById, deleteAssetById } from "@/lib/assets";
import { deleteScanByUrl } from "@/lib/storage";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";
import { getDb } from "@/lib/mongodb";

export type DeleteState = { ok: boolean; message?: string; redirectTo?: string };

export async function deleteAssetAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const id = (formData.get("id") as string) || "";
  if (!id) return { ok: false, message: "Asset ID lipsă" };

  if (!process.env.MONGODB_URI) {
    return { ok: false, message: "MongoDB nu este configurat." };
  }

  // Do not allow deletion if contracts reference this asset
  try {
    const db = await getDb();
    const cnt = await db.collection("contracts").countDocuments({ assetId: id });
    if (cnt > 0) {
      return { ok: false, message: `Nu poți șterge asset-ul: există ${cnt} contract(e) asociate.` };
    }
  } catch {}

  const asset = await getAssetById(id);
  if (!asset) return { ok: false, message: "Asset inexistent" };

  // Attempt to delete scans from storage (best effort)
  const scans = Array.isArray(asset.scans) ? asset.scans : [];
  for (const s of scans) {
    try {
      await deleteScanByUrl(s?.url);
    } catch {}
  }

  const deleted = await deleteAssetById(id);
  if (!deleted) return { ok: false, message: "Ștergerea a eșuat" };

  await logAction({
    action: "asset.delete",
    targetType: "asset",
    targetId: id,
    meta: { name: asset.name, address: asset.address, scansDeleted: scans.length },
  });
  try { await createMessage({ text: `Asset șters: ${asset.name} • Adresă: ${asset.address} • Scanuri șterse: ${scans.length}` }); } catch {}

  return { ok: true, redirectTo: "/admin/assets" };
}
