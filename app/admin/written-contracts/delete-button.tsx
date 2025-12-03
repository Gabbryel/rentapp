"use client";

import { useState, useTransition } from "react";
import { deleteWrittenContractAction } from "./actions";

type Props = {
  id: string;
  title: string;
  buttonClassName?: string;
  wrapperClassName?: string;
};

export function DeleteWrittenContractButton({
  id,
  title,
  buttonClassName,
  wrapperClassName,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    const confirmed = window.confirm(
      `Sigur vrei să ștergi contractul scris „${title}”?`
    );
    if (!confirmed) return;

    startTransition(() => {
      deleteWrittenContractAction(id)
        .then((result) => {
          if (!result.ok) {
            setError(result.message ?? "Nu am putut șterge documentul.");
          }
        })
        .catch(() => {
          setError("Nu am putut șterge documentul.");
        });
    });
  };

  return (
    <div
      className={wrapperClassName ?? "flex flex-col items-end gap-1 text-right"}
    >
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className={
          buttonClassName ??
          "inline-flex items-center justify-center rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {pending ? "Se șterge..." : "Șterge"}
      </button>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
