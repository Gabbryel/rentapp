import { fetchOwnerById, upsertOwner, deleteOwnerById } from "@/lib/owners";
import type { Owner } from "@/lib/schemas/owner";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { logAction } from "@/lib/audit";
import { createMessage } from "@/lib/messages";

export default async function EditOwnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const o = await fetchOwnerById(id);
  if (!o) return notFound();

  async function saveOwner(formData: FormData) {
    "use server";
    const current = await fetchOwnerById(id);
    if (!current) return redirect("/admin/owners");
    const owner: Owner = {
      id: current.id,
      name: (formData.get("name") as string) || current.name,
      vatNumber: (formData.get("vatNumber") as string) || current.vatNumber,
      orcNumber: (formData.get("orcNumber") as string) || current.orcNumber,
      headquarters:
        (formData.get("headquarters") as string) || current.headquarters,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    await upsertOwner(owner);
    try {
      await logAction({
        action: "owner.update",
        targetType: "owner",
        targetId: owner.id,
        meta: { name: owner.name },
      });
    } catch {}
    try {
      await createMessage({
        text: `Proprietar actualizat: ${owner.name} • ID: ${owner.id} • CUI: ${owner.vatNumber}`,
      });
    } catch {}
    revalidatePath("/admin/owners");
    redirect("/admin/owners");
  }

  async function removeOwner() {
    "use server";
    const current = await fetchOwnerById(id);
    if (current) {
      const deleted = await deleteOwnerById(current.id);
      try {
        await logAction({
          action: "owner.delete",
          targetType: "owner",
          targetId: current.id,
          meta: { name: current.name, deleted },
        });
      } catch {}
      try {
        await createMessage({
          text: `Proprietar șters: ${current.name} • ID: ${current.id}`,
        });
      } catch {}
    }
    revalidatePath("/admin/owners");
    redirect("/admin/owners");
  }

  return (
    <div className="max-w-screen-xl">
      <div className="mb-4">
        <Link
          href="/admin/owners"
          className="text-sm text-foreground/70 hover:underline"
        >
          ← Înapoi
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold">Editează proprietar</h1>
      <form action={saveOwner} className="mt-6 max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-medium">ID</label>
          <input
            disabled
            defaultValue={o.id}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Nume</label>
          <input
            name="name"
            defaultValue={o.name}
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">CUI</label>
            <input
              name="vatNumber"
              defaultValue={o.vatNumber}
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Nr. ORC</label>
            <input
              name="orcNumber"
              defaultValue={o.orcNumber}
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Sediu</label>
          <input
            name="headquarters"
            defaultValue={o.headquarters}
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="pt-2 flex items-center gap-3">
          <button className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90">
            Salvează
          </button>
        </div>
      </form>

      {/* Ștergere proprietar */}
      <div className="mt-4">
        <form action={removeOwner}>
          <button
            type="submit"
            className="rounded-md border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/10"
          >
            Șterge
          </button>
        </form>
      </div>
    </div>
  );
}
