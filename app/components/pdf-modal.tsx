"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

interface PdfModalProps {
  url: string;
  invoiceNumber?: string | null;
  className?: string;
}

// Basic modal for viewing a PDF invoice inline. Uses <iframe>. Assumes the PDF is already generated and accessible.
// Romanian labels with diacritics.
export default function PdfModal({
  url,
  invoiceNumber,
  className,
}: PdfModalProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFocusableRef = useRef<HTMLElement | null>(null);
  const lastFocusableRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // Focus trap & ESC handling
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Move focus to first focusable
    firstFocusableRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab") {
        // Basic focus trapping
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, a[href], iframe, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          (last as HTMLElement).focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
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
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className +
          " rounded-md border border-foreground/20 px-2.5 py-1.5 text-sm font-medium hover:bg-foreground/5 flex items-center gap-1"
        }
        title="Vizualizează factura"
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
        Vezi factura
      </button>
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
              <h3 className="text-sm font-semibold">
                Factură {invoiceNumber ? `#${invoiceNumber}` : ""}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs rounded border px-2 py-1 hover:bg-foreground/5"
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
                src={url}
                title="Factura PDF"
                className="w-full h-[70vh] rounded-b-lg"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
