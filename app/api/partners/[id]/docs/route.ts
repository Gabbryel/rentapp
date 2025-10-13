import { NextResponse } from "next/server";
import { addPartnerDoc, listPartnerDocs, deletePartnerDoc, updatePartnerDocTitle } from "@/lib/partner-docs";
import { currentUser } from "@/lib/auth";
import { isEnvAdmin } from "@/lib/auth";
import { saveScanFile } from "@/lib/storage";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

function extractPartnerIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    // Expecting [..., 'api', 'partners', '{id}', 'docs']
    const idx = parts.findIndex((p) => p === "partners");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const id = extractPartnerIdFromUrl(req.url);
  if (!id) return NextResponse.json({ error: "ID lipsă" }, { status: 400 });
  const docs = await listPartnerDocs(id);
  return NextResponse.json(docs);
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    const admin = Boolean(user?.isAdmin || isEnvAdmin(user?.email ?? null));
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = extractPartnerIdFromUrl(req.url);
    if (!id) return NextResponse.json({ error: "ID lipsă" }, { status: 400 });
    if (!process.env.MONGODB_URI) return NextResponse.json({ error: "MongoDB nu este configurat" }, { status: 500 });
    const form = await req.formData();
    const files = form.getAll("files");
    const titles = form.getAll("titles");
    // Aggregate size limit: 2MB across all uploaded files in this request
    const total = files.reduce((s, f) => (f instanceof File ? s + (f.size || 0) : s), 0);
    if (total > 2 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Dimensiunea totală a fișierelor depășește 2MB" }, { status: 400 });
    }
  const created: Array<{ id: string; title: string; url: string; sizeBytes?: number; contentType?: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!(f instanceof File) || f.size === 0) continue;
      // Enforce 2MB per file
      if (f.size > 2 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: `Fișierul "${(f as File).name || "document"}" depășește limita de 2MB` }, { status: 400 });
      }
      // Ensure non-empty title; fall back to file name or a default label
      const rawTitle = typeof titles[i] === "string" ? String(titles[i]).trim() : "";
      const title = rawTitle || (typeof (f as File).name === "string" && (f as File).name.trim()) || "Document";
  const baseName = `${id}-${title}`;
  const res = await saveScanFile(f, baseName, { partnerId: id });
  const docId = `pd_${Date.now()}_${i}`;
  const contentType = (f as File).type || undefined;
  const sizeBytes = (f as File).size || undefined;
  await addPartnerDoc({ id: docId, partnerId: id, title, url: res.url, contentType, sizeBytes, createdAt: new Date().toISOString().slice(0, 10) });
  created.push({ id: docId, title, url: res.url, sizeBytes, contentType });
    }
    // Audit upload(s)
    try {
      await logAction({
        action: "partnerDoc.create",
        targetType: "partner",
        targetId: id,
        meta: { count: created.length, docs: created },
      });
    } catch {}
    return NextResponse.json({ ok: true, created });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await currentUser();
    const admin = Boolean(user?.isAdmin || isEnvAdmin(user?.email ?? null));
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!process.env.MONGODB_URI) return NextResponse.json({ error: "MongoDB nu este configurat" }, { status: 500 });
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Parametrul 'id' este obligatoriu" }, { status: 400 });
    const ok = await deletePartnerDoc(id);
    try {
      await logAction({ action: "partnerDoc.delete", targetType: "partnerDoc", targetId: id, meta: { ok } });
    } catch {}
    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await currentUser();
    const admin = Boolean(user?.isAdmin || isEnvAdmin(user?.email ?? null));
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!process.env.MONGODB_URI) return NextResponse.json({ error: "MongoDB nu este configurat" }, { status: 500 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body.id !== "string" || typeof body.title !== "string" || body.title.trim() === "") {
      return NextResponse.json({ ok: false, error: "Câmpuri invalide (id, title)" }, { status: 400 });
    }
    const ok = await updatePartnerDocTitle(body.id, body.title.trim());
    try {
      await logAction({ action: "partnerDoc.update", targetType: "partnerDoc", targetId: body.id, meta: { title: body.title.trim(), ok } });
    } catch {}
    return NextResponse.json({ ok });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
