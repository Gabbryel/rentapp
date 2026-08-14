"use client";

import { useState } from "react";
import type { AnafCompany } from "@/lib/anaf";

const inputClass =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm";

type Initial = {
  name?: string;
  vatNumber?: string;
  orcNumber?: string;
  headquarters?: string;
  isVatPayer?: boolean;
};

export default function PartnerIdentityFields({
  initial,
}: {
  initial?: Initial;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [vatNumber, setVatNumber] = useState(initial?.vatNumber ?? "");
  const [orcNumber, setOrcNumber] = useState(initial?.orcNumber ?? "");
  const [headquarters, setHeadquarters] = useState(initial?.headquarters ?? "");
  const [isVatPayer, setIsVatPayer] = useState(initial?.isVatPayer === true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<AnafCompany | null>(null);

  async function lookup() {
    const cui = vatNumber.trim();
    if (!cui || loading) return;
    setLoading(true);
    setError(null);
    setFound(null);
    try {
      const res = await fetch(`/api/anaf?cui=${encodeURIComponent(cui)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Interogarea ANAF a eșuat.");
        return;
      }
      const company = data as AnafCompany;
      setName(company.name);
      setVatNumber(company.cui);
      setIsVatPayer(company.isVatPayer);
      if (company.orcNumber) setOrcNumber(company.orcNumber);
      if (company.headquarters) setHeadquarters(company.headquarters);
      setFound(company);
    } catch {
      setError("Interogarea ANAF a eșuat. Completează datele manual.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div>
        <label className="block text-sm font-medium">CUI</label>
        <div className="mt-1 flex gap-2">
          <input
            name="vatNumber"
            required
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Don't submit the whole form from the CUI box.
                e.preventDefault();
                lookup();
              }
            }}
            placeholder="ex: RO14399840"
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={lookup}
            disabled={loading || !vatNumber.trim()}
            className="shrink-0 rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-foreground/5 disabled:opacity-50"
          >
            {loading ? "Se caută…" : "Preia de la ANAF"}
          </button>
        </div>
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
        {found && (
          <div className="mt-2 rounded-md border border-foreground/15 bg-foreground/5 px-3 py-2 text-xs text-foreground/80">
            <div className="font-medium text-foreground">{found.name}</div>
            {found.registrationStatus && <div>{found.registrationStatus}</div>}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <span>{found.isVatPayer ? "Plătitor de TVA" : "Neplătitor de TVA"}</span>
              {found.eInvoicing && <span>Înregistrat RO e-Factura</span>}
              {found.caenCode && <span>CAEN {found.caenCode}</span>}
              {found.phone && <span>Tel. {found.phone}</span>}
            </div>
            {found.isInactive && (
              <div className="mt-1 font-semibold text-red-600">
                Atenție: contribuabil declarat inactiv de ANAF.
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Nume</label>
        <input
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Nr. ORC</label>
        <input
          name="orcNumber"
          required
          value={orcNumber}
          onChange={(e) => setOrcNumber(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Sediu</label>
        <input
          name="headquarters"
          required
          value={headquarters}
          onChange={(e) => setHeadquarters(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="isVatPayer"
            checked={isVatPayer}
            onChange={(e) => setIsVatPayer(e.target.checked)}
            className="rounded border-foreground/20"
          />
          Plătitor de TVA
        </label>
      </div>
    </>
  );
}
