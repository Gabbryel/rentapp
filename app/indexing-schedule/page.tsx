import { Suspense } from "react";
import { fetchContracts, effectiveEndDate, currentRentAmount } from "@/lib/contracts";
import { listIndexingNotices } from "@/lib/audit";
import { fetchOwners } from "@/lib/owners";
import Link from "next/link";
import type { Contract } from "@/lib/schemas/contract";
import Breadcrumb from "@/app/components/breadcrumb";
import IndexingFilters from "@/app/components/indexing-filters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ro-RO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ro-RO", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(iso);
    target.setHours(0, 0, 0, 0);
    return Math.floor((target.getTime() - today.getTime()) / 86_400_000);
  } catch {
    return null;
  }
}

function getNextIndexingDate(contract: Contract): string | null {
  const todayISO = new Date().toISOString().slice(0, 10);
  return (
    (contract.indexingDates || [])
      .filter((d) => !d.done && d.forecastDate >= todayISO)
      .map((d) => d.forecastDate)
      .sort()[0] ?? null
  );
}

function getFutureIndexingDates(contract: Contract): string[] {
  const todayISO = new Date().toISOString().slice(0, 10);
  return (contract.indexingDates || [])
    .filter((d) => !d.done && d.forecastDate >= todayISO)
    .map((d) => d.forecastDate)
    .sort()
    .slice(0, 5);
}

type Urgency = "overdue" | "urgent" | "soon" | "ok" | "none";

function getUrgency(daysToIndexing: number | null): Urgency {
  if (daysToIndexing === null) return "none";
  if (daysToIndexing < 0) return "overdue";
  if (daysToIndexing < 20) return "urgent";
  if (daysToIndexing < 60) return "soon";
  return "ok";
}

const URGENCY_CONFIG: Record<
  Urgency,
  { label: string; border: string; badge: string; dot: string }
> = {
  overdue: {
    label: "Depășită",
    border: "border-l-red-500",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
  urgent: {
    label: "Urgent",
    border: "border-l-orange-500",
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  soon: {
    label: "În curând",
    border: "border-l-yellow-500",
    badge: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    dot: "bg-yellow-500",
  },
  ok: {
    label: "În termen",
    border: "border-l-green-500",
    badge: "bg-green-500/10 text-green-600 dark:text-green-400",
    dot: "bg-green-500",
  },
  none: {
    label: "Fără indexare",
    border: "border-l-foreground/20",
    badge: "bg-foreground/5 text-foreground/50",
    dot: "bg-foreground/20",
  },
};

type ContractRow = {
  contract: Contract;
  nextIndexing: string | null;
  futureDates: string[];
  endDate: string;
  daysToIndexing: number | null;
  daysToEnd: number | null;
  lastNoticeDate: string | null;
  urgency: Urgency;
  rentEUR: number | undefined;
};

const SECTION_ORDER: Urgency[] = ["overdue", "urgent", "soon", "ok", "none"];

const SECTION_LABELS: Record<Urgency, string> = {
  overdue: "Depășite",
  urgent: "Urgente — sub 20 zile",
  soon: "În curând — 20–60 zile",
  ok: "În termen — peste 60 zile",
  none: "Fără dată de indexare",
};

const SECTION_COLORS: Record<Urgency, string> = {
  overdue: "text-red-600 dark:text-red-400",
  urgent: "text-orange-500",
  soon: "text-yellow-600 dark:text-yellow-400",
  ok: "text-green-600 dark:text-green-400",
  none: "text-foreground/50",
};

export default async function IndexingSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const filterUrgency = sp.urgency || "all";
  const filterOwnerId = sp.ownerId || "";

  const [allContracts, owners] = await Promise.all([
    fetchContracts(),
    fetchOwners(),
  ]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const activeContracts = allContracts.filter(
    (c) => effectiveEndDate(c) >= todayISO
  );

  // Fetch last notice date per contract
  const noticesMap = new Map<string, string | null>();
  if (process.env.MONGODB_URI) {
    await Promise.all(
      activeContracts.map(async (c) => {
        const notices = await listIndexingNotices(c.id);
        let mostRecent: string | null = null;
        for (const notice of notices) {
          const history = (notice as any).sendHistory;
          if (Array.isArray(history)) {
            for (const h of history) {
              if (h.sentAt && (!mostRecent || h.sentAt > mostRecent)) {
                mostRecent = h.sentAt;
              }
            }
          }
        }
        noticesMap.set(c.id, mostRecent);
      })
    );
  }

  const allRows: ContractRow[] = activeContracts.map((c) => {
    const nextIndexing = getNextIndexingDate(c);
    const daysToIndexing = daysUntil(nextIndexing);
    return {
      contract: c,
      nextIndexing,
      futureDates: getFutureIndexingDates(c),
      endDate: effectiveEndDate(c),
      daysToIndexing,
      daysToEnd: daysUntil(effectiveEndDate(c)),
      lastNoticeDate: noticesMap.get(c.id) ?? null,
      urgency: getUrgency(daysToIndexing),
      rentEUR: currentRentAmount(c),
    };
  });

  // KPI counts (before filtering)
  const kpi: Record<Urgency, number> = {
    overdue: 0,
    urgent: 0,
    soon: 0,
    ok: 0,
    none: 0,
  };
  for (const r of allRows) kpi[r.urgency]++;

  // Apply filters
  let rows = allRows;
  if (filterOwnerId) {
    rows = rows.filter((r) => (r.contract as any).ownerId === filterOwnerId);
  }
  if (filterUrgency !== "all") {
    rows = rows.filter((r) => r.urgency === filterUrgency);
  }

  // Sort within each urgency: by absolute daysToIndexing asc, nulls last
  rows.sort((a, b) => {
    if (a.urgency !== b.urgency)
      return SECTION_ORDER.indexOf(a.urgency) - SECTION_ORDER.indexOf(b.urgency);
    if (a.daysToIndexing === null && b.daysToIndexing === null) return 0;
    if (a.daysToIndexing === null) return 1;
    if (b.daysToIndexing === null) return -1;
    return a.daysToIndexing - b.daysToIndexing;
  });

  // Group by urgency for section rendering
  const grouped = new Map<Urgency, ContractRow[]>();
  for (const u of SECTION_ORDER) grouped.set(u, []);
  for (const r of rows) grouped.get(r.urgency)!.push(r);

  const ownerList = owners.map((o: any) => ({ id: o.id, name: o.name }));

  return (
    <main className="min-h-screen bg-background px-4 sm:px-6 py-10 max-w-7xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Grafic indexări" },
        ]}
      />

      <header className="mb-6">
        <h1 className="text-fluid-3xl font-semibold tracking-tight text-foreground mb-1">
          Grafic indexări
        </h1>
        <p className="text-sm text-foreground/60">
          {activeContracts.length} contracte active · {todayISO.replace(/-/g, ".")}
        </p>
      </header>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {(
          [
            { key: "overdue", label: "Depășite", accent: "border-red-500 text-red-600 dark:text-red-400", bg: "bg-red-500/5" },
            { key: "urgent", label: "Urgente (<20z)", accent: "border-orange-500 text-orange-600 dark:text-orange-400", bg: "bg-orange-500/5" },
            { key: "soon", label: "În curând (<60z)", accent: "border-yellow-500 text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/5" },
            { key: "ok", label: "În termen", accent: "border-green-500 text-green-600 dark:text-green-400", bg: "bg-green-500/5" },
            { key: "none", label: "Fără indexare", accent: "border-foreground/30 text-foreground/50", bg: "bg-foreground/3" },
          ] as const
        ).map(({ key, label, accent, bg }) => (
          <div
            key={key}
            className={`rounded-xl border-l-4 border border-foreground/10 ${accent.split(" ")[0]} ${bg} px-4 py-3`}
          >
            <div className={`text-2xl font-bold tabular-nums ${accent.split(" ").slice(1).join(" ")}`}>
              {kpi[key as Urgency]}
            </div>
            <div className="text-xs text-foreground/60 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6">
        <Suspense fallback={null}>
          <IndexingFilters owners={ownerList} />
        </Suspense>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-foreground/10 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-foreground/60 font-medium">
            {filterUrgency !== "all" || filterOwnerId
              ? "Niciun contract nu corespunde filtrelor selectate."
              : "Nu există contracte active."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {SECTION_ORDER.map((urgency) => {
            const section = grouped.get(urgency)!;
            if (section.length === 0) return null;
            const cfg = URGENCY_CONFIG[urgency];
            const sectionColor = SECTION_COLORS[urgency];

            return (
              <div key={urgency}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <h2 className={`text-sm font-semibold uppercase tracking-wide ${sectionColor}`}>
                    {SECTION_LABELS[urgency]}
                  </h2>
                  <span className="text-xs text-foreground/40 font-medium">
                    {section.length} {section.length === 1 ? "contract" : "contracte"}
                  </span>
                </div>

                <div className="rounded-xl border border-foreground/10 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-foreground/5 border-b border-foreground/10">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground/50 w-[22%]">
                            Contract
                          </th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground/50 hidden sm:table-cell w-[16%]">
                            Partener
                          </th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-foreground/50 hidden md:table-cell w-[10%]">
                            Chirie EUR
                          </th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground/50 w-[22%]">
                            Următoarea indexare
                          </th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground/50 hidden lg:table-cell w-[18%]">
                            Date viitoare
                          </th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground/50 hidden md:table-cell w-[12%]">
                            Ultima notif.
                          </th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground/50 w-[12%]">
                            Expirare
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-foreground/8">
                        {section.map((row) => {
                          const dIdx = row.daysToIndexing;
                          const dEnd = row.daysToEnd;

                          const indexingLabel = (() => {
                            if (dIdx === null) return null;
                            if (dIdx < 0) return `depășită cu ${Math.abs(dIdx)}z`;
                            if (dIdx === 0) return "astăzi";
                            return `în ${dIdx} zile`;
                          })();

                          const endColor =
                            dEnd === null
                              ? "text-foreground/50"
                              : dEnd <= 30
                              ? "text-red-500"
                              : dEnd <= 90
                              ? "text-orange-500"
                              : "text-foreground/60";

                          return (
                            <tr
                              key={row.contract.id}
                              className={`hover:bg-foreground/[0.03] border-l-2 ${cfg.border}`}
                            >
                              {/* Contract name */}
                              <td className="px-4 py-3">
                                <Link
                                  href={`/contracts/${row.contract.id}`}
                                  className="text-sm font-medium hover:underline decoration-dotted underline-offset-2"
                                >
                                  {(row.contract as any).name || row.contract.id}
                                </Link>
                                {(row.contract as any).owner && (
                                  <div className="text-xs text-foreground/40 mt-0.5 truncate max-w-[18ch]">
                                    {(row.contract as any).owner}
                                  </div>
                                )}
                              </td>

                              {/* Partner */}
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <span className="text-sm text-foreground/80 truncate block max-w-[16ch]">
                                  {row.contract.partner || "—"}
                                </span>
                              </td>

                              {/* Rent EUR */}
                              <td className="px-4 py-3 text-right hidden md:table-cell">
                                {row.rentEUR != null ? (
                                  <span className="text-sm font-medium tabular-nums">
                                    {row.rentEUR.toLocaleString("ro-RO", {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-sm text-foreground/40">—</span>
                                )}
                              </td>

                              {/* Next indexing */}
                              <td className="px-4 py-3">
                                {row.nextIndexing ? (
                                  <>
                                    <div className="text-sm font-medium">
                                      {fmtDate(row.nextIndexing)}
                                    </div>
                                    {indexingLabel && (
                                      <div className={`text-xs mt-0.5 ${cfg.badge.includes("red") ? "text-red-500" : cfg.badge.includes("orange") ? "text-orange-500" : cfg.badge.includes("yellow") ? "text-yellow-600 dark:text-yellow-400" : "text-foreground/50"}`}>
                                        {indexingLabel}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-foreground/40">—</span>
                                )}
                              </td>

                              {/* Future dates mini-timeline */}
                              <td className="px-4 py-3 hidden lg:table-cell">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {row.futureDates.slice(1).length > 0 ? (
                                    row.futureDates.slice(1).map((d) => (
                                      <span
                                        key={d}
                                        className="inline-block rounded bg-foreground/8 px-1.5 py-0.5 text-[10px] text-foreground/60 tabular-nums"
                                        title={fmtDate(d)}
                                      >
                                        {fmtDateShort(d)}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-foreground/30">—</span>
                                  )}
                                </div>
                              </td>

                              {/* Last notice */}
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="text-sm text-foreground/60">
                                  {row.lastNoticeDate
                                    ? fmtDate(String(row.lastNoticeDate).slice(0, 10))
                                    : "—"}
                                </span>
                              </td>

                              {/* Expiry */}
                              <td className="px-4 py-3">
                                <div className="text-sm">{fmtDate(row.endDate)}</div>
                                {dEnd !== null && dEnd <= 90 && (
                                  <div className={`text-xs mt-0.5 ${endColor}`}>
                                    {dEnd <= 0 ? "expirat" : `${dEnd}z`}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-foreground/50 border-t border-foreground/10 pt-4">
        <span className="font-medium text-foreground/40 uppercase tracking-wide text-[10px]">Legendă:</span>
        {(["overdue", "urgent", "soon", "ok"] as const).map((u) => (
          <div key={u} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${URGENCY_CONFIG[u].dot}`} />
            <span>{URGENCY_CONFIG[u].label}</span>
          </div>
        ))}
        <span className="ml-auto text-[10px] text-foreground/30">
          Urgent &lt;20z · În curând &lt;60z
        </span>
      </div>
    </main>
  );
}
