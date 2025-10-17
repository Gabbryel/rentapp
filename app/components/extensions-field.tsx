"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Row = { docDate: string; document: string; extendedUntil: string };

export default function ExtensionsField({
  name = "contractExtensions",
  initial,
}: {
  name?: string;
  initial?: Row[];
}) {
  const init = useMemo<Row[]>(
    () =>
      Array.isArray(initial) && initial.length
        ? initial
        : [{ docDate: "", document: "", extendedUntil: "" }],
    [initial]
  );
  const [rows, setRows] = useState<Row[]>(init);
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const payload = rows
      .map((r) => ({
        docDate: (r.docDate || "").trim(),
        document: (r.document || "").trim(),
        extendedUntil: (r.extendedUntil || "").trim(),
      }))
      .filter((r) => r.docDate || r.document || r.extendedUntil);
    if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(payload);
  }, [rows]);

  const update = (idx: number, field: keyof Row, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const cur = { ...next[idx] };
      cur[field] = value;
      next[idx] = cur;
      return next;
    });
  };
  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { docDate: "", document: "", extendedUntil: "" },
    ]);
  const removeRow = (idx: number) =>
    setRows((prev) =>
      prev.length <= 1
        ? [{ docDate: "", document: "", extendedUntil: "" }]
        : prev.filter((_, i) => i !== idx)
    );

  return (
    <div className="space-y-3">
      <input ref={hiddenRef} type="hidden" name={name} defaultValue="[]" />
      <div className="space-y-3">
        {rows.map((r, i) => {
          const identifier = `extension-${i + 1}`;
          return (
            <div
              key={identifier}
              className="rounded-lg border border-foreground/15 bg-background/40 p-4 shadow-sm space-y-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/10 text-xs">
                    {i + 1}
                  </span>
                  Prelungire
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="inline-flex items-center gap-2 self-start rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/15 sm:self-auto"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                    aria-hidden="true"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  </svg>
                  Elimină
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor={`${identifier}-docDate`}
                    className="block text-xs font-semibold uppercase tracking-wide text-foreground/60"
                  >
                    Data act adițional
                  </label>
                  <input
                    id={`${identifier}-docDate`}
                    type="date"
                    value={r.docDate}
                    onChange={(e) => update(i, "docDate", e.target.value)}
                    className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor={`${identifier}-document`}
                    className="block text-xs font-semibold uppercase tracking-wide text-foreground/60"
                  >
                    Document
                  </label>
                  <input
                    id={`${identifier}-document`}
                    type="text"
                    value={r.document}
                    onChange={(e) => update(i, "document", e.target.value)}
                    placeholder="ex: Act adițional nr. 1"
                    className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor={`${identifier}-extendedUntil`}
                    className="block text-xs font-semibold uppercase tracking-wide text-foreground/60"
                  >
                    Prelungire până la
                  </label>
                  <input
                    id={`${identifier}-extendedUntil`}
                    type="date"
                    value={r.extendedUntil}
                    onChange={(e) => update(i, "extendedUntil", e.target.value)}
                    className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-2 rounded-md border border-foreground/20 bg-background px-3 py-1.5 text-sm font-medium text-foreground/80 hover:bg-foreground/5"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Adaugă prelungire
      </button>
    </div>
  );
}
