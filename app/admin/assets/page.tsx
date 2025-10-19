import Link from "next/link";
import { listAssets } from "@/lib/assets";
import { fetchContractsByAssetId } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export default async function AdminAssetsPage() {
  const assets = await listAssets();
  // Sort assets alphabetically by name
  const assetsSorted = assets.slice().sort((a, b) => a.name.localeCompare(b.name));
  // For each asset, fetch associated contracts (counts and a primary item for meta)
  const assetsWithContracts = await Promise.all(
    assetsSorted.map(async (a) => {
      const cs = await fetchContractsByAssetId(a.id);
      return { asset: a, contracts: cs };
    })
  );
  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">Assets</h1>
          <Link
            href="/admin/assets/new"
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-semibold text-background hover:bg-foreground/90"
          >
            Adaugă
          </Link>
        </div>
        <div className="mt-6 divide-y divide-foreground/10 rounded-md border border-foreground/10">
          {assetsWithContracts.length === 0 ? (
            <p className="p-4 text-sm text-foreground/60">Niciun asset.</p>
          ) : (
            assetsWithContracts.map(({ asset: a, contracts }) => (
              <div
                key={a.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-foreground/5"
              >
                <Link href={`/admin/assets/${a.id}`} className="min-w-0 flex-1">
                  <div>
                    <div className="font-medium truncate">{a.name}</div>
                    <div className="text-xs text-foreground/60 truncate">{a.address}</div>
                    {(a as any).owner && (
                      <div className="text-xs text-foreground/60 mt-0.5 truncate">Proprietar: {(a as any).owner}</div>
                    )}
                  </div>
                </Link>
                <div className="text-xs text-foreground/60 flex items-center gap-4 pl-4">
                  <div>{a.scans.length} fișiere</div>
                  {typeof (a as any).areaSqm === "number" && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-foreground/15">
                      <span className="text-foreground/60">Suprafață</span>
                      <span className="font-medium">{(a as any).areaSqm} mp</span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-foreground/5">
                    <span className="font-medium">{contracts.length}</span>
                    <span className="text-foreground/60">contracte</span>
                  </div>
                  {(a as any).owner && (
                    <Link
                      href={`/owners/${encodeURIComponent((a as any).ownerId || (a as any).owner)}`}
                      className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-foreground/15 hover:bg-foreground/5"
                    >
                      <span className="text-foreground/60">Owner</span>
                      <span className="font-medium">{(a as any).owner}</span>
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
