import {
  fetchPartnerById,
  upsertPartner,
  deletePartnerById,
} from "@/lib/partners";
import { listPartnerDocs } from "@/lib/partner-docs";
import DocsUploader from "@/app/components/docs-uploader";
import DocsList from "@/app/components/docs-list";
import DocScan from "@/app/components/doc-scan";
import type { Partner } from "@/lib/schemas/partner";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";
import RepresentativesField from "@/app/components/representatives-field";

export default async function EditPartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await fetchPartnerById(id);
  if (!p) return notFound();
  const docs = await listPartnerDocs(p.id);

  async function savePartner(formData: FormData) {
    "use server";
    const EMAIL_RE =
      /^(?!\.)((?!.*\.\.)[A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
    const current = await fetchPartnerById(id);
    if (!current) return redirect("/admin/partners");
    const partner: Partner = {
      id: current.id,
      name: (formData.get("name") as string) || current.name,
      vatNumber: (formData.get("vatNumber") as string) || current.vatNumber,
      orcNumber: (formData.get("orcNumber") as string) || current.orcNumber,
      headquarters:
        (formData.get("headquarters") as string) || current.headquarters,
      isVatPayer: formData.get("isVatPayer") === "on",
      representatives: (() => {
        try {
          const raw = String(formData.get("representatives") || "[]");
          const arr = JSON.parse(raw) as Array<{
            fullname?: string | null;
            phone?: string | null;
            email?: string | null;
            primary?: boolean | null;
          }>;
          if (!Array.isArray(arr)) return current.representatives ?? [];
          const sanitized = arr
            .map((r) => ({
              fullname: r.fullname?.toString().trim() || null,
              phone: r.phone?.toString().trim() || null,
              email: (() => {
                const e = r.email?.toString().trim() || "";
                return e && EMAIL_RE.test(e) ? e : null;
              })(),
              primary: !!r.primary,
            }))
            .filter((r) => r.fullname || r.phone || r.email);
          let seen = false;
          return sanitized.map((r) => {
            if (r.primary && !seen) {
              seen = true;
              return r;
            }
            return { ...r, primary: false };
          });
        } catch {
          return current.representatives ?? [];
        }
      })(),
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    await upsertPartner(partner);
    try {
      const fields: Array<keyof Partner> = [
        "name",
        "vatNumber",
        "orcNumber",
        "headquarters",
        "isVatPayer",
        "representatives",
      ];
      const changes = fields
        .map((field) => ({
          field: String(field),
          from: current[field],
          to: partner[field],
        }))
        .filter((c) => c.from !== c.to);
      await logAction({
        action: "partner.update",
        targetType: "partner",
        targetId: partner.id,
        meta: { name: partner.name, changes },
      });
    } catch {}
    try {
      const fmt = (v: unknown) =>
        v === null || typeof v === "undefined" ? "—" : String(v);
      const fields: Array<{ key: keyof Partner; label: string }> = [
        { key: "name", label: "Nume" },
        { key: "vatNumber", label: "CUI" },
        { key: "orcNumber", label: "Nr. ORC" },
        { key: "headquarters", label: "Sediu" },
        { key: "isVatPayer", label: "Plătitor de TVA" },
      ];
      const diffs = fields
        .map(({ key, label }) => ({
          label,
          from: current[key],
          to: partner[key],
        }))
        .filter((c) => c.from !== c.to)
        .map((c) => `${c.label}: ${fmt(c.from)} → ${fmt(c.to)}`)
        .join("; ");
      const diffText = diffs ? ` • Modificări: ${diffs}` : "";
      await createMessage({
        text: `Partener actualizat: ${partner.name} • ID: ${partner.id}${diffText}`,
      });
    } catch {}
    revalidatePath("/admin/partners");
    redirect("/admin/partners");
  }

  async function removePartner() {
    "use server";
    const current = await fetchPartnerById(id);
    if (current) {
      const deleted = await deletePartnerById(current.id);
      try {
        await logAction({
          action: "partner.delete",
          targetType: "partner",
          targetId: current.id,
          meta: { name: current.name, deleted },
        });
      } catch {}
      try {
        await createMessage({
          text: `Partener șters: ${current.name} • ID: ${current.id}`,
        });
      } catch {}
    }
    revalidatePath("/admin/partners");
    redirect("/admin/partners");
  }

  return (
    <div className="max-w-screen-xl">
      <div className="mb-4">
        <Link
          href="/admin/partners"
          className="text-sm text-foreground/70 hover:underline"
        >
          ← Înapoi
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold">Editează partener</h1>
      <form action={savePartner} className="mt-6 max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-medium">ID</label>
          <input
            disabled
            defaultValue={p.id}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Nume</label>
          <input
            name="name"
            defaultValue={p.name}
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">CUI</label>
            <input
              name="vatNumber"
              defaultValue={p.vatNumber}
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Nr. ORC</label>
            <input
              name="orcNumber"
              defaultValue={p.orcNumber}
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Sediu</label>
          <input
            name="headquarters"
            defaultValue={p.headquarters}
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        {/* Phone/Email removed; contact details managed via Representatives */}
        <div>
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="isVatPayer"
              defaultChecked={p.isVatPayer === true}
              className="rounded border-foreground/20"
            />
            Plătitor de TVA
          </label>
        </div>
        <RepresentativesField initial={p.representatives} />
        <div className="pt-2 flex items-center gap-3">
          <button className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90">
            Salvează
          </button>
        </div>
      </form>

      {/* Ștergere partener */}
      <div className="mt-4">
        <form action={removePartner}>
          <button
            type="submit"
            className="rounded-md border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/10"
          >
            Șterge
          </button>
        </form>
      </div>

      {/* Documente partener */}
      <section className="mt-10">
        <div className="rounded-lg border border-foreground/15 p-4">
          <h2 className="text-base font-semibold">Documente</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <DocsUploader partnerId={p.id} />
              <DocsList partnerId={p.id} docs={docs} />
            </div>
            <div>
              <DocScan partnerId={p.id} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
