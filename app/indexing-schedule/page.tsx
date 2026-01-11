import { fetchContracts, effectiveEndDate } from "@/lib/contracts";
import { listIndexingNotices } from "@/lib/audit";
import Link from "next/link";
import type { Contract } from "@/lib/schemas/contract";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("ro-RO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return isoDate;
  }
}

function getNextIndexingDate(contract: Contract): string | null {
  const dates = ((contract as any).indexingDates || []) as Array<{
    forecastDate: string;
    done?: boolean;
  }>;
  const todayISO = new Date().toISOString().slice(0, 10);
  const nextDate = dates
    .filter((d) => !d.done && d.forecastDate >= todayISO)
    .map((d) => d.forecastDate)
    .sort()[0];
  return nextDate || null;
}

function getDaysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(isoDate);
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export default async function IndexingSchedulePage() {
  const allContracts = await fetchContracts();

  // Filter active contracts (not ended)
  const todayISO = new Date().toISOString().slice(0, 10);
  const activeContracts = allContracts.filter((c) => {
    const endDate = effectiveEndDate(c);
    return endDate >= todayISO;
  });

  // Fetch indexing notices for all active contracts
  const noticesMap = new Map<string, string | null>();
  if (process.env.MONGODB_URI) {
    await Promise.all(
      activeContracts.map(async (c) => {
        const notices = await listIndexingNotices(c.id);
        if (notices.length > 0) {
          // Get the most recent notice date
          const latestNotice = notices.sort((a, b) =>
            String(b.at || "").localeCompare(String(a.at || ""))
          )[0];
          noticesMap.set(
            c.id,
            latestNotice.at ? String(latestNotice.at) : null
          );
        } else {
          noticesMap.set(c.id, null);
        }
      })
    );
  }

  // Prepare data with next indexing date
  type ContractRow = {
    contract: Contract;
    nextIndexing: string | null;
    endDate: string;
    daysToIndexing: number | null;
    daysToEnd: number | null;
    lastNoticeDate: string | null;
  };

  const rows: ContractRow[] = activeContracts
    .map((c) => ({
      contract: c,
      nextIndexing: getNextIndexingDate(c),
      endDate: effectiveEndDate(c),
      daysToIndexing: getDaysUntil(getNextIndexingDate(c)),
      daysToEnd: getDaysUntil(effectiveEndDate(c)),
      lastNoticeDate: noticesMap.get(c.id) || null,
    }))
    .sort((a, b) => {
      // Sort by next indexing date (earliest first), null values at the end
      if (!a.nextIndexing && !b.nextIndexing) return 0;
      if (!a.nextIndexing) return 1;
      if (!b.nextIndexing) return -1;
      return a.nextIndexing.localeCompare(b.nextIndexing);
    });

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm text-foreground/70 hover:underline">
          ← Înapoi la listă
        </Link>
      </div>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Grafic indexări
        </h1>
        <p className="text-sm text-foreground/70">
          Contracte active cu date de indexare și expirare
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-foreground/15 p-8 text-center text-foreground/60">
          Nu există contracte active.
        </div>
      ) : (
        <div className="rounded-lg border border-foreground/15 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-foreground/5 border-b border-foreground/15">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Contract
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Partener
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Următoarea indexare
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Ultima notificare
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Expirare contract
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {rows.map((row) => {
                  const daysIdx = row.daysToIndexing;
                  const daysEnd = row.daysToEnd;

                  const indexingStatus = (() => {
                    if (daysIdx === null)
                      return {
                        text: "Nicio indexare",
                        color: "text-foreground/40",
                      };
                    if (daysIdx < 0)
                      return {
                        text: `Depășită cu ${Math.abs(daysIdx)} zile`,
                        color: "text-red-500",
                      };
                    if (daysIdx === 0)
                      return {
                        text: "Astăzi",
                        color: "text-orange-500 font-semibold",
                      };
                    if (daysIdx < 20)
                      return {
                        text: `În ${daysIdx} zile`,
                        color: "text-red-500 font-semibold",
                      };
                    if (daysIdx < 60)
                      return {
                        text: `În ${daysIdx} zile`,
                        color: "text-yellow-500",
                      };
                    return {
                      text: `În ${daysIdx} zile`,
                      color: "text-foreground/60",
                    };
                  })();

                  const endStatus = (() => {
                    if (daysEnd === null)
                      return { text: "—", color: "text-foreground/40" };
                    if (daysEnd < 0)
                      return { text: "Expirat", color: "text-red-500" };
                    if (daysEnd === 0)
                      return {
                        text: "Expiră astăzi",
                        color: "text-red-500 font-semibold",
                      };
                    if (daysEnd <= 30)
                      return {
                        text: `${daysEnd} zile`,
                        color: "text-orange-500",
                      };
                    if (daysEnd <= 90)
                      return {
                        text: `${daysEnd} zile`,
                        color: "text-yellow-500",
                      };
                    return {
                      text: `${daysEnd} zile`,
                      color: "text-foreground/60",
                    };
                  })();

                  return (
                    <tr key={row.contract.id} className="hover:bg-foreground/5">
                      <td className="px-4 py-3">
                        <Link
                          href={`/contracts/${row.contract.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {(row.contract as any).name || row.contract.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground/80">
                        {row.contract.partner || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {formatDate(row.nextIndexing)}
                        </div>
                        {row.nextIndexing && (
                          <div
                            className={`text-xs mt-0.5 ${indexingStatus.color}`}
                          >
                            {indexingStatus.text}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {row.lastNoticeDate
                            ? formatDate(
                                String(row.lastNoticeDate).slice(0, 10)
                              )
                            : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">{formatDate(row.endDate)}</div>
                        {daysEnd !== null && (
                          <div className={`text-xs mt-0.5 ${endStatus.color}`}>
                            {endStatus.text}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.nextIndexing ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              daysIdx !== null && daysIdx < 20
                                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                : daysIdx !== null && daysIdx < 60
                                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                : "bg-green-500/10 text-green-600 dark:text-green-400"
                            }`}
                          >
                            Programat
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-foreground/5 px-2 py-1 text-xs font-medium text-foreground/50">
                            Fără indexare
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-start gap-6 text-xs text-foreground/60">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/20" />
          <span>Urgent (&lt;20 zile sau depășit)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
          <span>Atenție (&lt;60 zile)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500/20" />
          <span>În termen</span>
        </div>
      </div>
    </main>
  );
}
