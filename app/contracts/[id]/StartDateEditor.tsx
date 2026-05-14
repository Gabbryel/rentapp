"use client";

import { useState } from "react";

type Props = {
  contractId: string;
  displayDate: string;
  startDateIso: string;
  signedAtIso: string;
  endDateIso: string;
  action: (formData: FormData) => Promise<void>;
};

export function StartDateEditor({
  contractId,
  displayDate,
  startDateIso,
  signedAtIso,
  endDateIso,
  action,
}: Props) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{displayDate}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Editează data de start"
          className="text-foreground/60 hover:text-foreground/70 transition-colors"
        >
          <svg
            className="h-3.5 w-3.5"
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
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={() => setEditing(false)}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="contractId" value={contractId} />
      <input
        type="date"
        name="startDate"
        defaultValue={startDateIso}
        min={signedAtIso}
        max={endDateIso}
        autoFocus
        className="rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm focus:border-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
      />
      <button
        type="submit"
        className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-medium hover:bg-foreground/5"
      >
        Salvează
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-foreground/60 hover:text-foreground/70"
      >
        Anulează
      </button>
    </form>
  );
}
