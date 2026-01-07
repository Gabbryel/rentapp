"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  addScanAction,
  updateScanTitleAction,
  deleteScanAction,
  updateVatPercentAction,
  issueIndexingNoticeAction,
  type ScanActionState,
  type IndexingNoticeState,
} from "./actions";
import YearlyInvoicesCard from "../yearly/YearlyInvoicesCard";

type Props = {
  id: string;
  scans: { url: string; title?: string }[];
  mongoConfigured: boolean;
  rentType?: "monthly" | "yearly";
  irregularInvoices?: { month: number; day: number; amountEUR: number }[];
  children?: React.ReactNode;
  wrapChildrenInCard?: boolean;
  currentVatPercent?: number | null;
  indexingInflation?: {
    percent: number;
    fromMonth: string;
    toMonth: string;
    deltaAmount?: number | null;
  } | null;
  currentRent?: number | null;
};

export default function ManageContractScans({
  id,
  scans,
  mongoConfigured,
  rentType,
  irregularInvoices,
  children,
  wrapChildrenInCard = true,
  currentVatPercent,
  indexingInflation,
  currentRent,
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
  const [vatState, updateVatAction] = useActionState<ScanActionState, FormData>(
    updateVatPercentAction,
    { ok: false }
  );
  const [indexingState, issueIndexingAction] = useActionState<
    IndexingNoticeState,
    FormData
  >(issueIndexingNoticeAction, { ok: false });
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (addState.message) setMsg(addState.message);
  }, [addState.message]);

  React.useEffect(() => {
    if (vatState.message) setMsg(vatState.message);
  }, [vatState.message]);

  React.useEffect(() => {
    if (indexingState.message) setMsg(indexingState.message);
  }, [indexingState.message]);

  const [open, setOpen] = React.useState(false);
  return (
    <div
      id="manage-contract-edits"
      className="mt-6 rounded-xl border border-white/10 bg-gradient-to-br from-[#1f3a4b] to-[#0f222a] text-[#E8F1F2] shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-md"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold hover:bg-white/5 rounded-t-xl"
        aria-expanded={open}
        aria-controls="manage-contract-section"
      >
        <span className="inline-flex items-center gap-2">
          <svg
            className={`h-4 w-4 transition-transform ${
              open ? "rotate-90" : "rotate-0"
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M7 5l6 5-6 5V5z" />
          </svg>
          Gestionează contract
        </span>
        <span className="text-[11px] opacity-80">
          {open ? "Ascunde" : "Afișează"}
        </span>
      </button>
      {!open ? null : (
        <>
          {msg ? (
            <div className="mx-4 mt-3 rounded border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              {msg}
            </div>
          ) : null}
          <div
            id="manage-contract-section"
            className="px-5 pb-6 pt-3 space-y-6"
          >
            {/* Card: yearly invoices editor (if applicable) */}
            {rentType === "yearly" ? (
              <YearlyInvoicesCard
                id={id}
                entries={irregularInvoices || []}
                mongoConfigured={mongoConfigured}
              />
            ) : null}
            {/* Card: indexări */}
            <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4 space-y-3">
              <div className="text-[11px] uppercase tracking-wide text-white/60">
                Indexări
              </div>
              <p className="text-xs text-white/70">
                Emite o notificare de indexare pentru parteneri folosind ultimii
                12 luni de HICP (zona euro).
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                {indexingInflation ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 font-medium text-white">
                      {`+${indexingInflation.percent.toFixed(2)}%`}
                    </span>
                    <span className="text-white/50">
                      {indexingInflation.fromMonth} →{" "}
                      {indexingInflation.toMonth}
                    </span>
                    {typeof indexingInflation.deltaAmount === "number" &&
                    typeof currentRent === "number" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 text-emerald-100">
                        {`Impact: ${indexingInflation.deltaAmount.toFixed(
                          2
                        )} EUR / ${currentRent.toFixed(2)} EUR`}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-amber-100">
                    Indicele de inflație nu este disponibil acum.
                  </span>
                )}
              </div>
              <form
                action={issueIndexingAction}
                className="flex flex-wrap items-center gap-2"
              >
                <input type="hidden" name="contractId" value={id} />
                <button
                  className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
                  disabled={!indexingInflation}
                >
                  Emite notificare
                </button>
                {indexingInflation ? null : (
                  <span className="text-xs text-white/60">
                    Încearcă din nou după reîmprospătare.
                  </span>
                )}
              </form>
            </div>
            {/* Card: TVA contract */}
            <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4 space-y-3">
              <div className="text-[11px] uppercase tracking-wide text-white/60">
                TVA contract
              </div>
              <p className="text-xs text-white/70">
                Actualizează procentul TVA folosit pentru calculele și facturile
                emise din acest contract.
              </p>
              {vatState.message ? (
                <div
                  className={`rounded border px-3 py-2 text-xs ${
                    vatState.ok
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                      : "border-amber-400/40 bg-amber-400/10 text-amber-100"
                  }`}
                >
                  {vatState.message}
                </div>
              ) : null}
              <form
                action={updateVatAction}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="id" value={id} />
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor="tvaPercent"
                    className="block text-xs font-medium text-white/70"
                  >
                    Procent TVA (0 – 100)
                  </label>
                  <input
                    id="tvaPercent"
                    name="tvaPercent"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={
                      typeof currentVatPercent === "number"
                        ? currentVatPercent
                        : ""
                    }
                    placeholder="ex: 19"
                    className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  />
                </div>
                <div className="flex gap-2">
                  <button className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10">
                    Salvează TVA
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
                    onClick={() => {
                      if (typeof document === "undefined") return;
                      const el = document.getElementById(
                        "tvaPercent"
                      ) as HTMLInputElement | null;
                      if (el) el.value = "";
                    }}
                  >
                    Golește
                  </button>
                </div>
              </form>
            </div>
            {/* Card: fișiere existente */}
            <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
              <div className="text-[11px] uppercase tracking-wide text-white/60 mb-2">
                Fișiere existente
              </div>
              {scans.length > 0 ? (
                <ul className="space-y-2">
                  {scans.map((s, idx) => (
                    <li
                      key={`${s.url}-${idx}`}
                      className="flex items-center gap-3 justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {s.title || `Scan ${idx + 1}`}
                        </div>
                        <div
                          className="truncate text-xs text-white/60"
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
                            className="w-40 rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                          />
                          <button
                            disabled={!mongoConfigured}
                            className="rounded-md border border-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
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
                            className="rounded-md border border-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                          >
                            Șterge
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-white/70">
                  Niciun fișier existent.
                </div>
              )}
            </div>

            {/* Card: adaugă scan */}
            <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
              <div className="text-[11px] uppercase tracking-wide text-white/60 mb-2">
                Adaugă scan
              </div>
              <form
                action={addAction}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
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
                    className="mt-1 block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs hover:file:bg-white/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium">sau URL</label>
                  <input
                    name="scanUrl"
                    placeholder="/uploads/contract.pdf"
                    className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium">
                    Titlu (opțional)
                  </label>
                  <input
                    name="scanTitle"
                    placeholder="ex: Anexă 1"
                    className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  />
                </div>
                <div className="sm:col-span-4">
                  <button
                    disabled={!mongoConfigured}
                    className="rounded-md border border-white/20 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                  >
                    Adaugă
                  </button>
                </div>
              </form>
            </div>

            {/* Card sau conținut direct: acțiuni suplimentare (children) */}
            {children ? (
              wrapChildrenInCard ? (
                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
                  <div className="text-[11px] uppercase tracking-wide text-white/60 mb-2">
                    Acțiuni contract
                  </div>
                  <div className="mt-1">{children}</div>
                </div>
              ) : (
                <>{children}</>
              )
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
