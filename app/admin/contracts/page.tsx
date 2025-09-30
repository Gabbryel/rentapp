import Link from "next/link";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { fetchContracts, deleteContractById } from "@/lib/contracts";
import { logAction } from "@/lib/audit";
import type { Contract } from "@/lib/schemas/contract";
import DeleteButton from "@/app/components/delete-button";

export default async function AdminContracts() {
  noStore();
  const contracts = await fetchContracts();

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("ro-RO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
        Administrare contracte
      </h1>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-foreground/60 text-sm">
            Listă cu toate contractele. Puteți adăuga, edita sau șterge.
          </p>
        </div>
        <Link
          href="/contracts/new"
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-1.5 text-xs sm:text-sm font-semibold text-background hover:bg-foreground/90"
        >
          Adaugă contract
        </Link>
      </div>

      {contracts.length === 0 ? (
        <div className="mt-6 rounded-xl border border-foreground/15 p-8 text-center text-foreground/60">
          Nu există contracte în baza de date.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-foreground/15 bg-background/60">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-foreground/5 text-foreground/60">
              <tr>
                <th className="px-4 py-3 font-medium">Nume</th>
                <th className="px-4 py-3 font-medium">Partener</th>
                <th className="px-4 py-3 font-medium">Proprietar</th>
                <th className="px-4 py-3 font-medium">Semnat</th>
                <th className="px-4 py-3 font-medium">Început</th>
                <th className="px-4 py-3 font-medium">Expiră</th>
                <th className="px-4 py-3 font-medium text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c: Contract) => (
                <tr key={c.id} className="border-t border-foreground/10">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/contracts/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.partner}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.owner ?? "Markov Services s.r.l."}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fmt(c.signedAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fmt(c.startDate)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fmt(c.endDate)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/contracts/${c.id}/edit`}
                        className="rounded border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                      >
                        Editează
                      </Link>
                      <DeleteButton
                        label="Șterge"
                        className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-600 hover:bg-red-500/15"
                        action={async () => {
                          "use server";
                          const deleted = await deleteContractById(c.id);
                          try {
                            await logAction({
                              action: "contract.delete",
                              targetType: "contract",
                              targetId: c.id,
                              meta: {
                                name: c.name,
                                partner: c.partner,
                                deleted,
                              },
                            });
                          } catch {}
                          revalidatePath("/admin/contracts");
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
