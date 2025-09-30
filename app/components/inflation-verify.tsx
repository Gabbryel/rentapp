"use client";

import { useState, useCallback } from "react";

type Props = {
  fromMonth: string; // YYYY-MM
  toMonth: string; // YYYY-MM
  contractId?: string; // when provided, save verification for this contract
};

export default function InflationVerify({
  fromMonth,
  toMonth,
  contractId,
}: Props) {
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | {
        type: "ok";
        localPercent: number;
        aiPercent: number | null;
        verified: boolean;
        reason?: string;
      }
    | { type: "error"; message: string }
  >({ type: "idle" });

  const onVerify = useCallback(async () => {
    try {
      setStatus({ type: "loading" });
      const res = await fetch(
        contractId
          ? `/api/contracts/${encodeURIComponent(contractId)}/verify-inflation`
          : "/api/inflation/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromMonth, toMonth }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setStatus({
        type: "ok",
        localPercent: data.localPercent,
        aiPercent: data.aiPercent ?? null,
        verified: !!data.verified,
        reason: data.reason,
      });
      if (contractId && typeof window !== "undefined") {
        // Refresh the current page to reflect saved badge/state if present
        window.location.reload();
      }
    } catch (e) {
      setStatus({ type: "error", message: (e as Error).message });
    }
  }, [fromMonth, toMonth, contractId]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onVerify}
        className="rounded-md border border-foreground/20 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold hover:bg-foreground/5"
        title="Verifică cu ChatGPT"
      >
        Verifică (ChatGPT)
      </button>
      {status.type === "loading" ? (
        <span className="text-foreground/60 text-xs">Se verifică…</span>
      ) : status.type === "ok" ? (
        <span className="text-foreground/60 text-xs">
          {status.verified ? (
            <span className="text-emerald-700 dark:text-emerald-400">
              Confirmat
            </span>
          ) : (
            <span className="text-amber-700 dark:text-amber-400">
              Nealiniat
            </span>
          )}
          {" · local: "}
          {status.localPercent.toFixed(6)}%{" · AI: "}
          {status.aiPercent != null ? status.aiPercent.toFixed(6) : "—"}
          {status.reason ? (
            <span className="text-foreground/50"> · {status.reason}</span>
          ) : null}
        </span>
      ) : status.type === "error" ? (
        <span className="text-rose-700 dark:text-rose-400 text-xs">
          {status.message}
        </span>
      ) : null}
    </div>
  );
}
