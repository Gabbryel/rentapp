"use client";
import React, { useCallback, useState, useRef, useEffect } from "react";
import ActionButton from "@/app/components/action-button";

type Props = React.ComponentProps<typeof ActionButton> & {
  confirmMessage: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export default function ConfirmSubmit({
  confirmMessage,
  confirmLabel = "Confirmă",
  cancelLabel = "Anulează",
  ...rest
}: Props) {
  const [open, setOpen] = useState(false);
  const allowSubmitRef = useRef(false);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleIntercept = useCallback((e: React.MouseEvent) => {
    if (allowSubmitRef.current) return; // already confirmed
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const confirm = useCallback(() => {
    const form = triggerBtnRef.current?.closest(
      "form"
    ) as HTMLFormElement | null;
    if (!form) return;
    // Since the original click was intercepted (capture), the ActionButton's onClick
    // never fired. We must manually perform the optimistic dispatch & toast here.
    try {
      const btn = triggerBtnRef.current as HTMLElement | null;
      if (btn && typeof window !== "undefined") {
        const ds: any = btn.dataset;
        if (ds.deltaMode) {
          const num = (v?: string) => (v ? Number(v) : 0);
            // Build optimistic detail (positive deltas; consumer logic applies sign=-1 for delete)
          const detail = {
            mode: ds.deltaMode as string,
            monthRON: num(ds.deltaMonthRon),
            monthEUR: num(ds.deltaMonthEur),
            annualRON: num(ds.deltaAnnualRon),
            annualEUR: num(ds.deltaAnnualEur),
            monthNetRON: num(ds.deltaMonthNetRon),
            annualNetRON: num(ds.deltaAnnualNetRon),
          };
          // Toast
          window.dispatchEvent(
            new CustomEvent("app:toast", {
              detail: { message: (ds.successMessage as string) || "Șters" },
            })
          );
          // Optimistic stats event
          window.dispatchEvent(
            new CustomEvent("app:stats:optimistic", { detail })
          );
        }
      }
    } catch {}
    allowSubmitRef.current = true;
    // Use requestSubmit to trigger proper form handling & server action
    form.requestSubmit(triggerBtnRef.current || undefined);
    setOpen(false);
    // reset flag shortly after to avoid accidental duplicate
    setTimeout(() => {
      allowSubmitRef.current = false;
    }, 0);
  }, []);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <ActionButton
        {...rest}
        ref={(n: any) => {
          triggerBtnRef.current = n;
        }}
        onClickCapture={handleIntercept}
      />
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={close}
          />
          <div className="relative z-10 w-full max-w-sm rounded-lg border border-foreground/15 bg-background p-6 shadow-lg animate-in fade-in zoom-in">
            <p className="text-sm leading-relaxed text-foreground mb-5">
              {confirmMessage}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 text-sm rounded-md border border-foreground/20 hover:bg-foreground/5"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={confirm}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-500"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
