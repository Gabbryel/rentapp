"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { DeleteWrittenContractButton } from "./delete-button";
import { WrittenContractPreviewButton } from "./preview-button";
import { ToggleSignedButton } from "./toggle-signed-button";
import { GenerateContractButton } from "./generate-contract-button";
import type { WrittenContract } from "@/lib/schemas/written-contract";

export type DocumentStatus = "draft" | "upcoming" | "active" | "ended";

export type DisplayRow = {
  document: WrittenContract;
  status: DocumentStatus;
  period: string;
};

const STATUS_META: Record<
  DocumentStatus,
  { label: string; badge: string; dot: string }
> = {
  draft: {
    label: "Fără perioadă",
    badge: "bg-foreground/8 text-foreground/50 border border-foreground/15",
    dot: "bg-foreground/30",
  },
  upcoming: {
    label: "Urmează",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
    dot: "bg-blue-500",
  },
  active: {
    label: "Activ",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25",
    dot: "bg-emerald-500",
  },
  ended: {
    label: "Încheiat",
    badge: "bg-foreground/5 text-foreground/40 border border-foreground/10",
    dot: "bg-foreground/20",
  },
};

const STATUS_TABS: { value: DocumentStatus | "all"; label: string }[] = [
  { value: "all", label: "Toate" },
  { value: "active", label: "Active" },
  { value: "upcoming", label: "Urmează" },
  { value: "ended", label: "Încheiate" },
  { value: "draft", label: "Fără perioadă" },
];

type Props = {
  rows: DisplayRow[];
};

export function WrittenContractsClient({ rows }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");
  const [signedFilter, setSignedFilter] = useState<"all" | "signed" | "unsigned">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (signedFilter === "signed" && !r.document.signed) return false;
      if (signedFilter === "unsigned" && r.document.signed) return false;
      if (q) {
        const haystack = [
          r.document.title,
          r.document.documentNumber,
          r.document.partnerName,
          r.document.ownerName,
          r.document.assetName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter, signedFilter]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
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
            placeholder="Caută titlu, partener, proprietar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-foreground/20 bg-background pl-9 pr-4 py-2 text-sm placeholder:text-foreground/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Signed toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-foreground/15 bg-foreground/5 p-0.5 self-start sm:self-auto">
          {(
            [
              { value: "all", label: "Toate" },
              { value: "signed", label: "✓ Semnate" },
              { value: "unsigned", label: "○ Nesemnate" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSignedFilter(opt.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                signedFilter === opt.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-foreground/15 bg-foreground/5 p-0.5 w-fit mb-6">
        {STATUS_TABS.map((tab) => (
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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-foreground/10 p-12 text-center">
          <div className="text-3xl mb-3">📄</div>
          <p className="text-foreground/60 font-medium">
            {rows.length === 0
              ? "Nu există contracte scrise salvate momentan."
              : "Niciun document nu corespunde filtrelor selectate."}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {filtered.map(({ document, status, period }) => {
              const meta = STATUS_META[status];
              return (
                <div
                  key={document.id}
                  className="rounded-xl border border-foreground/10 bg-background/60 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <Link
                        href={`/contracts/written-contract?writtenContractId=${encodeURIComponent(document.id)}`}
                        className="font-semibold text-foreground/90 hover:underline decoration-dotted underline-offset-2 block truncate"
                      >
                        {document.title}
                      </Link>
                      {document.documentNumber && (
                        <div className="text-xs text-foreground/50 mt-0.5">
                          {document.documentNumber}
                        </div>
                      )}
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                    <div>
                      <dt className="text-xs text-foreground/50 mb-0.5">Partener</dt>
                      <dd className="text-foreground/80 truncate">{document.partnerName || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-foreground/50 mb-0.5">Proprietar</dt>
                      <dd className="text-foreground/80 truncate">{document.ownerName || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-foreground/50 mb-0.5">Perioadă</dt>
                      <dd className="text-foreground/80">{period}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-foreground/50 mb-0.5">Semnat</dt>
                      <dd>
                        <ToggleSignedButton id={document.id} currentSigned={document.signed} />
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap items-center gap-2">
                    <WrittenContractPreviewButton
                      document={document}
                      buttonLabel="Previzualizează"
                      className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5"
                    />
                    <Link
                      href={`/contracts/written-contract?writtenContractId=${encodeURIComponent(document.id)}`}
                      className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:bg-foreground/90"
                    >
                      Editează
                    </Link>
                    {document.contractId ? (
                      <Link
                        href={`/contracts/${encodeURIComponent(document.contractId)}`}
                        className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs hover:bg-foreground/5"
                      >
                        Contract →
                      </Link>
                    ) : (
                      <GenerateContractButton
                        id={document.id}
                        title={document.title}
                        buttonClassName="inline-flex items-center justify-center rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-500/20 disabled:opacity-60"
                      />
                    )}
                    <DeleteWrittenContractButton
                      id={document.id}
                      title={document.title}
                      buttonClassName="inline-flex items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-500/20 disabled:opacity-60"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl border border-foreground/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-foreground/5 border-b border-foreground/10">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-foreground/50 w-[28%]">
                      Document
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-foreground/50 w-[20%]">
                      Parteneri
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-foreground/50 w-[16%]">
                      Perioadă
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-foreground/50 w-[12%]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-foreground/50 w-[10%]">
                      Semnat
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-foreground/50 text-right w-[14%]">
                      Acțiuni
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/8">
                  {filtered.map(({ document, status, period }) => {
                    const meta = STATUS_META[status];
                    return (
                      <tr
                        key={document.id}
                        className="hover:bg-foreground/[0.03] text-foreground/80"
                      >
                        {/* Document */}
                        <td className="px-4 py-3">
                          <Link
                            href={`/contracts/written-contract?writtenContractId=${encodeURIComponent(document.id)}`}
                            className="font-medium text-foreground hover:underline decoration-dotted underline-offset-2 block truncate max-w-[26ch]"
                          >
                            {document.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            {document.documentNumber && (
                              <span className="text-xs text-foreground/50">
                                {document.documentNumber}
                              </span>
                            )}
                            {document.documentNumber && document.updatedAt && (
                              <span className="text-foreground/20 text-xs">·</span>
                            )}
                            {document.updatedAt && (
                              <span className="text-xs text-foreground/40">
                                {new Intl.DateTimeFormat("ro-RO", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }).format(new Date(document.updatedAt))}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Parties */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground/90 truncate max-w-[18ch]">
                            {document.partnerName || "—"}
                          </div>
                          <div className="text-xs text-foreground/50 mt-0.5 truncate max-w-[18ch]">
                            {document.ownerName || "—"}
                          </div>
                        </td>

                        {/* Period */}
                        <td className="px-4 py-3">
                          <span className="text-sm tabular-nums">{period}</span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </td>

                        {/* Signed */}
                        <td className="px-4 py-3">
                          <ToggleSignedButton
                            id={document.id}
                            currentSigned={document.signed}
                          />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <WrittenContractPreviewButton
                              document={document}
                              buttonLabel="PDF"
                              buttonTitle={`Previzualizează ${document.title}`}
                              className="rounded-md border border-foreground/20 px-2.5 py-1 text-xs font-medium hover:bg-foreground/5"
                            />
                            <Link
                              href={`/contracts/written-contract?writtenContractId=${encodeURIComponent(document.id)}`}
                              className="rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background hover:bg-foreground/90"
                              title="Editează"
                            >
                              Editează
                            </Link>
                            {document.contractId ? (
                              <Link
                                href={`/contracts/${encodeURIComponent(document.contractId)}`}
                                className="rounded-md border border-foreground/20 px-2.5 py-1 text-xs hover:bg-foreground/5"
                                title="Contract asociat"
                              >
                                Contract
                              </Link>
                            ) : (
                              <GenerateContractButton
                                id={document.id}
                                title={document.title}
                              />
                            )}
                            <DeleteWrittenContractButton
                              id={document.id}
                              title={document.title}
                              buttonClassName="inline-flex items-center justify-center rounded-md border border-red-500/30 bg-red-500/8 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-500/15 disabled:opacity-60"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table footer: result count */}
            <div className="border-t border-foreground/8 px-4 py-2.5 text-xs text-foreground/40">
              {filtered.length} {filtered.length === 1 ? "document" : "documente"}
              {filtered.length !== rows.length && ` din ${rows.length}`}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
