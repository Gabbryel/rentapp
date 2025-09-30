import Link from "next/link";
import { fetchPartners } from "@/lib/partners";

export default async function AdminPartnersPage() {
  const partners = await fetchPartners();
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">Parteneri</h1>
        <Link
          href="/admin/partners/new"
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5"
        >
          Adaugă partener
        </Link>
      </div>
      <div className="mt-6 overflow-x-auto rounded-lg border border-foreground/15">
        <table className="min-w-full text-sm">
          <thead className="bg-foreground/5 text-foreground/60">
            <tr>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">Nume</th>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">CUI</th>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">Nr. ORC</th>
              <th className="text-left px-3 py-2 sm:px-4 sm:py-3">Sediu</th>
              <th className="text-right px-3 py-2 sm:px-4 sm:py-3">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id} className="border-t border-foreground/10">
                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                  <Link href={`/partners/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                  {p.vatNumber}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 whitespace-nowrap">
                  {p.orcNumber}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 min-w-[16rem]">
                  {p.headquarters}
                </td>
                <td className="px-3 py-2 sm:px-4 sm:py-3 text-right">
                  <Link
                    href={`/admin/partners/${p.id}`}
                    className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                  >
                    Editează
                  </Link>
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-foreground/60"
                >
                  Niciun partener.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
