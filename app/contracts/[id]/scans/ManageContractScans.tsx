"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  addScanAction,
  updateScanTitleAction,
  deleteScanAction,
  type ScanActionState,
} from "./actions";

type Props = {
  id: string;
  scans: { url: string; title?: string }[];
  mongoConfigured: boolean;
  children?: React.ReactNode;
};

export default function ManageContractScans({
  id,
  scans,
  mongoConfigured,
  children,
}: Props) {
  const [addState, addAction] = useActionState<ScanActionState, FormData>(
    addScanAction,
    { ok: false }
  );
  const [, updateAction] = useActionState<ScanActionState, FormData>(
    updateScanTitleAction,
    { ok: false }
  );
  const [, removeAction] = useActionState<ScanActionState, FormData>(
    deleteScanAction,
    { ok: false }
  );
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (addState.message) setMsg(addState.message);
  }, [addState.message]);

  const [open, setOpen] = React.useState(false);
  return (
    <div className="mt-4 rounded-md border border-foreground/15 p-4 bg-[#34656D] text-[#FAEAB1]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm font-semibold hover:bg-foreground/5"
        aria-expanded={open}
        aria-controls="manage-contract-section"
      >
        <span>Gestionează contract</span>
        <span className="text-xs opacity-80">
          {open ? "Ascunde" : "Afișează"}
        </span>
      </button>
      {!open ? null : (
        <>
          {msg ? (
            <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-800">
              {msg}
            </div>
          ) : null}
          <div id="manage-contract-section" className="mt-3 space-y-3">
            {scans.length > 0 ? (
              <ul className="space-y-2">
                {scans.map((s, idx) => (
                  <li
                    key={`${s.url}-${idx}`}
                    className="flex items-center gap-2 justify-between rounded border border-foreground/10 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {s.title || `Scan ${idx + 1}`}
                      </div>
                      <div
                        className="truncate text-xs text-foreground/60"
                        title={s.url}
                      >
                        {s.url}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <form
                        action={updateAction}
                        className="flex items-center gap-1"
                      >
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="index" value={idx} />
                        <input
                          name="scanTitle"
                          placeholder="Titlu"
                          defaultValue={s.title || ""}
                          className="w-32 rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs"
                        />
                        <button
                          disabled={!mongoConfigured}
                          className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5 disabled:opacity-50"
                        >
                          Salvează titlul
                        </button>
                      </form>
                      <form
                        action={removeAction}
                        onSubmit={(e) => {
                          if (!confirm("Ștergi acest scan?"))
                            e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="index" value={idx} />
                        <button
                          disabled={!mongoConfigured}
                          className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5 disabled:opacity-50"
                        >
                          Șterge
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-foreground/60">
                Niciun fișier existent.
              </div>
            )}

            <fieldset className="rounded border border-foreground/10 p-3">
              <legend className="px-1 text-xs text-foreground/60">
                Adaugă scan
              </legend>
              <form
                action={addAction}
                className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end"
              >
                <input type="hidden" name="id" value={id} />
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium">
                    Fișier (PDF sau imagine)
                  </label>
                  <input
                    type="file"
                    name="scanFile"
                    accept="application/pdf,image/*"
                    className="mt-1 block w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium">sau URL</label>
                  <input
                    name="scanUrl"
                    placeholder="/uploads/contract.pdf"
                    className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium">
                    Titlu (opțional)
                  </label>
                  <input
                    name="scanTitle"
                    placeholder="ex: Anexă 1"
                    className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-2 py-1 text-xs"
                  />
                </div>
                <div className="sm:col-span-4">
                  <button
                    disabled={!mongoConfigured}
                    className="rounded-md border border-foreground/20 px-2.5 py-1.5 text-xs font-semibold hover:bg-foreground/5 disabled:opacity-50"
                  >
                    Adaugă
                  </button>
                </div>
              </form>
            </fieldset>
            {children}
          </div>
        </>
      )}
    </div>
  );
}
