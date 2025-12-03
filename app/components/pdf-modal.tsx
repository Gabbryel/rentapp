"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

interface PdfModalProps {
  url?: string;
  resolveUrl?: () => Promise<string>;
  invoiceNumber?: string | null;
  title?: string;
  buttonLabel?: string;
  buttonTitle?: string;
  className?: string;
  resolveErrorMessage?: string;
  onClose?: () => void;
}

// Modal reutilizabil pentru previzualizarea unui document PDF într-un iframe.
export default function PdfModal({
  url,
  resolveUrl,
  invoiceNumber,
  title,
  buttonLabel,
  buttonTitle,
  className,
  resolveErrorMessage,
  onClose,
}: PdfModalProps) {
  const [open, setOpen] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(url ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFocusableRef = useRef<HTMLElement | null>(null);
  const lastFocusableRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setResolvedUrl(url ?? null);
  }, [url]);

  const close = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  const handleOpen = useCallback(async () => {
    setError(null);
    if (resolveUrl) {
      setLoading(true);
      try {
        const nextUrl = await resolveUrl();
        if (!nextUrl) {
          throw new Error("empty-url");
        }
        setResolvedUrl(nextUrl);
        setOpen(true);
      } catch (err) {
        console.error("Nu am putut încărca PDF-ul", err);
        setError(resolveErrorMessage ?? "Nu am putut genera documentul PDF.");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (resolvedUrl) {
      setOpen(true);
      return;
    }
    setError(resolveErrorMessage ?? "Documentul PDF nu este disponibil.");
  }, [resolveUrl, resolvedUrl, resolveErrorMessage]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstFocusableRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, a[href], iframe, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          (last as HTMLElement).focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          (first as HTMLElement).focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [open, close]);

  const buttonClasses = [
    className,
    "rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium hover:bg-foreground/5 flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-60",
  ]
    .filter(Boolean)
    .join(" ");

  const resolvedTitle =
    title ?? (invoiceNumber ? `Factură #${invoiceNumber}` : "Document PDF");
  const resolvedButtonLabel = loading
    ? "Se generează..."
    : buttonLabel ?? "Vezi factura";
  const resolvedButtonTitle = buttonTitle ?? "Vizualizează documentul PDF";
  const frameTitle = resolvedTitle || "Document PDF";
  const anchorHref = resolvedUrl ?? undefined;
  const anchorDisabled = !anchorHref;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={buttonClasses}
        title={resolvedButtonTitle}
        disabled={loading}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 4h16v16H4z" />
          <path d="M8 8h8v8H8z" />
        </svg>
        {resolvedButtonLabel}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => close()}
          />
          <div
            ref={dialogRef}
            className="relative z-10 w-full max-w-3xl rounded-lg border border-foreground/20 bg-background shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-foreground/10">
              <h3 className="text-sm font-semibold">{resolvedTitle}</h3>
              <div className="flex items-center gap-2">
                <a
                  href={anchorHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs rounded border px-2 py-1 hover:bg-foreground/5 ${
                    anchorDisabled ? "pointer-events-none opacity-50" : ""
                  }`}
                  aria-disabled={anchorDisabled}
                  ref={(el) => {
                    firstFocusableRef.current = el;
                  }}
                >
                  Deschide separat
                </a>
                <button
                  type="button"
                  onClick={() => close()}
                  className="text-xs rounded border px-2 py-1 hover:bg-foreground/5"
                  ref={(el) => {
                    lastFocusableRef.current = el;
                  }}
                >
                  Închide
                </button>
              </div>
            </div>
            <div className="p-0">
              <iframe
                src={resolvedUrl ?? undefined}
                title={frameTitle}
                className="w-full h-[70vh] rounded-b-lg"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
