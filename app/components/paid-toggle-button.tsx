"use client";

import { useFormStatus } from "react-dom";

export default function PaidToggleButton({
  isPaid,
  paidAt,
}: {
  isPaid: boolean;
  paidAt?: string;
}) {
  const { pending } = useFormStatus();

  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-foreground/40 cursor-wait">
        <svg
          className="h-3 w-3 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Se procesează…
      </span>
    );
  }

  return (
    <button
      type="submit"
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        isPaid
          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
          : "bg-foreground/5 border-foreground/15 text-foreground/50 hover:bg-foreground/10 hover:text-foreground/70"
      }`}
      title={isPaid ? "Anulează marcajul de plătit" : "Marchează ca plătit"}
    >
      {isPaid ? `✓ Plătit ${paidAt}` : "Neplătit"}
    </button>
  );
}
