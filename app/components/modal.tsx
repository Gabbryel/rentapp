"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidthClassName?: string; // e.g., "max-w-3xl"
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = "max-w-3xl",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [supportsBackdrop, setSupportsBackdrop] = useState<boolean>(true);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // focus the first button (close) for accessibility
    // Save previously focused element to restore later
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement) ?? null;
    firstFocusableRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Setup portal root on mount
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.setAttribute("data-modal-portal", "");
    setPortalEl(el);
    document.body.appendChild(el);
    return () => {
      try {
        document.body.removeChild(el);
      } catch {}
    };
  }, []);

  // Detect backdrop-filter support (including -webkit- prefix)
  useEffect(() => {
    try {
      const ok =
        typeof CSS !== "undefined" &&
        (CSS.supports("backdrop-filter: blur(2px)") ||
          CSS.supports("-webkit-backdrop-filter: blur(2px)"));
      setSupportsBackdrop(!!ok);
    } catch {
      setSupportsBackdrop(false);
    }
  }, []);

  // Toggle body class for fallback blur when a modal is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      document.body.classList.add("has-modal-open");
      if (!supportsBackdrop) {
        document.body.classList.add("modal-fallback-blur");
      }
      // Hide background content from assistive tech and block interactions
      const appRoot = document.getElementById("app-root");
      if (appRoot) {
        appRoot.setAttribute("aria-hidden", "true");
        try {
          // inert is supported by modern browsers; attribute is fine as a hint
          (appRoot as any).inert = true;
          appRoot.setAttribute("inert", "");
        } catch {}
      }
    } else {
      document.body.classList.remove("has-modal-open");
      document.body.classList.remove("modal-fallback-blur");
      const appRoot = document.getElementById("app-root");
      if (appRoot) {
        appRoot.removeAttribute("aria-hidden");
        try {
          (appRoot as any).inert = false;
          appRoot.removeAttribute("inert");
        } catch {}
      }
      // Restore focus to previously focused element
      try {
        previouslyFocusedRef.current?.focus();
      } catch {}
    }
    return () => {
      document.body.classList.remove("has-modal-open");
      document.body.classList.remove("modal-fallback-blur");
      const appRoot = document.getElementById("app-root");
      if (appRoot) {
        appRoot.removeAttribute("aria-hidden");
        try {
          (appRoot as any).inert = false;
          appRoot.removeAttribute("inert");
        } catch {}
      }
    };
  }, [open, supportsBackdrop]);

  if (!open || !portalEl) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/70 supports-[backdrop-filter]:bg-background/60 backdrop-blur-md p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title ? undefined : "Dialog"}
      aria-labelledby={title ? titleId : undefined}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        // Focus trap within modal content
        const scope = contentRef.current;
        if (!scope) return;
        const focusables = scope.querySelectorAll<HTMLElement>(
          [
            "a[href]",
            "area[href]",
            "button:not([disabled])",
            "input:not([disabled])",
            "select:not([disabled])",
            "textarea:not([disabled])",
            "iframe",
            '[tabindex]:not([tabindex="-1"])',
            '[contenteditable="true"]',
          ].join(",")
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !scope.contains(active)) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (active === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }}
    >
      <div
        ref={contentRef}
        className={`w-full ${maxWidthClassName} max-h-[85vh] rounded-xl bg-background shadow-xl ring-1 ring-foreground/10 overflow-hidden flex flex-col text-base`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10 bg-background">
          <div
            id={title ? titleId : undefined}
            className="text-base font-semibold truncate min-w-0"
          >
            {title}
          </div>
          <button
            ref={firstFocusableRef}
            type="button"
            className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5"
            onClick={onClose}
          >
            Închide
          </button>
        </div>
        <div className="bg-background overflow-auto">{children}</div>
      </div>
    </div>,
    portalEl
  );
}
