"use client";
import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  addCustomInvoiceEntryAction,
  updateCustomInvoiceEntryAction,
  removeCustomInvoiceEntryAction,
} from "./actions";

type Entry = { date: string; amountEUR: number };

type ActionState = { ok: boolean; message?: string };

const fmtEUR = (v: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" }).format(v);

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

function EntryRow({
  contractId,
  entry,
  onDone,
}: {
  contractId: string;
  entry: Entry;
  onDone: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [updateState, updateEntry, updatePending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await updateCustomInvoiceEntryAction(prev, fd);
      if (res.ok) {
        setEditing(false);
        onDone();
      }
      return res;
    },
    { ok: false }
  );
  const [removeState, removeEntry, removePending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await removeCustomInvoiceEntryAction(prev, fd);
      if (res.ok) onDone();
      return res;
    },
    { ok: false }
  );

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-2 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="rounded bg-foreground/10 px-2 py-0.5 text-xs font-medium">
            {fmtDate(entry.date)}
          </span>
          <span className="text-foreground/80 text-xs">{fmtEUR(entry.amountEUR)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/10"
          >
            Editează
          </button>
          <form action={removeEntry}>
            <input type="hidden" name="contractId" value={contractId} />
            <input type="hidden" name="date" value={entry.date} />
            <button
              disabled={removePending}
              className="rounded-md border border-red-400/30 px-2 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              onClick={(e) => {
                if (!confirm(`Ștergi factura din ${fmtDate(entry.date)}?`)) e.preventDefault();
              }}
            >
              Șterge
            </button>
          </form>
        </div>
        {removeState?.message ? (
          <div className="basis-full text-xs text-amber-600 dark:text-amber-300">{removeState.message}</div>
        ) : null}
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-cyan-400/30 bg-foreground/5 px-3 py-2">
      <form action={updateEntry} className="flex flex-wrap items-end gap-2 text-xs">
        <input type="hidden" name="contractId" value={contractId} />
        <input type="hidden" name="originalDate" value={entry.date} />
        <div>
          <label className="block text-foreground/60 mb-1">Data facturii</label>
          <input
            name="date"
            type="date"
            defaultValue={entry.date}
            required
            className="rounded-md border border-foreground/20 bg-transparent px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-foreground/60 mb-1">Sumă EUR</label>
          <input
            name="amountEUR"
            type="number"
            step="0.01"
            min={0}
            inputMode="decimal"
            defaultValue={String(entry.amountEUR)}
            required
            className="w-28 rounded-md border border-foreground/20 bg-transparent px-2 py-1"
          />
        </div>
        <button
          disabled={updatePending}
          className="rounded-md border border-cyan-400/40 px-2.5 py-1 font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-50"
        >
          {updatePending ? "Se salvează…" : "Salvează"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md border border-foreground/20 px-2.5 py-1 font-semibold hover:bg-foreground/10"
        >
          Renunță
        </button>
        {updateState?.message ? (
          <div className="basis-full text-amber-600 dark:text-amber-300">{updateState.message}</div>
        ) : null}
      </form>
    </li>
  );
}

export default function CustomInvoicesCard({
  id,
  entries,
  mongoConfigured,
}: {
  id: string;
  entries: Entry[];
  mongoConfigured: boolean;
}) {
  const router = useRouter();
  const refresh = React.useCallback(() => router.refresh(), [router]);
  const [addState, addEntry, addPending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await addCustomInvoiceEntryAction(prev, fd);
      if (res.ok) refresh();
      return res;
    },
    { ok: false }
  );

  return (
    <div className="rounded-xl border border-foreground/15 bg-foreground/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-wide text-foreground/60 mb-2">
        Facturi custom – grafic de emitere
      </div>
      <div className="text-xs text-foreground/70 mb-3">
        Adaugă sau editează datele și sumele facturilor pentru acest contract.
      </div>
      {entries.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {entries
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((r) => (
              <EntryRow key={r.date} contractId={id} entry={r} onDone={refresh} />
            ))}
        </ul>
      ) : (
        <div className="text-sm text-foreground/70">Nu există date definite.</div>
      )}
      <form
        action={addEntry}
        className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end text-sm"
      >
        <input type="hidden" name="contractId" value={id} />
        <div>
          <label className="block text-xs font-medium">Data facturii</label>
          <input
            name="date"
            type="date"
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
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
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            placeholder="ex: 1000.00"
            required
          />
        </div>
        <div>
          <button
            disabled={!mongoConfigured || addPending}
            className="w-full rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/10 disabled:opacity-50"
          >
            {addPending ? "Se adaugă…" : "Adaugă / actualizează"}
          </button>
        </div>
      </form>
      {addState?.message ? (
        <div className="mt-2 rounded border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
          {addState.message}
        </div>
      ) : null}
    </div>
  );
}
