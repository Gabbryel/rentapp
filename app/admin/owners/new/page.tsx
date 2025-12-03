import { upsertOwner } from "@/lib/owners";
import { logAction } from "@/lib/audit";
import type { Owner } from "@/lib/schemas/owner";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createMessage } from "@/lib/messages";

async function saveOwner(formData: FormData) {
  "use server";
  const parseList = (value: unknown) =>
    String(value ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  const bankAccount = ((formData.get("bankAccount") as string) || "").trim();
  const o: Owner = {
    id: (formData.get("id") as string) || `o_${Date.now()}`,
    name: (formData.get("name") as string) || "",
    vatNumber: (formData.get("vatNumber") as string) || "",
    orcNumber: (formData.get("orcNumber") as string) || "",
    headquarters: (formData.get("headquarters") as string) || "",
    administrators: parseList(formData.get("administrators")),
    bankAccount,
    emails: parseList(formData.get("emails")),
    phoneNumbers: parseList(formData.get("phoneNumbers")),
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  await upsertOwner(o);
  try {
    await logAction({
      action: "owner.create",
      targetType: "owner",
      targetId: o.id,
      meta: { name: o.name },
    });
  } catch {}
  try {
    await createMessage({
      text: `Proprietar nou: ${o.name} • ID: ${o.id} • CUI: ${o.vatNumber}`,
    });
  } catch {}
  revalidatePath("/admin/owners");
  redirect("/admin/owners");
}

export default function NewOwnerPage() {
  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/owners"
          className="text-sm text-foreground/70 hover:underline"
        >
          ← Înapoi
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold">Adaugă proprietar</h1>
      <form action={saveOwner} className="mt-6 max-w-xl space-y-4">
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
        <div>
          <label className="block text-sm font-medium">Cont bancar</label>
          <input
            name="bankAccount"
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
            placeholder="ex: Maria Ionescu\nIon Popescu"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-foreground/60">
            Folosește câte o linie pentru fiecare administrator. Lasă gol dacă
            nu este cazul.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium">
            Email-uri contact (câte unul pe linie)
          </label>
          <textarea
            name="emails"
            rows={3}
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
            placeholder="ex: +40 721 000 000\n021 000 0000"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
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
