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
    const parseList = (value: unknown) =>
      String(value ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    const administrators = parseList(formData.get("administrators"));
    const emails = parseList(formData.get("emails"));
    const phoneNumbers = parseList(formData.get("phoneNumbers"));
    const bankAccount = ((formData.get("bankAccount") as string) || "").trim();
    const owner: Owner = {
      id: current.id,
      name: (formData.get("name") as string) || current.name,
      vatNumber: (formData.get("vatNumber") as string) || current.vatNumber,
      orcNumber: (formData.get("orcNumber") as string) || current.orcNumber,
      headquarters:
        (formData.get("headquarters") as string) || current.headquarters,
      administrators,
      bankAccount: bankAccount || current.bankAccount || "",
      emails,
      phoneNumbers,
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
        <div>
          <label className="block text-sm font-medium">Cont bancar</label>
          <input
            name="bankAccount"
            defaultValue={o.bankAccount ?? ""}
            placeholder="RO12BANK0000000000000000"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">
            Administratori (câte unul pe linie)
          </label>
          <textarea
            name="administrators"
            rows={4}
            defaultValue={(o.administrators || []).join("\n")}
            placeholder="ex: Maria Ionescu\nIon Popescu"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-foreground/60">
            Lasă gol pentru a elimina administratorii existenți.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium">
            Email-uri contact (câte unul pe linie)
          </label>
          <textarea
            name="emails"
            rows={3}
            defaultValue={(o.emails || []).join("\n")}
            placeholder="ex: contact@example.com\nfinance@example.com"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">
            Telefoane contact (câte unul pe linie)
          </label>
          <textarea
            name="phoneNumbers"
            rows={3}
            defaultValue={(o.phoneNumbers || []).join("\n")}
            placeholder="ex: +40 721 000 000\n021 000 0000"
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
