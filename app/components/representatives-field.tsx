"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Rep = {
  fullname: string | null;
  phone: string | null;
  email: string | null;
  primary: boolean;
};

const EMAIL_RE =
  /^(?!\.)((?!.*\.\.)[A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
const isValidEmail = (v: string) => EMAIL_RE.test(v);

function normalizeRep(r: Partial<Rep>): Rep {
  const trim = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const nz = (v: string) => (v.length > 0 ? v : "");
  const fullname = nz(trim(r.fullname));
  const phone = nz(trim(r.phone));
  const email = nz(trim(r.email));
  return {
    fullname: fullname || null,
    phone: phone || null,
    email: email || null,
    primary: Boolean(r.primary),
  };
}

function isEmptyRep(r: Rep) {
  return !r.fullname && !r.phone && !r.email;
}

export default function RepresentativesField({
  name = "representatives",
  initial,
  label = "Reprezentanți",
}: {
  name?: string;
  initial?: Array<Partial<Rep>>;
  label?: string;
}) {
  const initialRows = useMemo(() => {
    const rows = (initial ?? [])
      .map(normalizeRep)
      .filter((r) => !isEmptyRep(r));
    return rows.length > 0
      ? rows
      : [{ fullname: null, phone: null, email: null, primary: false }];
  }, [initial]);
  const [rows, setRows] = useState<Rep[]>(initialRows);
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // sanitize rows and enforce at most one primary
    const sanitized = rows
      .map(normalizeRep)
      .map((r) => ({
        ...r,
        email: r.email && !isValidEmail(r.email) ? null : r.email,
      }))
      .filter((r) => !isEmptyRep(r));
    let seenPrimary = false;
    const payload = sanitized.map((r) => {
      if (r.primary && !seenPrimary) {
        seenPrimary = true;
        return r;
      }
      return { ...r, primary: seenPrimary ? false : r.primary };
    });
    if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(payload);
  }, [rows]);

  const update = (idx: number, field: keyof Rep, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const cur = { ...next[idx] };
      if (field === "primary") {
        // ignore here; use setPrimary()
      } else if (
        field === "fullname" ||
        field === "phone" ||
        field === "email"
      ) {
        const v = value.trim();
        const normalized = v.length > 0 ? v : null;
        if (field === "fullname") cur.fullname = normalized;
        if (field === "phone") cur.phone = normalized;
        if (field === "email") cur.email = normalized;
      }
      next[idx] = cur;
      return next;
    });
  };
  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { fullname: null, phone: null, email: null, primary: false },
    ]);
  const removeRow = (idx: number) =>
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length <= 0
        ? [{ fullname: null, phone: null, email: null, primary: false }]
        : next;
    });

  const setPrimary = (idx: number, value: boolean) => {
    setRows((prev) =>
      prev.map((r, i) => ({ ...r, primary: i === idx ? value : false }))
    );
  };

  return (
    <div className="rounded-lg border border-foreground/15 p-3">
      <div className="mb-2 text-sm font-medium">{label}</div>
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={"[]"} />
      <div className="space-y-2">
        {rows.map((r, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.5fr_auto_auto] gap-2 items-end"
          >
            <div>
              <label className="block text-xs text-foreground/70">
                Nume complet
              </label>
              <input
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                placeholder="ex: Popescu Ion"
                value={r.fullname ?? ""}
                onChange={(e) => update(idx, "fullname", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-foreground/70">
                Telefon
              </label>
              <input
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                placeholder="ex: +40 712 345 678"
                value={r.phone ?? ""}
                onChange={(e) => update(idx, "phone", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-foreground/70">Email</label>
              <input
                type="email"
                className={`mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm ${
                  r.email && !isValidEmail(r.email)
                    ? "border-red-500/60 focus:outline-red-500"
                    : "border-foreground/20"
                }`}
                placeholder="ex: reprezentant@firma.ro"
                value={r.email ?? ""}
                aria-invalid={!!(r.email && !isValidEmail(r.email))}
                onChange={(e) => update(idx, "email", e.target.value)}
              />
              {r.email && !isValidEmail(r.email) && (
                <div className="mt-1 text-[11px] text-red-600">
                  Email invalid – va fi ignorat la salvare.
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-foreground/70">Primar</label>
              <div className="mt-2">
                <input
                  type="checkbox"
                  className="rounded border-foreground/20"
                  checked={!!r.primary}
                  onChange={(e) => setPrimary(idx, e.target.checked)}
                />
              </div>
            </div>
            <div className="flex gap-2 pb-1">
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="h-9 rounded-md border border-foreground/20 px-2 text-xs text-foreground/80 hover:bg-foreground/5"
                aria-label="Elimină reprezentant"
              >
                Elimină
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm text-foreground/80 hover:bg-foreground/5"
        >
          Adaugă reprezentant
        </button>
      </div>
    </div>
  );
}
