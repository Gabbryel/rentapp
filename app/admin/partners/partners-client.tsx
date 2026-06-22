"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Partner } from "@/lib/schemas/partner";

// Deterministic color palette — hashed from partner ID
const PALETTE = [
  { border: "#3b82f6", bg: "rgba(59,130,246,0.06)", text: "#3b82f6" },   // blue
  { border: "#8b5cf6", bg: "rgba(139,92,246,0.06)", text: "#8b5cf6" },   // violet
  { border: "#10b981", bg: "rgba(16,185,129,0.06)", text: "#10b981" },   // emerald
  { border: "#f59e0b", bg: "rgba(245,158,11,0.06)", text: "#f59e0b" },   // amber
  { border: "#f43f5e", bg: "rgba(244,63,94,0.06)", text: "#f43f5e" },    // rose
  { border: "#06b6d4", bg: "rgba(6,182,212,0.06)", text: "#06b6d4" },    // cyan
  { border: "#f97316", bg: "rgba(249,115,22,0.06)", text: "#f97316" },   // orange
  { border: "#ec4899", bg: "rgba(236,72,153,0.06)", text: "#ec4899" },   // pink
  { border: "#6366f1", bg: "rgba(99,102,241,0.06)", text: "#6366f1" },   // indigo
  { border: "#14b8a6", bg: "rgba(20,184,166,0.06)", text: "#14b8a6" },   // teal
] as const;

function colorForId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

type Props = { partners: Partner[] };

export function PartnersClient({ partners }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) => {
      const haystack = [
        p.name,
        p.vatNumber,
        p.orcNumber,
        p.headquarters,
        ...(p.representatives ?? []).flatMap((r) => [r.fullname, r.email, r.phone]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [partners, query]);

  return (
    <div>
      {/* Search */}
      <div className="relative max-w-sm w-full mb-6">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="search"
          placeholder="Caută nume, CUI, sediu, contact…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-foreground/20 bg-background pl-9 pr-4 py-2 text-sm placeholder:text-foreground/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-foreground/10 p-12 text-center">
          <div className="text-4xl mb-3">🏢</div>
          <p className="text-foreground/60 font-medium">
            {partners.length === 0
              ? "Nu există parteneri înregistrați."
              : "Niciun partener nu corespunde căutării."}
          </p>
          {partners.length === 0 && (
            <Link
              href="/admin/partners/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90"
            >
              + Adaugă partener
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((p) => (
              <PartnerCard key={p.id} partner={p} />
            ))}
          </div>
          {filtered.length !== partners.length && (
            <p className="mt-4 text-xs text-foreground/40 text-right">
              {filtered.length} din {partners.length} parteneri
            </p>
          )}
        </>
      )}
    </div>
  );
}

function PartnerCard({ partner: p }: { partner: Partner }) {
  const color = colorForId(p.id);
  const primary = p.representatives?.find((r) => r.primary) ?? p.representatives?.[0];
  const initials = p.name.trim().charAt(0).toUpperCase();

  return (
    <div
      className="group rounded-xl border border-foreground/10 bg-background/60 hover:border-foreground/20 hover:shadow-md transition-all flex flex-col overflow-hidden"
      style={{ borderLeftColor: color.border, borderLeftWidth: 4 }}
    >
      <div className="p-5 flex-1 flex flex-col">
        {/* Header: avatar + name + VAT badge */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: color.bg, color: color.text, border: `1.5px solid ${color.border}40` }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <Link
              href={`/partners/${p.id}`}
              className="font-semibold text-foreground hover:underline decoration-dotted underline-offset-2 leading-snug block truncate"
            >
              {p.name}
            </Link>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                  p.isVatPayer
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-foreground/5 text-foreground/50 border-foreground/10"
                }`}
              >
                TVA: {p.isVatPayer ? "Da" : "Nu"}
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3 flex-1">
          {p.vatNumber && (
            <div>
              <span className="text-xs text-foreground/40 block mb-0.5">CUI</span>
              <span className="font-medium tabular-nums">{p.vatNumber}</span>
            </div>
          )}
          {p.orcNumber && (
            <div>
              <span className="text-xs text-foreground/40 block mb-0.5">Nr. ORC</span>
              <span className="font-medium">{p.orcNumber}</span>
            </div>
          )}
          {p.headquarters && (
            <div className="col-span-2">
              <span className="text-xs text-foreground/40 block mb-0.5">Sediu</span>
              <span className="text-foreground/70 text-xs leading-snug line-clamp-2">{p.headquarters}</span>
            </div>
          )}
        </div>

        {/* Representatives */}
        {primary && (
          <div className="pt-3 border-t border-foreground/8">
            <span className="text-xs text-foreground/40 block mb-1">Contact principal</span>
            <div className="text-sm font-medium truncate">{primary.fullname || "—"}</div>
            {(primary.phone || primary.email) && (
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-foreground/50">
                {primary.phone && <span>{primary.phone}</span>}
                {primary.email && <span className="truncate">{primary.email}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-5 py-3 border-t border-foreground/10 flex items-center justify-between gap-2"
        style={{ background: color.bg }}
      >
        <Link
          href={`/partners/${p.id}`}
          className="text-xs text-foreground/60 hover:text-foreground transition-colors"
        >
          Detalii →
        </Link>
        <Link
          href={`/admin/partners/${p.id}`}
          className="rounded-md border border-foreground/20 px-2.5 py-1 text-xs font-medium hover:bg-foreground/10 transition-colors"
        >
          Editează
        </Link>
      </div>
    </div>
  );
}
