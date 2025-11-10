"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import ActionButton from "@/app/components/action-button";
import type { OptimisticDelta } from "@/types/stats";

declare global {
  interface Window {
    __statsOptimisticQueue?: OptimisticDelta[];
  }
}

type Props = React.ComponentProps<typeof ActionButton> & {
  confirmMessage: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

const toNumber = (value?: string) => {
  const numeric = value ? Number(value) : 0;
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function ConfirmSubmit({
  confirmMessage,
  confirmLabel = "Confirmă",
  cancelLabel = "Anulează",
  ...buttonProps
}: Props) {
  const [open, setOpen] = useState(false);
  const allowSubmitRef = useRef(false);
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleIntercept = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (allowSubmitRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    },
    []
  );

  const close = useCallback(() => setOpen(false), []);

  const confirm = useCallback(() => {
    const submitButton = triggerBtnRef.current;
    const form = submitButton?.closest("form");
    if (!(form instanceof HTMLFormElement)) return;
    if (submitButton && typeof window !== "undefined") {
      const ds = submitButton.dataset;
      if (ds.deltaMode) {
        const detail: OptimisticDelta = {
          mode: ds.deltaMode,
          monthRON: toNumber(ds.deltaMonthRon),
          monthEUR: toNumber(ds.deltaMonthEur),
          annualRON: toNumber(ds.deltaAnnualRon),
          annualEUR: toNumber(ds.deltaAnnualEur),
          monthNetRON: toNumber(ds.deltaMonthNetRon),
          annualNetRON: toNumber(ds.deltaAnnualNetRon),
        };
        window.dispatchEvent(
          new CustomEvent<{ message: string }>("app:toast", {
            detail: {
              message:
                ds.successMessage || buttonProps.successMessage || "Șters",
            },
          })
        );
        // Mirror ActionButton behavior: persist optimistic detail in global queue for pre-mount listeners
        window.__statsOptimisticQueue = [
          ...(window.__statsOptimisticQueue ?? []),
          detail,
        ];
        window.dispatchEvent(
          new CustomEvent<OptimisticDelta>("app:stats:optimistic", {
            detail,
          })
        );
      }
    }
    allowSubmitRef.current = true;
    form.requestSubmit(submitButton ?? undefined);
    setOpen(false);
    window.setTimeout(() => {
      allowSubmitRef.current = false;
    }, 0);
  }, [buttonProps.successMessage]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <>
      <ActionButton
        {...buttonProps}
        ref={triggerBtnRef}
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
