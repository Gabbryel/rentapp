import {
  getInvoiceSettingsForOwner,
  saveInvoiceSettingsForOwner,
} from "@/lib/invoice-settings";
import { fetchOwners } from "@/lib/owners";
import { revalidatePath } from "next/cache";
import Flash from "@/app/components/flash";
import { redirect } from "next/navigation";

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const owners = await fetchOwners();
  const sp = await searchParams;
  const selectedId =
    (typeof sp.ownerId === "string"
      ? sp.ownerId
      : Array.isArray(sp.ownerId)
      ? sp.ownerId[0]
      : owners[0]?.id) ||
    owners[0]?.id ||
    "";
  const selectedOwner = owners.find((o) => o.id === selectedId) ?? owners[0];
  const settings = await getInvoiceSettingsForOwner(
    selectedOwner?.id,
    selectedOwner?.name
  );

  async function update(formData: FormData) {
    "use server";
    const ownerId = String(formData.get("ownerId") || "").trim();
    const allOwners = await fetchOwners();
    const ownerName = allOwners.find((o) => o.id === ownerId)?.name ?? "";
    const series = String(formData.get("series") || "").trim();
    const nextNumber = Number(formData.get("nextNumber") || 1);
    const padWidth = Number(formData.get("padWidth") || 5);
    const includeYear = Boolean(formData.get("includeYear"));
    await saveInvoiceSettingsForOwner(
      ownerId || undefined,
      ownerName || undefined,
      { series, nextNumber, padWidth, includeYear }
    );
    revalidatePath("/admin/invoices");
    redirect(`/admin/invoices?ownerId=${encodeURIComponent(ownerId)}&saved=1`);
  }

  return (
    <div>
      {((await searchParams).saved as string) === "1" ? (
        <Flash
          message={`Setările de facturare au fost salvate pentru proprietar: ${
            selectedOwner?.name || "—"
          }.`}
          tone="success"
          durationMs={5000}
        />
      ) : null}
      <h1 className="text-2xl sm:text-3xl font-bold">Setări facturi</h1>
      <p className="text-foreground/70 mt-1">
        Configurează seria și numerotarea facturilor.
      </p>

      <form method="get" className="mt-6 grid gap-3 max-w-xl">
        <label className="grid gap-1">
          <span className="text-sm text-foreground/70">Proprietar</span>
          <select
            name="ownerId"
            defaultValue={selectedOwner?.id ?? ""}
            className="rounded-md border border-foreground/20 bg-background px-3 py-2"
          >
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="w-fit rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5"
        >
          Schimbă proprietarul
        </button>
      </form>

      <form action={update} className="mt-6 grid gap-4 max-w-xl">
        <input type="hidden" name="ownerId" value={selectedOwner?.id ?? ""} />
        <label className="grid gap-1">
          <span className="text-sm text-foreground/70">Serie</span>
          <input
            name="series"
            defaultValue={settings.series}
            className="rounded-md border border-foreground/20 bg-background px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-3 gap-4">
          <label className="grid gap-1">
            <span className="text-sm text-foreground/70">Următorul număr</span>
            <input
              name="nextNumber"
              type="number"
              min={1}
              defaultValue={settings.nextNumber}
              className="rounded-md border border-foreground/20 bg-background px-3 py-2"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-foreground/70">
              Lățime (zero-pad)
            </span>
            <input
              name="padWidth"
              type="number"
              min={1}
              max={10}
              defaultValue={settings.padWidth}
              className="rounded-md border border-foreground/20 bg-background px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input
              name="includeYear"
              type="checkbox"
              defaultChecked={settings.includeYear}
            />
            <span className="text-sm">Include anul</span>
          </label>
        </div>
        <button
          type="submit"
          className="w-fit rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5"
        >
          Salvează
        </button>
      </form>
    </div>
  );
}
