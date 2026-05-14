"use client";

import { useState } from "react";

type Props = {
  contractId: string;
  currentDay: number | undefined;
  action: (formData: FormData) => Promise<void>;
};

export function InvoiceDayEditor({ contractId, currentDay, action }: Props) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <span
        className="rounded bg-foreground/5 px-2 py-1 inline-flex items-center gap-1.5"
        title="Zi facturare"
      >
        Zi: {typeof currentDay === "number" ? currentDay : "—"}
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Editează ziua de facturare"
          className="text-foreground/60 hover:text-foreground/70 transition-colors"
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </span>
    );
  }

  return (
    <form
      action={action}
      onSubmit={() => setEditing(false)}
      className="inline-flex items-center gap-1.5"
    >
      <input type="hidden" name="contractId" value={contractId} />
      <input
        type="number"
        name="monthlyInvoiceDay"
        defaultValue={currentDay ?? ""}
        min={1}
        max={31}
        autoFocus
        className="w-16 rounded-md border border-foreground/20 bg-background px-2 py-0.5 text-sm focus:border-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
        placeholder="1-31"
      />
      <button
        type="submit"
        className="rounded-md border border-foreground/20 px-2 py-0.5 text-xs font-medium hover:bg-foreground/5"
      >
        OK
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-foreground/60 hover:text-foreground/70"
      >
        ✕
      </button>
    </form>
  );
}
