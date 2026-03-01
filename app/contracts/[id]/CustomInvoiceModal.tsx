"use client";

import { useMemo, useState, useTransition } from "react";

type PreviewData = {
  previewToken: string;
  billedAt: string;
  periodFrom: string;
  periodTo: string;
  totalDays: number;
  billedDays: number;
  computedAmountEUR: number;
  effectiveAmountEUR: number;
  exchangeRateRON: number;
  exchangeRateDate: string;
  breakdown: {
    correctedAmountEUR: number;
    netRON: number;
    vatRON: number;
    totalRON: number;
    tvaPercent: number;
  };
};

type Props = {
  contractId: string;
  defaultIssuedAt: string;
  issueAction: (formData: FormData) => Promise<void>;
};

export default function CustomInvoiceModal({
  contractId,
  defaultIssuedAt,
  issueAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const [issuedAt, setIssuedAt] = useState(defaultIssuedAt);
  const [fromDate, setFromDate] = useState(defaultIssuedAt);
  const [toDate, setToDate] = useState(defaultIssuedAt);
  const [amountEUR, setAmountEUR] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canIssue = Boolean(preview?.previewToken) && !isPending;

  const amountNumber = useMemo(() => {
    if (!amountEUR.trim()) return undefined;
    const value = Number(amountEUR.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return undefined;
    return value;
  }, [amountEUR]);

  const invalidatePreview = () => {
    setPreview(null);
  };

  const handlePreview = async () => {
    setError(null);
    setIsPreviewLoading(true);
    try {
      const res = await fetch("/api/invoices/custom-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          issuedAt,
          fromDate,
          toDate,
          amountEUR: amountNumber,
          mode: "custom_period",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Previzualizarea a eșuat");
      }
      setPreview(data as PreviewData);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Previzualizarea a eșuat");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setError(null);
    setPreview(null);
  };

  const handleIssue = () => {
    if (!preview?.previewToken) {
      setError("Previzualizarea este obligatorie înainte de emitere.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("contractId", contractId);
    fd.set("issuedAt", issuedAt);
    fd.set("mode", "custom_period");
    fd.set("fromDate", fromDate);
    fd.set("toDate", toDate);
    fd.set("previewToken", preview.previewToken);
    if (amountNumber) fd.set("amountEUR", String(amountNumber));

    startTransition(async () => {
      try {
        await issueAction(fd);
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Emiterea a eșuat");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-foreground/30 bg-foreground/5 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/10"
      >
        Editează emiterea
      </button>

      {open ? (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="mx-4 w-full max-w-2xl rounded-lg border border-foreground/45 bg-background p-5 text-white shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-foreground/15 pb-3">
              <h3 className="text-base font-semibold">
                Emitere factură personalizată
              </h3>
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-foreground/40 bg-foreground/5 px-2 py-1 text-xs font-semibold text-white hover:bg-foreground/10"
              >
                Închide
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <label className="space-y-1">
                <span className="text-white">Data emiterii</span>
                <input
                  type="date"
                  value={issuedAt}
                  onChange={(e) => {
                    setIssuedAt(e.target.value);
                    invalidatePreview();
                  }}
                  className="w-full rounded-md border border-foreground/45 bg-foreground/10 px-2 py-1 text-white focus:border-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/40"
                />
              </label>

              <label className="space-y-1">
                <span className="text-white">from_date</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    invalidatePreview();
                  }}
                  className="w-full rounded-md border border-foreground/45 bg-foreground/10 px-2 py-1 text-white focus:border-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/40"
                />
              </label>

              <label className="space-y-1">
                <span className="text-white">to_date (inclusiv)</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    invalidatePreview();
                  }}
                  className="w-full rounded-md border border-foreground/45 bg-foreground/10 px-2 py-1 text-white focus:border-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/40"
                />
              </label>

              <label className="space-y-1">
                <span className="text-white">
                  Suma EUR (opțional, override)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={amountEUR}
                  onChange={(e) => {
                    setAmountEUR(e.target.value);
                    invalidatePreview();
                  }}
                  className="w-full rounded-md border border-foreground/45 bg-foreground/10 px-2 py-1 text-white focus:border-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/40"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePreview}
                disabled={isPreviewLoading || !issuedAt || !fromDate || !toDate}
                className="rounded-md border border-foreground/40 bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-foreground/15 disabled:border-foreground/25 disabled:bg-foreground/10 disabled:text-white/80"
              >
                {isPreviewLoading ? "Se calculează..." : "Previzualizează"}
              </button>
              <button
                type="button"
                onClick={handleIssue}
                disabled={!canIssue}
                className="rounded-md border border-foreground/40 bg-foreground px-3 py-1.5 text-xs font-semibold text-white hover:bg-foreground/90 disabled:border-foreground/25 disabled:bg-foreground/30 disabled:text-white/80"
              >
                {isPending ? "Se emite..." : "Emite factura"}
              </button>
              <span className="rounded-md border border-foreground/20 bg-foreground/10 px-2 py-1 text-[11px] font-medium text-white">
                Previzualizarea este obligatorie înainte de emitere.
              </span>
            </div>

            {error ? (
              <div className="mt-3 rounded-md border border-red-300/50 bg-red-500/10 px-3 py-2 text-xs text-white">
                {error}
              </div>
            ) : null}

            {preview ? (
              <div className="mt-4 grid grid-cols-1 gap-2 rounded-md border border-foreground/35 bg-foreground/5 p-3 text-xs sm:grid-cols-2">
                <div className="rounded-md border border-foreground/20 bg-foreground/10 p-2">
                  <div className="font-medium text-white">
                    Perioadă facturată
                  </div>
                  <div className="font-medium">
                    {preview.periodFrom} - {preview.periodTo}
                  </div>
                </div>
                <div className="rounded-md border border-foreground/20 bg-foreground/10 p-2">
                  <div className="font-medium text-white">Zile facturate</div>
                  <div className="font-medium">
                    {preview.billedDays} / {preview.totalDays}
                  </div>
                </div>
                <div className="rounded-md border border-foreground/20 bg-foreground/10 p-2">
                  <div className="font-medium text-white">EUR calculat</div>
                  <div className="font-medium">
                    {preview.computedAmountEUR.toFixed(2)} EUR
                  </div>
                </div>
                <div className="rounded-md border border-foreground/20 bg-foreground/10 p-2">
                  <div className="font-medium text-white">EUR final</div>
                  <div className="font-medium">
                    {preview.effectiveAmountEUR.toFixed(2)} EUR
                  </div>
                </div>
                <div className="rounded-md border border-foreground/20 bg-foreground/10 p-2">
                  <div className="font-medium text-white">Curs</div>
                  <div className="font-medium">
                    {preview.exchangeRateRON.toFixed(4)} (
                    {preview.exchangeRateDate})
                  </div>
                </div>
                <div className="rounded-md border border-foreground/20 bg-foreground/10 p-2">
                  <div className="font-medium text-white">TVA</div>
                  <div className="font-medium">
                    {preview.breakdown.tvaPercent}% ·{" "}
                    {preview.breakdown.vatRON.toFixed(2)} RON
                  </div>
                </div>
                <div className="rounded-md border border-foreground/20 bg-foreground/10 p-2">
                  <div className="font-medium text-white">Net</div>
                  <div className="font-medium">
                    {preview.breakdown.netRON.toFixed(2)} RON
                  </div>
                </div>
                <div className="rounded-md border border-foreground/20 bg-foreground/10 p-2">
                  <div className="font-medium text-white">Total</div>
                  <div className="font-medium">
                    {preview.breakdown.totalRON.toFixed(2)} RON
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}
