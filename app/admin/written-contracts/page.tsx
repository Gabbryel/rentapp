import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { listWrittenContracts } from "@/lib/written-contracts";
import type { WrittenContract } from "@/lib/schemas/written-contract";
import Breadcrumb from "@/app/components/breadcrumb";
import { WrittenContractsClient } from "./written-contracts-client";
import type { DocumentStatus, DisplayRow } from "./written-contracts-client";

export const dynamic = "force-dynamic";

const DATE_FORMATTER = new Intl.DateTimeFormat("ro-RO", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

function resolveStatus(doc: WrittenContract, now: Date): DocumentStatus {
  const start = doc.contractStartDate ? new Date(doc.contractStartDate) : null;
  const end = doc.contractEndDate ? new Date(doc.contractEndDate) : null;
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()))
    return "draft";
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "active";
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return DATE_FORMATTER.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatPeriod(doc: WrittenContract): string {
  const s = formatDate(doc.contractStartDate);
  const e = formatDate(doc.contractEndDate);
  if (doc.contractStartDate && doc.contractEndDate) return `${s} → ${e}`;
  if (doc.contractStartDate) return s;
  if (doc.contractEndDate) return e;
  return "—";
}

function isSameMonth(iso: string | undefined, ref: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    !isNaN(d.getTime()) &&
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth()
  );
}

export default async function AdminWrittenContractsPage() {
  noStore();
  const documents = await listWrittenContracts();
  const now = new Date();

  const rows: DisplayRow[] = documents
    .map((doc) => ({
      document: doc,
      status: resolveStatus(doc, now),
      period: formatPeriod(doc),
    }))
    .sort((a, b) => {
      const aMs = new Date(a.document.updatedAt ?? 0).getTime() || 0;
      const bMs = new Date(b.document.updatedAt ?? 0).getTime() || 0;
      return bMs - aMs;
    });

  // Stats
  const stats = {
    total: documents.length,
    active: rows.filter((r) => r.status === "active").length,
    upcoming: rows.filter((r) => r.status === "upcoming").length,
    ended: rows.filter((r) => r.status === "ended").length,
    signed: documents.filter((d) => d.signed).length,
    linked: documents.filter((d) => Boolean(d.contractId)).length,
    updatedThisMonth: documents.filter((d) =>
      isSameMonth(d.updatedAt, now)
    ).length,
  };

  return (
    <div className="max-w-7xl pt-4">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Contracte scrise" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
            Contracte scrise
          </h1>
          <p className="mt-1 text-sm text-foreground/60 max-w-2xl">
            Documente juridice generate și salvate în aplicație. Editează
            conținutul, marchează semnarea și generează contracte operaționale.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/contracts/written-contract"
            className="rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
          >
            + Document nou
          </Link>
          <Link
            href="/contracts"
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background hover:bg-foreground/90 transition-colors"
          >
            Contracte →
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {(
          [
            { label: "Total", value: stats.total, accent: "text-foreground", border: "border-foreground/20" },
            { label: "Active", value: stats.active, accent: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
            { label: "Urmează", value: stats.upcoming, accent: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
            { label: "Încheiate", value: stats.ended, accent: "text-foreground/50", border: "border-foreground/15" },
            { label: "Semnate", value: stats.signed, accent: "text-violet-600 dark:text-violet-400", border: "border-violet-500/30" },
            { label: "Cu contract", value: stats.linked, accent: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
          ] as const
        ).map(({ label, value, accent, border }) => (
          <div
            key={label}
            className={`rounded-xl border ${border} bg-background/60 px-4 py-3`}
          >
            <div className={`text-2xl font-bold tabular-nums ${accent}`}>
              {value}
            </div>
            <div className="text-xs text-foreground/50 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Client: search + filter + list */}
      <WrittenContractsClient rows={rows} />
    </div>
  );
}
