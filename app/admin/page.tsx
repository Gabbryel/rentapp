import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import { fetchPartners } from "@/lib/partners";
import { fetchContracts } from "@/lib/contracts";
import { listAssets } from "@/lib/assets";
import { fetchOwners } from "@/lib/owners";

export default async function AdminPage() {
  // Temporarily allow public access; we'll reintroduce restrictions later.
  const user = await currentUser();
  let usersCount = 0;
  let contractsCount = 0;
  let partnersCount = 0;
  let assetsCount = 0;
  let ownersCount = 0;
  try {
    usersCount = (await listUsers()).length;
  } catch {}
  try {
    contractsCount = (await fetchContracts()).length;
  } catch {}
  try {
    partnersCount = (await fetchPartners()).length;
  } catch {}
  try {
    assetsCount = (await listAssets()).length;
  } catch {}
  try {
    ownersCount = (await fetchOwners()).length;
  } catch {}

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold">Panou</h1>
      <p className="text-foreground/70 mt-1">Autentificat ca {user?.email}</p>

      <section className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Link
          href="/admin/contracts"
          className="rounded-lg border border-foreground/15 p-5 hover:border-foreground/30 transition-colors"
        >
          <div className="text-sm uppercase tracking-wide text-foreground/60">
            Secțiune
          </div>
          <div className="mt-1 text-xl font-semibold">Contracte</div>
          <p className="mt-1 text-foreground/70 text-sm">
            Gestionează contractele: adaugă, editează, șterge.
          </p>
          <div className="mt-3 text-xs text-foreground/60">
            {contractsCount > 0 ? `${contractsCount} contracte` : "—"}
          </div>
        </Link>

        <Link
          href="/admin/invoices"
          className="rounded-lg border border-foreground/15 p-5 hover:border-foreground/30 transition-colors"
        >
          <div className="text-sm uppercase tracking-wide text-foreground/60">
            Secțiune
          </div>
          <div className="mt-1 text-xl font-semibold">Facturi</div>
          <p className="mt-1 text-foreground/70 text-sm">
            Serii per proprietar.
          </p>
        </Link>

        <Link
          href="/admin/owners"
          className="rounded-lg border border-foreground/15 p-5 hover:border-foreground/30 transition-colors"
        >
          <div className="text-sm uppercase tracking-wide text-foreground/60">
            Secțiune
          </div>
          <div className="mt-1 text-xl font-semibold">Proprietari</div>
          <p className="mt-1 text-foreground/70 text-sm">
            Gestionează proprietarii: adaugă, editează, șterge.
          </p>
          <div className="mt-3 text-xs text-foreground/60">
            {ownersCount > 0 ? `${ownersCount} proprietari` : "—"}
          </div>
        </Link>

        <Link
          href="/admin/users"
          className="rounded-lg border border-foreground/15 p-5 hover:border-foreground/30 transition-colors"
        >
          <div className="text-sm uppercase tracking-wide text-foreground/60">
            Secțiune
          </div>
          <div className="mt-1 text-xl font-semibold">Utilizatori</div>
          <p className="mt-1 text-foreground/70 text-sm">
            Gestionează utilizatorii și rolurile. Vezi jurnalul de acțiuni.
          </p>
          <div className="mt-3 text-xs text-foreground/60">
            {usersCount > 0 ? `${usersCount} utilizatori` : "—"}
          </div>
        </Link>

        <Link
          href="/admin/partners"
          className="rounded-lg border border-foreground/15 p-5 hover:border-foreground/30 transition-colors"
        >
          <div className="text-sm uppercase tracking-wide text-foreground/60">
            Secțiune
          </div>
          <div className="mt-1 text-xl font-semibold">Parteneri</div>
          <p className="mt-1 text-foreground/70 text-sm">
            Gestionează partenerii: adaugă, editează, șterge.
          </p>
          <div className="mt-3 text-xs text-foreground/60">
            {partnersCount > 0 ? `${partnersCount} parteneri` : "—"}
          </div>
        </Link>

        <Link
          href="/admin/assets"
          className="rounded-lg border border-foreground/15 p-5 hover:border-foreground/30 transition-colors"
        >
          <div className="text-sm uppercase tracking-wide text-foreground/60">
            Secțiune
          </div>
          <div className="mt-1 text-xl font-semibold">Assets</div>
          <p className="mt-1 text-foreground/70 text-sm">
            Gestionează proprietățile și documentele asociate.
          </p>
          <div className="mt-3 text-xs text-foreground/60">
            {assetsCount > 0 ? `${assetsCount} assets` : "—"}
          </div>
        </Link>
      </section>
    </div>
  );
}
