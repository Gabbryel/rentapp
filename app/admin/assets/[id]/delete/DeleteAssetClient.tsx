"use client";

import { useActionState } from "react";
import { deleteAssetAction, type DeleteState } from "./actions";

export default function DeleteAssetClient({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [state, formAction] = useActionState<DeleteState, FormData>(
    deleteAssetAction,
    { ok: false }
  );
  if (state.ok && state.redirectTo) {
    window.location.href = state.redirectTo;
  }
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`Sigur ștergi asset-ul \"${name}\"?`)) {
            e.preventDefault();
          }
        }}
        className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/20"
      >
        Șterge
      </button>
      {state.message ? (
        <span className="ml-2 text-xs text-red-400">{state.message}</span>
      ) : null}
    </form>
  );
}
