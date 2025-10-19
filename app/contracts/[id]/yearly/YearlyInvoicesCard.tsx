"use client";
import * as React from "react";
import { useActionState } from "react";
import ActionButton from "@/app/components/action-button";
import {
  addYearlyInvoiceEntryAction,
  removeYearlyInvoiceEntryAction,
} from "./actions";

export default function YearlyInvoicesCard({
  id,
  entries,
  mongoConfigured,
}: {
  id: string;
  entries: { month: number; day: number; amountEUR: number }[];
  mongoConfigured: boolean;
}) {
  const [addState, addEntry] = useActionState(addYearlyInvoiceEntryAction, {
    ok: false,
  });
  const [, removeEntry] = useActionState(removeYearlyInvoiceEntryAction, {
    ok: false,
  });

  return (
    <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
      <div className="text-[11px] uppercase tracking-wide text-white/60 mb-2">
        Facturi anuale – date suplimentare
      </div>
      {entries.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {entries
            .slice()
            .sort((a, b) => a.month - b.month || a.day - b.day)
            .map((r, i) => (
              <li
                key={`${r.month}-${r.day}-${i}`}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-white/10 px-2 py-0.5 text-xs">
                    {String(r.day).padStart(2, "0")}/{String(r.month).padStart(2, "0")}
                  </span>
                  <span className="text-white/80 text-xs">
                    {typeof r.amountEUR === "number" ? `${r.amountEUR.toFixed(2)} EUR` : "—"}
                  </span>
                </div>
                <form action={removeEntry}>
                  <input type="hidden" name="contractId" value={id} />
                  <input type="hidden" name="month" value={String(r.month)} />
                  <input type="hidden" name="day" value={String(r.day)} />
                  <button
                    disabled={!mongoConfigured}
                    className="rounded-md border border-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                    onClick={(e) => {
                      if (!confirm("Ștergi această dată anuală?")) e.preventDefault();
                    }}
                  >
                    Șterge
                  </button>
                </form>
              </li>
            ))}
        </ul>
      ) : (
        <div className="text-sm text-white/70">Nu există date definite.</div>
      )}
      <form action={addEntry} className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end text-sm">
        <input type="hidden" name="contractId" value={id} />
        <div>
          <label className="block text-xs font-medium">Luna (1-12)</label>
          <input
            name="month"
            type="number"
            min={1}
            max={12}
            inputMode="numeric"
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            placeholder="ex: 3"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium">Zi (1-31)</label>
          <input
            name="day"
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            placeholder="ex: 15"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium">Sumă EUR</label>
          <input
            name="amountEUR"
            type="number"
            step="0.01"
            min={0}
            inputMode="decimal"
            className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            placeholder="ex: 1000.00"
            required
          />
        </div>
        <div>
          <button
            disabled={!mongoConfigured}
            className="w-full rounded-md border border-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            Adaugă / actualizează
          </button>
        </div>
      </form>
      {addState?.message ? (
        <div className="mt-2 rounded border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          {addState.message}
        </div>
      ) : null}
    </div>
  );
}
