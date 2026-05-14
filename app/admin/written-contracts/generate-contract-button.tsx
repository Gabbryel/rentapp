"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateContractFromWrittenContractAction } from "./actions";

type Props = {
  id: string;
  title: string;
  buttonClassName?: string;
};

export function GenerateContractButton({ id, title, buttonClassName }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    setError(null);
    startTransition(() => {
      generateContractFromWrittenContractAction(id)
        .then((result) => {
          if (result.ok && result.contractId) {
            router.push(`/contracts/${result.contractId}`);
          } else {
            setError(result.message ?? "Nu am putut genera contractul.");
          }
        })
        .catch(() => {
          setError("Nu am putut genera contractul.");
        });
    });
  };

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title={`Generează contract din „${title}"`}
        className={
          buttonClassName ??
          "inline-flex items-center justify-center rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {pending ? "Se generează..." : "Generează contract"}
      </button>
      {error ? (
        <p className="max-w-[200px] text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
