import { upsertPartner } from "@/lib/partners";
import { logAction } from "@/lib/audit";
import type { Partner } from "@/lib/schemas/partner";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createMessage } from "@/lib/messages";

async function savePartner(formData: FormData) {
  "use server";
  const p: Partner = {
    id: (formData.get("id") as string) || `p_${Date.now()}`,
    name: (formData.get("name") as string) || "",
    vatNumber: (formData.get("vatNumber") as string) || "",
    orcNumber: (formData.get("orcNumber") as string) || "",
    headquarters: (formData.get("headquarters") as string) || "",
    phone: ((formData.get("phone") as string) || "").trim() || undefined,
    email: ((formData.get("email") as string) || "").trim() || undefined,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Telefon</label>
            <input
              name="phone"
              placeholder="ex: +40 712 345 678"
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              name="email"
              type="email"
              placeholder="ex: contact@exemplu.ro"
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="pt-2">
          <button className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90">
            Salvează
          </button>
        </div>
      </form>
    </div>
  );
}
