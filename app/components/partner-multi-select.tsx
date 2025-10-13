"use client";
import { useEffect, useState } from "react";

type Partner = { id: string; name: string };
interface Props {
  defaultPartners?: { id?: string; name: string }[];
  max?: number;
}
export default function PartnerMultiSelect({
  defaultPartners = [],
  max = 10,
}: Props) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [rows, setRows] = useState<{ id?: string; name: string }[]>(
    defaultPartners.length > 0 ? defaultPartners : [{ id: undefined, name: "" }]
  );
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch("/api/partners", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted) setPartners(Array.isArray(data) ? data : []);
      } catch {}
    })();
    return () => {
      aborted = true;
    };
  }, []);
  const update = (
    idx: number,
    patch: Partial<{ id?: string; name: string }>
  ) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };
  const addRow = () => {
    setRows((r) => (r.length >= max ? r : [...r, { id: undefined, name: "" }]));
  };
  const removeRow = (idx: number) => {
    setRows((r) =>
      r.length === 1
        ? [{ id: undefined, name: "" }]
        : r.filter((_, i) => i !== idx)
    );
  };
  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const current = row.id && partners.find((p) => p.id === row.id);
        return (
          <div key={i} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-4 sm:col-span-3">
              <select
                value={row.id || ""}
                onChange={(e) => {
                  const id = e.target.value || undefined;
                  const p = partners.find((x) => x.id === id);
                  update(i, { id, name: p ? p.name : row.name });
                }}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-sm"
              >
                <option value="">— alege —</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-7 sm:col-span-8">
              <input
                placeholder="Nume partener"
                value={row.name}
                onChange={(e) => update(i, { name: e.target.value })}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-sm"
              />
            </div>
            <div className="col-span-1 flex justify-end pt-1">
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-[10px] leading-none text-red-600 hover:underline px-1"
                aria-label="Remove partner"
                title="Elimină partener"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
      <div>
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= max}
          className="text-xs text-foreground/70 hover:underline disabled:opacity-40"
        >
          + partener
        </button>
      </div>
      {/* Hidden fields */}
      {rows.map((r, i) => (
        <div key={i} className="hidden">
          <input name="partnerIds" value={r.id || ""} readOnly />
          <input name="partnerNames" value={r.name} readOnly />
        </div>
      ))}
      {/* For backward compatibility: primary partner fields (first row) */}
      <input type="hidden" name="partnerId" value={rows[0]?.id || ""} />
      <input type="hidden" name="partner" value={rows[0]?.name || ""} />
    </div>
  );
}
