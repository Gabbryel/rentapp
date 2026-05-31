"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export type ContractRow = {
  id: string;
  name: string;
  partner: string | undefined;
  owner: string | undefined;
  ownerId: string | undefined;
  asset: string | undefined;
  assetId: string | undefined;
  currentRent: number | undefined;
  startDate: string;
  endDate: string;
  daysUntilExpiry: number;
  status: "active" | "expired" | "upcoming";
  rentType: "monthly" | "yearly";
  hasExtension: boolean;
};

type StatusFilter = "all" | "active" | "expired" | "upcoming";

type Props = {
  rows: ContractRow[];
  owners: { id: string; name: string }[];
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ro-RO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status, daysUntilExpiry }: { status: ContractRow["status"]; daysUntilExpiry: number }) {
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 border border-foreground/10 px-2.5 py-0.5 text-xs font-medium text-foreground/40">
        <span className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
        Expirat
      </span>
    );
  }
  if (status === "upcoming") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        Urmează
      </span>
    );
  }
  if (daysUntilExpiry <= 30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Activ · {daysUntilExpiry}z
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Activ
    </span>
  );
}

export function ContractsClient({ rows, owners }: Props) {
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (ownerFilter && r.ownerId !== ownerFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q) {
        const haystack = [r.name, r.partner, r.owner, r.asset]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, ownerFilter, statusFilter]);

  const tabs: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Toate" },
    { value: "active", label: "Active" },
    { value: "upcoming", label: "Urmează" },
    { value: "expired", label: "Expirate" },
  ];

  const activeCount = rows.filter((r) => r.status === "active").length;
  const expiredCount = rows.filter((r) => r.status === "expired").length;
  const expiringSoonCount = rows.filter((r) => r.status === "active" && r.daysUntilExpiry <= 30).length;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <div className="relative max-w-sm w-full">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="search"
            placeholder="Caută nume, partener, proprietar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-foreground/20 bg-background pl-9 pr-4 py-2 text-sm placeholder:text-foreground/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        {owners.length > 1 && (
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Toți proprietarii</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Status tabs + expiry warning */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-1 rounded-lg border border-foreground/15 bg-foreground/5 p-0.5 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {expiringSoonCount > 0 && (
          <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
            {expiringSoonCount} contract{expiringSoonCount > 1 ? "e expiră" : " expiră"} în &lt;30 zile
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-foreground/10 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-foreground/60 font-medium">
            {rows.length === 0
              ? "Nu există contracte înregistrate."
              : "Niciun contract nu corespunde filtrelor selectate."}
          </p>
          {rows.length === 0 && (
            <Link
              href="/contracts/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90"
            >
              + Adaugă contract
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Card grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((row) => (
              <ContractCard key={row.id} row={row} />
            ))}
          </div>
          {filtered.length !== rows.length && (
            <p className="mt-4 text-xs text-foreground/40 text-right">
              {filtered.length} din {rows.length} contracte
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ContractCard({ row }: { row: ContractRow }) {
  return (
    <div className="group rounded-xl border border-foreground/10 bg-background/60 hover:border-foreground/20 hover:shadow-md transition-all flex flex-col p-6">
      {/* Title + badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <Link
          href={`/contracts/${row.id}`}
          className="font-semibold text-foreground hover:underline decoration-dotted underline-offset-2 leading-snug"
        >
          {row.name}
        </Link>
        <StatusBadge status={row.status} daysUntilExpiry={row.daysUntilExpiry} />
      </div>

      {/* Partner */}
      {row.partner && (
        <p className="text-sm text-foreground/70 mb-4 leading-snug truncate">
          {row.partner}
        </p>
      )}

      {/* Meta */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-4 flex-1">
        {row.owner && (
          <div className="col-span-2">
            <span className="text-xs text-foreground/40 block mb-0.5">Proprietar</span>
            <Link
              href={`/admin/owners/${encodeURIComponent(row.ownerId || row.owner)}`}
              className="font-medium text-foreground/80 hover:underline decoration-dotted underline-offset-2 truncate block"
            >
              {row.owner}
            </Link>
          </div>
        )}
        {row.asset && (
          <div className="col-span-2">
            <span className="text-xs text-foreground/40 block mb-0.5">Asset</span>
            {row.assetId ? (
              <Link
                href={`/admin/assets/${row.assetId}`}
                className="font-medium text-foreground/80 hover:underline decoration-dotted underline-offset-2 truncate block"
              >
                {row.asset}
              </Link>
            ) : (
              <span className="font-medium text-foreground/80 truncate block">{row.asset}</span>
            )}
          </div>
        )}
        {row.currentRent !== undefined && (
          <div>
            <span className="text-xs text-foreground/40 block mb-0.5">Chirie</span>
            <span className="font-semibold tabular-nums text-foreground">
              {row.currentRent.toLocaleString("ro-RO")} EUR
            </span>
          </div>
        )}
        <div>
          <span className="text-xs text-foreground/40 block mb-0.5">Tip</span>
          <span className="font-medium text-foreground/70">
            {row.rentType === "monthly" ? "Lunar" : "Anual"}
          </span>
        </div>
        <div>
          <span className="text-xs text-foreground/40 block mb-0.5">Start</span>
          <span className="font-medium tabular-nums text-foreground/70">{fmtDate(row.startDate)}</span>
        </div>
        <div>
          <span className="text-xs text-foreground/40 block mb-0.5">
            {row.hasExtension ? "Prelungit până la" : "Expiră"}
          </span>
          <span className={`font-medium tabular-nums ${
            row.status === "active" && row.daysUntilExpiry <= 30
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground/70"
          }`}>
            {fmtDate(row.endDate)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="-mx-6 -mb-6 px-6 py-4 mt-auto border-t border-foreground/10 flex items-center justify-between gap-2">
        <Link
          href={`/contracts/${row.id}`}
          className="text-xs text-foreground/60 hover:text-foreground transition-colors"
        >
          Detalii →
        </Link>
        <Link
          href={`/contracts/${row.id}/edit`}
          className="rounded-md border border-foreground/20 px-2.5 py-1 text-xs font-medium hover:bg-foreground/5 transition-colors"
        >
          Editează
        </Link>
      </div>
    </div>
  );
}
