import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { fetchContracts, effectiveEndDate, currentRentAmount } from "@/lib/contracts";
import { fetchOwners } from "@/lib/owners";
import type { Contract } from "@/lib/schemas/contract";
import Breadcrumb from "@/app/components/breadcrumb";
import { ContractsClient, type ContractRow } from "./contracts-client";

export const dynamic = "force-dynamic";

export default async function AdminContracts() {
  noStore();
  const [contracts, owners] = await Promise.all([fetchContracts(), fetchOwners()]);

  const todayISO = new Date().toISOString().slice(0, 10);

  const rows: ContractRow[] = contracts.map((c: Contract) => {
    const endDate = effectiveEndDate(c);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUntilExpiry = Math.round(
      (new Date(endDate).getTime() - new Date(todayISO).getTime()) / msPerDay
    );

    let status: ContractRow["status"];
    if (daysUntilExpiry < 0) {
      status = "expired";
    } else if (new Date(c.startDate) > new Date(todayISO)) {
      status = "upcoming";
    } else {
      status = "active";
    }

    const extensions = Array.isArray(c.contractExtensions) ? c.contractExtensions : [];
    const hasExtension = extensions.some((e) => e.extendedUntil);

    return {
      id: c.id,
      name: c.name,
      partner: c.partner || undefined,
      owner: c.owner || undefined,
      ownerId: c.ownerId || undefined,
      asset: c.asset || undefined,
      assetId: c.assetId || undefined,
      currentRent: currentRentAmount(c),
      startDate: c.startDate,
      endDate,
      daysUntilExpiry,
      status,
      rentType: c.rentType,
      hasExtension,
    };
  });

  // Sort: active first (soonest expiry), then upcoming, then expired (most recent first)
  rows.sort((a, b) => {
    const order = { active: 0, upcoming: 1, expired: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.status === "expired") return b.daysUntilExpiry - a.daysUntilExpiry;
    return a.daysUntilExpiry - b.daysUntilExpiry;
  });

  const ownerList = owners.map((o: any) => ({ id: o.id, name: o.name }));

  // Per-owner KPI
  type OwnerStats = {
    ownerId: string;
    ownerName: string;
    active: number;
    total: number;
    totalRentEur: number;
  };
  const ownerStatsMap = new Map<string, OwnerStats>();
  for (const r of rows) {
    const key = r.ownerId ?? "__none__";
    const name = r.owner ?? "Fără proprietar";
    if (!ownerStatsMap.has(key)) {
      ownerStatsMap.set(key, { ownerId: key, ownerName: name, active: 0, total: 0, totalRentEur: 0 });
    }
    const s = ownerStatsMap.get(key)!;
    s.total++;
    if (r.status === "active") {
      s.active++;
      if (r.currentRent !== undefined) s.totalRentEur += r.currentRent;
    }
  }
  const ownerStats = [...ownerStatsMap.values()].sort((a, b) => {
    if (a.ownerId === "__none__") return 1;
    if (b.ownerId === "__none__") return -1;
    return a.ownerName.localeCompare(b.ownerName, "ro");
  });

  const totalActive = rows.filter((r) => r.status === "active").length;
  const totalExpired = rows.filter((r) => r.status === "expired").length;
  const expiringSoon = rows.filter((r) => r.status === "active" && r.daysUntilExpiry <= 30).length;

  return (
    <div className="max-w-7xl pt-4">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Contracte" },
        ]}
      />

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
            Contracte
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            {contracts.length} contracte · {totalActive} active · {totalExpired} expirate
          </p>
        </div>
        <Link
          href="/contracts/new"
          className="rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background hover:bg-foreground/90 transition-colors"
        >
          + Contract nou
        </Link>
      </div>

      {/* Global KPI chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-background px-3 py-1 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-foreground/30" />
          {contracts.length} total
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {totalActive} active
        </span>
        {expiringSoon > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {expiringSoon} expiră în &lt;30 zile
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground/50">
          {totalExpired} expirate
        </span>
      </div>

      {/* Per-owner KPI */}
      {ownerStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {ownerStats.map((s) => (
            <div key={s.ownerId} className="rounded-xl border border-foreground/15 bg-background/60 p-5">
              <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-foreground/10">
                <span className="text-sm font-semibold truncate">{s.ownerName}</span>
                <span className="shrink-0 text-xs text-foreground/40 tabular-nums">
                  {s.total} {s.total === 1 ? "contract" : "contracte"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {s.active}
                  </div>
                  <div className="text-xs text-foreground/50 mt-0.5">Active</div>
                </div>
                {s.totalRentEur > 0 && (
                  <div>
                    <div className="text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                      {s.totalRentEur.toLocaleString("ro-RO")}
                    </div>
                    <div className="text-xs text-foreground/50 mt-0.5">EUR / lună</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Client: search + filter + grid */}
      <ContractsClient rows={rows} owners={ownerList} />
    </div>
  );
}
