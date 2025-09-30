"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // focus the first button (close) for accessibility
    firstFocusableRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Dialog"}
    >
      <div
        className={`w-full ${maxWidthClassName} max-h-[85vh] rounded-xl bg-background shadow-xl ring-1 ring-foreground/10 overflow-hidden flex flex-col`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10">
          <div className="text-base font-semibold truncate min-w-0">
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
        <div className="bg-foreground/5 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
