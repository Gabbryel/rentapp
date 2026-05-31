"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export type AssetRow = {
  id: string;
  name: string;
  address: string;
  owner: string | undefined;
  ownerId: string | undefined;
  areaSqm: number | undefined;
  fileCount: number;
  totalContracts: number;
  activeContracts: number;
  activeTenants: string[];
};

type ContractFilter = "all" | "active" | "none";

type Props = {
  rows: AssetRow[];
  owners: { id: string; name: string }[];
};

export function AssetsClient({ rows, owners }: Props) {
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [contractFilter, setContractFilter] = useState<ContractFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (ownerFilter && r.ownerId !== ownerFilter) return false;
      if (contractFilter === "active" && r.activeContracts === 0) return false;
      if (contractFilter === "none" && r.totalContracts > 0) return false;
      if (q) {
        const haystack = [r.name, r.address, r.owner]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, ownerFilter, contractFilter]);

  const tabs: { value: ContractFilter; label: string }[] = [
    { value: "all", label: "Toate" },
    { value: "active", label: "Cu contracte active" },
    { value: "none", label: "Fără contracte" },
  ];

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        {/* Search */}
        <div className="relative max-w-sm w-full">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <input
            type="search"
            placeholder="Caută nume, adresă…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-foreground/20 bg-background pl-9 pr-4 py-2 text-sm placeholder:text-foreground/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Owner filter */}
        {owners.length > 1 && (
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Toți proprietarii</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Contract filter tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-foreground/15 bg-foreground/5 p-0.5 w-fit mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setContractFilter(tab.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              contractFilter === tab.value
                ? "bg-background shadow-sm text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-foreground/10 p-12 text-center">
          <div className="text-4xl mb-3">🏢</div>
          <p className="text-foreground/60 font-medium">
            {rows.length === 0
              ? "Nu există assets înregistrate. Adaugă primul."
              : "Niciun asset nu corespunde filtrelor selectate."}
          </p>
          {rows.length === 0 && (
            <Link
              href="/admin/assets/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90"
            >
              + Adaugă asset
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Card grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((row) => (
              <AssetCard key={row.id} row={row} />
            ))}
          </div>

          {/* Count footer */}
          {filtered.length !== rows.length && (
            <p className="mt-4 text-xs text-foreground/40 text-right">
              {filtered.length} din {rows.length} assets
            </p>
          )}
        </>
      )}
    </div>
  );
}

function AssetCard({ row }: { row: AssetRow }) {
  const hasActive = row.activeContracts > 0;
  const hasContracts = row.totalContracts > 0;

  return (
    <div className="group rounded-xl border border-foreground/10 bg-background/60 hover:border-foreground/20 hover:shadow-md transition-all flex flex-col p-6">
      {/* Title + badge */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <Link
          href={`/admin/assets/${row.id}`}
          className="font-semibold text-foreground hover:underline decoration-dotted underline-offset-2 leading-snug"
        >
          {row.name}
        </Link>
        {hasActive ? (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {row.activeContracts} activ{row.activeContracts > 1 ? "e" : ""}
          </span>
        ) : hasContracts ? (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-foreground/5 border border-foreground/10 px-2.5 py-1 text-xs text-foreground/50">
            {row.totalContracts} {row.totalContracts === 1 ? "contract" : "contracte"}
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center rounded-full bg-foreground/5 border border-foreground/10 px-2.5 py-1 text-xs text-foreground/40">
            Fără contract
          </span>
        )}
      </div>

      {/* Address */}
      <p className="text-sm text-foreground/60 leading-snug mb-4 line-clamp-2 flex-1">
        {row.address}
      </p>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-4">
        {row.owner && (
          <div className="col-span-2">
            <span className="text-xs text-foreground/40 block mb-0.5">Proprietar</span>
            <Link
              href={`/admin/owners/${encodeURIComponent(row.ownerId || row.owner)}`}
              className="font-medium text-foreground/80 hover:underline decoration-dotted underline-offset-2 truncate block max-w-full"
            >
              {row.owner}
            </Link>
          </div>
        )}
        {typeof row.areaSqm === "number" && (
          <div>
            <span className="text-xs text-foreground/40 block mb-0.5">Suprafață</span>
            <span className="font-medium tabular-nums">
              {row.areaSqm.toLocaleString("ro-RO")} mp
            </span>
          </div>
        )}
        {row.fileCount > 0 && (
          <div>
            <span className="text-xs text-foreground/40 block mb-0.5">Documente</span>
            <span className="font-medium tabular-nums">{row.fileCount} fișiere</span>
          </div>
        )}
      </div>

      {/* Active tenants */}
      {row.activeTenants.length > 0 && (
        <div className="pt-4 border-t border-foreground/10 mb-4">
          <span className="text-xs text-foreground/40 block mb-1.5">Chiriași activi</span>
          <div className="flex flex-wrap gap-1">
            {row.activeTenants.slice(0, 3).map((t) => (
              <span
                key={t}
                className="inline-block rounded-md bg-foreground/5 border border-foreground/10 px-2 py-0.5 text-xs text-foreground/70 truncate max-w-[20ch]"
              >
                {t}
              </span>
            ))}
            {row.activeTenants.length > 3 && (
              <span className="inline-block rounded-md bg-foreground/5 px-2 py-0.5 text-xs text-foreground/50">
                +{row.activeTenants.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer actions — bleeds to card edges with negative margin */}
      <div className="-mx-6 -mb-6 px-6 py-4 mt-auto border-t border-foreground/10 flex items-center justify-between gap-2">
        <Link
          href={`/admin/assets/${row.id}`}
          className="text-xs text-foreground/60 hover:text-foreground transition-colors"
        >
          Detalii →
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/admin/assets/${row.id}/edit`}
            className="rounded-md border border-foreground/20 px-2.5 py-1 text-xs font-medium hover:bg-foreground/5 transition-colors"
          >
            Editează
          </Link>
        </div>
      </div>
    </div>
  );
}
