"use client";
import React, { useEffect, useState, useRef } from "react";

declare global {
  interface Window {
    __statsOptimisticQueue?: Array<{
      mode: string;
      monthRON?: number;
      monthEUR?: number;
      annualRON?: number;
      annualEUR?: number;
      monthNetRON?: number;
      annualNetRON?: number;
    }>;
  }
}

type Stats = {
  contractsCount: number;
  month: number;
  year: number;
  prognosisMonthRON: number;
  prognosisMonthEUR: number;
  prognosisMonthNetRON: number;
  actualMonthRON: number;
  actualMonthEUR: number;
  actualMonthNetRON: number;
  prognosisAnnualRON: number;
  prognosisAnnualEUR: number;
  prognosisAnnualNetRON: number;
  actualAnnualRON: number;
  actualAnnualEUR: number;
  actualAnnualNetRON: number;
  generatedAt: string;
};

function fmtInt(n: number) {
  return new Intl.NumberFormat("ro-RO").format(Math.round(n));
}
function fmtRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(n);
}
function fmtEUR(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
function pct(actual: number, prognosis: number) {
  if (!prognosis || prognosis <= 0) return 0;
  return Math.min(100, Math.round((actual / prognosis) * 100));
}

const skeletonClass = "animate-pulse rounded bg-foreground/10 h-6 w-24";

export default function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);
  const statsRef = useRef<Stats | null>(null);
  // Track expected optimistic totals so we can detect stale server responses
  const optimisticExpectedRef = useRef<{
    monthGross: number;
    monthNet: number;
    retries: number;
  }>({
    monthGross: 0,
    monthNet: 0,
    retries: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  // Flash timestamps per key to animate recent updates
  const [flashState, setFlashState] = useState<Record<string, number>>({});
  // Refs must be declared at top level (not inside effects) per Rules of Hooks
  const debounceRef = useRef<number | null>(null);
  const pendingLoadRef = useRef(false);
  const rollbackTimeoutsRef = useRef<number[]>([]);
  // Queue optimistic deltas that arrive before initial stats load
  const optimisticQueueRef = useRef<
    {
      mode: string;
      monthRON?: number;
      monthEUR?: number;
      annualRON?: number;
      annualEUR?: number;
      monthNetRON?: number;
      annualNetRON?: number;
    }[]
  >(
    typeof window !== "undefined" && window.__statsOptimisticQueue
      ? [...window.__statsOptimisticQueue]
      : []
  );
  // Batching of rapid optimistic events (after baseline loaded)
  const optimisticBatchRef = useRef<
    {
      mode: string;
      monthRON?: number;
      monthEUR?: number;
      annualRON?: number;
      annualEUR?: number;
      monthNetRON?: number;
      annualNetRON?: number;
    }[]
  >([]);
  const optimisticBatchTimerRef = useRef<number | null>(null);
  const forceRefreshTimerRef = useRef<number | null>(null);

  const applyOptimisticBatch = () => {
    if (!stats) return; // safety; initial load will handle queued values
    if (!optimisticBatchRef.current.length) return;
    const batch = optimisticBatchRef.current.splice(
      0,
      optimisticBatchRef.current.length
    );
    if (optimisticBatchTimerRef.current) {
      window.clearTimeout(optimisticBatchTimerRef.current);
      optimisticBatchTimerRef.current = null;
    }
    let dMonthRON = 0,
      dMonthEUR = 0,
      dAnnualRON = 0,
      dAnnualEUR = 0,
      dMonthNetRON = 0,
      dAnnualNetRON = 0;
    for (const ev of batch) {
      const sign = ev.mode === "delete" ? -1 : 1;
      dMonthRON += sign * (ev.monthRON || 0);
      dMonthEUR += sign * (ev.monthEUR || 0);
      dAnnualRON += sign * (ev.annualRON || 0);
      dAnnualEUR += sign * (ev.annualEUR || 0);
      dMonthNetRON += sign * (ev.monthNetRON || 0);
      dAnnualNetRON += sign * (ev.annualNetRON || 0);
    }
    if (
      !dMonthRON &&
      !dMonthEUR &&
      !dAnnualRON &&
      !dAnnualEUR &&
      !dMonthNetRON &&
      !dAnnualNetRON
    )
      return;
    setStats((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        actualMonthRON: prev.actualMonthRON + dMonthRON,
        actualMonthEUR: prev.actualMonthEUR + dMonthEUR,
        actualAnnualRON: prev.actualAnnualRON + dAnnualRON,
        actualAnnualEUR: prev.actualAnnualEUR + dAnnualEUR,
        actualMonthNetRON: prev.actualMonthNetRON + dMonthNetRON,
        actualAnnualNetRON: prev.actualAnnualNetRON + dAnnualNetRON,
      };
      // Update optimistic expectation trackers (gross & net month)
      optimisticExpectedRef.current.monthGross = next.actualMonthRON;
      optimisticExpectedRef.current.monthNet = next.actualMonthNetRON;
      statsRef.current = next;
      if (process.env.NODE_ENV !== "production") {
        try {
          console.groupCollapsed(
            `%cStats optimistic batch (%c${batch.length} events%c)`,
            "color:#0a0; font-weight:bold;",
            "color:#06c; font-weight:bold;",
            "color:inherit;"
          );
          console.log("Delta Month RON", dMonthRON, "EUR", dMonthEUR);
          console.log("Delta Annual RON", dAnnualRON, "EUR", dAnnualEUR);
          console.table(
            batch.map((b, i) => ({
              i,
              mode: b.mode,
              mRON: b.monthRON,
              mEUR: b.monthEUR,
              aRON: b.annualRON,
              aEUR: b.annualEUR,
              mNet: b.monthNetRON,
              aNet: b.annualNetRON,
            }))
          );
          console.log(
            "Prev Month RON",
            prev.actualMonthRON,
            "→",
            next.actualMonthRON
          );
          console.log(
            "Prev Annual RON",
            prev.actualAnnualRON,
            "→",
            next.actualAnnualRON
          );
          console.groupEnd();
        } catch {}
      }
      const now = Date.now();
      const changed: Record<string, number> = {};
      if (dMonthRON || dMonthEUR || dMonthNetRON) changed.actualMonth = now;
      if (dAnnualRON || dAnnualEUR || dAnnualNetRON) changed.actualAnnual = now;
      if (Object.keys(changed).length) {
        setFlashState((fs) => ({ ...fs, ...changed }));
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        pendingLoadRef.current = true;
        setError(null); // clear previous error on new attempt
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) throw new Error("Eșec încărcare statistici");
        const data = (await res.json()) as Stats;
        if (!cancelled) {
          setStats((prev) => {
            // Apply any queued optimistic deltas to freshly loaded baseline
            let base = data;
            if (optimisticQueueRef.current.length) {
              for (const d of optimisticQueueRef.current) {
                const sign = d.mode === "delete" ? -1 : 1;
                base = {
                  ...base,
                  actualMonthRON:
                    base.actualMonthRON + sign * (d.monthRON || 0),
                  actualMonthEUR:
                    base.actualMonthEUR + sign * (d.monthEUR || 0),
                  actualAnnualRON:
                    base.actualAnnualRON + sign * (d.annualRON || 0),
                  actualAnnualEUR:
                    base.actualAnnualEUR + sign * (d.annualEUR || 0),
                  actualMonthNetRON:
                    base.actualMonthNetRON + sign * (d.monthNetRON || 0),
                  actualAnnualNetRON:
                    base.actualAnnualNetRON + sign * (d.annualNetRON || 0),
                };
              }
            }
            optimisticQueueRef.current = [];
            if (typeof window !== "undefined")
              window.__statsOptimisticQueue = [];
            statsRef.current = base;
            // Initialize or reconcile optimistic expectation tracker
            if (
              optimisticExpectedRef.current.monthGross === 0 &&
              optimisticExpectedRef.current.monthNet === 0
            ) {
              optimisticExpectedRef.current.monthGross = base.actualMonthRON;
              optimisticExpectedRef.current.monthNet = base.actualMonthNetRON;
              optimisticExpectedRef.current.retries = 0;
            }
            // Detect if server returned stale data (behind optimistic expectation)
            const expectedGross = optimisticExpectedRef.current.monthGross;
            if (
              base.actualMonthRON < expectedGross &&
              optimisticExpectedRef.current.retries < 3
            ) {
              optimisticExpectedRef.current.retries += 1;
              // Schedule one more refresh quickly to catch up
              setTimeout(() => {
                if (!cancelled) {
                  window.dispatchEvent(new Event("app:stats:refresh"));
                }
              }, 350);
            } else if (base.actualMonthRON >= expectedGross) {
              optimisticExpectedRef.current.retries = 0; // reset once caught up
            }
            return base;
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Eroare");
      } finally {
        pendingLoadRef.current = false;
      }
    }
    load();
    const schedule = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (!pendingLoadRef.current) {
        if (stats) setSyncing(true);
        else setStats(null);
      }
      debounceRef.current = window.setTimeout(() => {
        load();
      }, 250);
    };
    const handlerRefresh = () => schedule();
    const handlerOptimistic = (ev: Event) => {
      const detail: any = (ev as CustomEvent).detail;
      if (!detail) return;
      if (!statsRef.current) {
        optimisticQueueRef.current.push(detail);
        if (typeof window !== "undefined")
          window.__statsOptimisticQueue = optimisticQueueRef.current;
        return;
      }
      // Push into batch
      optimisticBatchRef.current.push(detail);
      // If this is the first event in a new batch, flush immediately so the card
      // updates BEFORE the invoice list DOM refresh (immediate responsiveness).
      if (optimisticBatchRef.current.length === 1) {
        applyOptimisticBatch();
        // Schedule a force server refresh 4s later to reconcile authoritative totals
        if (forceRefreshTimerRef.current) {
          window.clearTimeout(forceRefreshTimerRef.current);
        }
        forceRefreshTimerRef.current = window.setTimeout(() => {
          window.dispatchEvent(new Event("app:stats:refresh"));
        }, 4000);
        return;
      }
      // For subsequent rapid events (user issuing/deleting multiple), keep a short debounce for batching.
      if (optimisticBatchTimerRef.current) return;
      optimisticBatchTimerRef.current = window.setTimeout(() => {
        applyOptimisticBatch();
        // Reset & schedule force refresh window again (extend) after each flush
        if (forceRefreshTimerRef.current) {
          window.clearTimeout(forceRefreshTimerRef.current);
        }
        forceRefreshTimerRef.current = window.setTimeout(() => {
          window.dispatchEvent(new Event("app:stats:refresh"));
        }, 4000);
      }, 100); // slight delay only for >1 rapid events
    };
    window.addEventListener("app:stats:refresh", handlerRefresh);
    window.addEventListener("app:stats:optimistic", handlerOptimistic as any);
    return () => {
      cancelled = true;
      window.removeEventListener("app:stats:refresh", handlerRefresh);
      window.removeEventListener(
        "app:stats:optimistic",
        handlerOptimistic as any
      );
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      if (optimisticBatchTimerRef.current)
        window.clearTimeout(optimisticBatchTimerRef.current);
      if (forceRefreshTimerRef.current)
        window.clearTimeout(forceRefreshTimerRef.current);
    };
  }, []);

  // Clear syncing & rollback timers when new stats arrive
  useEffect(() => {
    if (!stats) return;
    statsRef.current = stats;
    setSyncing(false);
    rollbackTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
    rollbackTimeoutsRef.current = [];
  }, [stats]);

  // Cleanup old flash highlights
  useEffect(() => {
    if (!Object.keys(flashState).length) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      const next: Record<string, number> = {};
      for (const [k, ts] of Object.entries(flashState)) {
        if (now - ts < 800) next[k] = ts;
        else changed = true;
      }
      if (changed) setFlashState(next);
      if (!Object.keys(next).length) {
        window.clearInterval(id);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [flashState]);

  const cards = [
    {
      label: "Contracts number",
      ron: stats ? fmtInt(stats.contractsCount) : null,
      eur: null,
      progress: null,
    },
    {
      label: "Prognosis this month (gross)",
      ron: stats ? fmtRON(stats.prognosisMonthRON) : null,
      eur: stats ? fmtEUR(stats.prognosisMonthEUR) : null,
      progress: null,
    },
    {
      label: "Issued this month",
      ron: stats ? fmtRON(stats.actualMonthRON) : null, // primary shows gross
      eur: stats ? fmtEUR(stats.actualMonthEUR) : null,
      progress: stats
        ? pct(stats.actualMonthRON, stats.prognosisMonthRON)
        : null,
      // extra fields for merged net display
      netRON: stats ? fmtRON(stats.actualMonthNetRON) : null,
      netEUR: stats ? fmtEUR(stats.actualMonthEUR) : null,
      progressNet: stats
        ? pct(
            stats.actualMonthNetRON,
            stats.prognosisMonthNetRON || stats.prognosisMonthRON
          )
        : null,
    },
    {
      label: "Prognosis annual (gross)",
      ron: stats ? fmtRON(stats.prognosisAnnualRON) : null,
      eur: stats ? fmtEUR(stats.prognosisAnnualEUR) : null,
      progress: null,
    },
  ];

  return (
    <div className="relative">
      {error && !stats ? (
        <div
          className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 text-red-600 p-3 text-sm flex items-center justify-between"
          role="alert"
        >
          <span>{error}</span>
          <button
            onClick={() => {
              // retry
              setStats(null);
              window.dispatchEvent(new Event("app:stats:refresh"));
            }}
            className="ml-4 px-2 py-1 text-xs rounded border border-red-500/40 hover:bg-red-500/20"
          >
            Retry
          </button>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 relative">
        {syncing && stats ? (
          <div className="absolute -top-6 right-0 text-[11px] text-foreground/50 italic">
            (syncing…)
          </div>
        ) : null}
        {cards.map((c) => {
          const isMonth = c.label === "Issued this month";
          const flash = isMonth ? flashState.actualMonth : undefined;
          const activeFlash = flash ? Date.now() - flash < 800 : false;
          return (
            <div
              key={c.label}
              className={
                "rounded-lg border border-foreground/15 p-4 flex flex-col transition-colors duration-300 " +
                (activeFlash
                  ? "bg-emerald-500/10 ring-1 ring-emerald-400/50 shadow-sm"
                  : "bg-background/60")
              }
            >
              <div className="text-sm text-foreground/60 mb-1">{c.label}</div>
              {c.ron ? (
                <>
                  <div className="text-xl font-semibold leading-tight flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span>{c.ron}</span>
                    {c.eur && (
                      <span className="text-sm font-medium text-foreground/60">
                        {c.eur}
                      </span>
                    )}
                  </div>
                  {c.netRON && (
                    <div className="mt-1 text-[13px] text-foreground/70 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="flex items-baseline gap-1">
                        <span className="text-foreground/50">Net:</span>
                        <span>{c.netRON}</span>
                        {c.netEUR && (
                          <span className="text-xs text-foreground/50">
                            {c.netEUR}
                          </span>
                        )}
                      </span>
                      <span className="flex items-baseline gap-1">
                        <span className="text-foreground/50">Gross:</span>
                        <span>{c.ron}</span>
                      </span>
                    </div>
                  )}
                  {typeof c.progress === "number" && (
                    <div className="mt-3 space-y-2 w-full">
                      <div>
                        <div className="h-2 w-full rounded bg-foreground/10 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-[width] duration-500 ease-out will-change-[width]"
                            style={{ width: `${c.progress}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-foreground/50 mt-1">
                          {c.progress}% gross realizat
                        </div>
                      </div>
                      {typeof (c as any).progressNet === "number" && (
                        <div>
                          <div className="h-2 w-full rounded bg-foreground/10 overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 transition-[width] duration-500 ease-out will-change-[width]"
                              style={{ width: `${(c as any).progressNet}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-foreground/50 mt-1">
                            {(c as any).progressNet}% net realizat
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className={skeletonClass} />
                  <div className="mt-2 h-3 w-16 rounded bg-foreground/10 animate-pulse" />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
