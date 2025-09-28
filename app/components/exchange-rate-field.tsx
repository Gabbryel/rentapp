"use client";

import { useEffect, useState } from "react";

type Props = {
  name: string;
  label?: string;
  defaultValue?: number | string;
};

export default function ExchangeRateField({ name, label = "Curs RON/EUR", defaultValue }: Props) {
  const [value, setValue] = useState<string>(defaultValue?.toString() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/exchange/eurron", { cache: "no-store" });
        if (!res.ok) throw new Error("Nu am putut obține cursul.");
        const data = (await res.json()) as { rate?: number };
        if (!cancelled && typeof data.rate === "number") {
          setValue(data.rate.toFixed(4));
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    // Only auto-fill when there is no default value
    if (!defaultValue) load();
    return () => {
      cancelled = true;
    };
  }, [defaultValue]);

  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          name={name}
          type="number"
          step="0.0001"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ex: 4.97"
          className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              setLoading(true);
              const res = await fetch("/api/exchange/eurron", { cache: "no-store" });
              if (!res.ok) throw new Error("Nu am putut obține cursul.");
              const data = (await res.json()) as { rate?: number };
              if (typeof data.rate === "number") setValue(data.rate.toFixed(4));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setLoading(false);
            }
          }}
          className="shrink-0 rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
          disabled={loading}
        >
          {loading ? "Se încarcă…" : "Actualizează"}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
