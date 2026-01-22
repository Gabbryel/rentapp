"use client";

import { useState, useTransition } from "react";
import { toggleSignedStatusAction } from "./actions";

type Props = {
  id: string;
  title: string;
  currentSigned: boolean;
};

export function ToggleSignedButton({ id, title, currentSigned }: Props) {
  const [signed, setSigned] = useState(currentSigned);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    setError(null);
    const newSignedState = !signed;

    startTransition(() => {
      toggleSignedStatusAction(id, newSignedState)
        .then((result) => {
          if (result.ok) {
            setSigned(newSignedState);
          } else {
            setError(result.message ?? "Eroare la actualizare");
            // Revert optimistic update
          }
        })
        .catch(() => {
          setError("Eroare la actualizare");
        });
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
          signed
            ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
            : "border border-amber-500/30 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25"
        } disabled:cursor-not-allowed disabled:opacity-60`}
        title={`Marchează ca ${signed ? "nesemnat" : "semnat"}`}
      >
        {pending ? "..." : signed ? "✓ Semnat" : "○ Nesemnat"}
      </button>
      {error ? (
        <p className="text-[10px] text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
