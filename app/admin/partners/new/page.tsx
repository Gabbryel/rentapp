import { upsertPartner } from "@/lib/partners";
import { logAction } from "@/lib/audit";
import type { Partner } from "@/lib/schemas/partner";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createMessage } from "@/lib/messages";
import RepresentativesField from "@/app/components/representatives-field";

async function savePartner(formData: FormData) {
  "use server";
  const EMAIL_RE =
    /^(?!\.)((?!.*\.\.)[A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
  const p: Partner = {
    id: (formData.get("id") as string) || `p_${Date.now()}`,
    name: (formData.get("name") as string) || "",
    vatNumber: (formData.get("vatNumber") as string) || "",
    orcNumber: (formData.get("orcNumber") as string) || "",
    headquarters: (formData.get("headquarters") as string) || "",
    // Contact info now handled exclusively via representatives
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
        if (!Array.isArray(arr)) return [];
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
        // enforce at most one primary (keep first true)
        let seen = false;
        return sanitized.map((r) => {
          if (r.primary && !seen) {
            seen = true;
            return r;
          }
          return { ...r, primary: false };
        });
      } catch {
        return [];
      }
    })(),
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  await upsertPartner(p);
  try {
    await logAction({
      action: "partner.create",
      targetType: "partner",
      targetId: p.id,
      meta: { name: p.name },
    });
  } catch {}
  try {
    await createMessage({
      text: `Partener nou: ${p.name} • ID: ${p.id} • CUI: ${p.vatNumber}`,
    });
  } catch {}
  revalidatePath("/admin/partners");
  redirect("/admin/partners");
}

export default function NewPartnerPage() {
  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/partners"
          className="text-sm text-foreground/70 hover:underline"
        >
          ← Înapoi
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold">Adaugă partener</h1>
      <form action={savePartner} className="mt-6 max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium">ID (opțional)</label>
          <input
            name="id"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Nume</label>
          <input
            name="name"
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">CUI</label>
            <input
              name="vatNumber"
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Nr. ORC</label>
            <input
              name="orcNumber"
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Sediu</label>
          <input
            name="headquarters"
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        {/* Phone/Email removed; use Representatives field below */}
        <div>
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="isVatPayer"
              className="rounded border-foreground/20"
            />
            Plătitor de TVA
          </label>
        </div>
        <RepresentativesField />
        <div className="pt-2">
          <button className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90">
            Salvează
          </button>
        </div>
      </form>
    </div>
  );
}
