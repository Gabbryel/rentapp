"use client";
import * as React from "react";

export default function Reveal({
  button,
  children,
  defaultOpen = false,
}: {
  button: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="reveal">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold hover:bg-foreground/5"
      >
        {button}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
