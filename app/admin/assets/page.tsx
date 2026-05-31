import Link from "next/link";
import { listAssets } from "@/lib/assets";
import { fetchContractsByAssetId, effectiveEndDate } from "@/lib/contracts";
import { fetchOwners } from "@/lib/owners";
import type { Asset } from "@/lib/schemas/asset";
import Breadcrumb from "@/app/components/breadcrumb";
import { AssetsClient } from "./assets-client";
import type { AssetRow } from "./assets-client";

export const dynamic = "force-dynamic";

export default async function AdminAssetsPage() {
  const [assets, owners] = await Promise.all([listAssets(), fetchOwners()]);

  const todayISO = new Date().toISOString().slice(0, 10);

  // Enrich each asset with contract data in parallel
  const rows: AssetRow[] = await Promise.all(
    assets
      .slice()
      .sort((a: Asset, b: Asset) => a.name.localeCompare(b.name, "ro"))
      .map(async (asset: Asset) => {
        const contracts = await fetchContractsByAssetId(asset.id);
        const active = contracts.filter(
          (c) => effectiveEndDate(c) >= todayISO
        );
        return {
          id: asset.id,
          name: asset.name,
          address: asset.address,
          owner: asset.owner,
          ownerId: asset.ownerId,
          areaSqm: asset.areaSqm,
          fileCount: asset.scans.length,
          totalContracts: contracts.length,
          activeContracts: active.length,
          activeTenants: active.map((c) => c.partner).filter(Boolean) as string[],
        };
      })
  );

  const ownerList = owners.map((o: any) => ({ id: o.id, name: o.name }));

  // Per-owner KPI breakdown
  type OwnerStats = {
    ownerId: string;
    ownerName: string;
    assets: number;
    assetsWithActive: number;
    activeContracts: number;
    totalContracts: number;
    totalSqm: number;
    totalFiles: number;
  };

  const ownerStatsMap = new Map<string, OwnerStats>();

  for (const r of rows) {
    const key = r.ownerId ?? "__none__";
    const name = r.owner ?? "Fără proprietar";
    if (!ownerStatsMap.has(key)) {
      ownerStatsMap.set(key, {
        ownerId: key,
        ownerName: name,
        assets: 0,
        assetsWithActive: 0,
        activeContracts: 0,
        totalContracts: 0,
        totalSqm: 0,
        totalFiles: 0,
      });
    }
    const s = ownerStatsMap.get(key)!;
    s.assets++;
    if (r.activeContracts > 0) s.assetsWithActive++;
    s.activeContracts += r.activeContracts;
    s.totalContracts += r.totalContracts;
    if (typeof r.areaSqm === "number") s.totalSqm += r.areaSqm;
    s.totalFiles += r.fileCount;
  }

  // Sort: named owners first (by name), unnamed last
  const ownerStats = [...ownerStatsMap.values()].sort((a, b) => {
    if (a.ownerId === "__none__") return 1;
    if (b.ownerId === "__none__") return -1;
    return a.ownerName.localeCompare(b.ownerName, "ro");
  });

  return (
    <div className="max-w-7xl pt-4">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Assets" },
        ]}
      />

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
            Assets
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Imobile și spații administrate
          </p>
        </div>
        <Link
          href="/admin/assets/new"
          className="rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background hover:bg-foreground/90 transition-colors"
        >
          + Asset nou
        </Link>
      </div>

      {/* Per-owner KPI summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {ownerStats.map((s) => (
          <div
            key={s.ownerId}
            className="rounded-xl border border-foreground/15 bg-background/60 p-5"
          >
            {/* Owner name */}
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-foreground/10">
              <span className="text-sm font-semibold truncate">{s.ownerName}</span>
              <span className="shrink-0 text-xs text-foreground/40 tabular-nums">
                {s.assets} {s.assets === 1 ? "asset" : "assets"}
              </span>
            </div>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {s.assetsWithActive}
                </div>
                <div className="text-xs text-foreground/50 mt-0.5">Cu contract activ</div>
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {s.activeContracts}
                </div>
                <div className="text-xs text-foreground/50 mt-0.5">Contracte active</div>
              </div>
              {s.totalSqm > 0 && (
                <div>
                  <div className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {s.totalSqm.toLocaleString("ro-RO")}
                  </div>
                  <div className="text-xs text-foreground/50 mt-0.5">mp suprafață</div>
                </div>
              )}
              {s.totalFiles > 0 && (
                <div>
                  <div className="text-xl font-bold tabular-nums text-foreground/60">
                    {s.totalFiles}
                  </div>
                  <div className="text-xs text-foreground/50 mt-0.5">Fișiere</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Client: search + filter + grid */}
      <AssetsClient rows={rows} owners={ownerList} />
    </div>
  );
}
