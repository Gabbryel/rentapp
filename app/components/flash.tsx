"use client";

import { useEffect, useState } from "react";

export default function Flash({
  message,
  durationMs = 5000,
  tone = "info",
}: {
  message: string;
  durationMs?: number;
  tone?: "info" | "success" | "warning" | "error";
}) {
  const [open, setOpen] = useState(Boolean(message));
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setOpen(false), Math.max(5000, durationMs));
    return () => clearTimeout(id);
  }, [open, durationMs]);
  if (!open) return null;
  const ring =
    tone === "success"
      ? "ring-emerald-500/30"
      : tone === "warning"
      ? "ring-amber-500/30"
      : tone === "error"
      ? "ring-red-500/30"
      : "ring-cyan-500/30";
  return (
    <div
      className={`mb-4 rounded-md border border-foreground/10 ${ring} bg-foreground/5 px-3 py-2 text-sm flex items-start justify-between gap-3`}
    >
      <div className="pr-3">{message}</div>
      <button
        type="button"
        className="shrink-0 rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
        onClick={() => setOpen(false)}
      >
        Închide
      </button>
    </div>
  );
}
