"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { fetchMeCached } from "@/lib/client-cache";

const links = [
  { href: "/contracts", label: "Contracte" },
  { href: "/invoices/monthly", label: "Facturi lunare" },
  { href: "/indexing-schedule", label: "Grafic indexări" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("rentapp:theme");
    if (saved === "light" || saved === "dark") return saved;
    const prefersLight =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    return prefersLight ? "light" : "dark";
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [dbName, setDbName] = useState<string | null>(null);
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [dbLocation, setDbLocation] = useState<"local" | "remote" | null>(null);
  const [dbProvider, setDbProvider] = useState<"atlas" | "other" | null>(null);
  const [checkingDb, setCheckingDb] = useState(false);
  const [bnrRate, setBnrRate] = useState<number | null>(null);
  const [bnrDate, setBnrDate] = useState<string | null>(null);
  const [bnrSource, setBnrSource] = useState<string | null>(null);
  const [btRate, setBtRate] = useState<number | null>(null);
  const [btDate, setBtDate] = useState<string | null>(null);
  const [btSource, setBtSource] = useState<string | null>(null);
  const [refreshingFx, setRefreshingFx] = useState(false);
  const [fxError, setFxError] = useState<null | "bnr" | "bt" | "both">(null);
  // DB manual check persistence
  const [dbLastCheckedAt, setDbLastCheckedAt] = useState<number | null>(null);
  const [dbLastOk, setDbLastOk] = useState<boolean | null>(null);
  const DB_LAST_KEY = "rentapp:db:last-check";

  // Helper: how many hours passed since a given ISO date string
  const hoursSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    const t = new Date(dateStr).getTime();
    if (Number.isNaN(t)) return null;
    const diffH = Math.max(0, (Date.now() - t) / 36e5);
    return `${diffH.toFixed(1)}h`;
  };

  // Close menu on route change
  useEffect(() => setOpen(false), [pathname]);
  // Track mount to avoid hydration mismatches for theme-dependent UI
  useEffect(() => {
    setMounted(true);
  }, []);
  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      document.documentElement.classList.add("overflow-hidden");
      document.body.classList.add("overflow-hidden");
    } else {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    };
  }, [open]);

  // Apply theme to <html data-theme="..."> and persist
  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("rentapp:theme", theme);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute("content", theme === "light" ? "#ffffff" : "#0a1628");
      }
    } catch {
      // ignore
    }
  }, [theme]);

  // Keep in sync with system preference ONLY if user hasn't explicitly chosen
  useEffect(() => {
    const storageKey = "rentapp:theme";
    const mql =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: light)");
    if (!mql) return;

    const onChange = () => {
      const saved = localStorage.getItem(storageKey);
      // Only follow system if no explicit preference is saved
      if (saved === "light" || saved === "dark") return;
      setTheme(mql.matches ? "light" : "dark");
    };

    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  const refreshFx = useCallback(async () => {
    if (refreshingFx) return;
    setRefreshingFx(true);
    setFxError(null); // reset previous error while refreshing
    try {
      const [bnrRes, btRes] = await Promise.allSettled([
        fetch("/api/exchange/refresh", { cache: "no-store" }),
        fetch("/api/exchange/bt/refresh", { cache: "no-store" }),
      ]);
      let bnrFailed = false,
        btFailed = false;
      if (bnrRes.status === "rejected" || !bnrRes.value.ok) bnrFailed = true;
      if (btRes.status === "rejected" || !btRes.value.ok) btFailed = true;

      // Re-fetch exchange rate data and update state
      const load = async () => {
        let newBnrRate = null,
          newBnrDate = null;
        try {
          const res = await fetch("/api/exchange/eurron?force=1", {
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            newBnrRate = typeof data.rate === "number" ? data.rate : null;
            newBnrDate = data.date || null;
            setBnrRate(newBnrRate);
            setBnrDate(newBnrDate);
            setBnrSource(data.source || null);
          } else {
            bnrFailed = true;
          }
        } catch {
          bnrFailed = true;
        }
        try {
          const res = await fetch("/api/exchange/bt", { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            setBtRate(typeof data.rate === "number" ? data.rate : null);
            setBtDate(data.date || null);
            setBtSource(data.source || null);
          } else {
            btFailed = true;
          }
        } catch {
          btFailed = true;
        }
        return { newBnrRate, newBnrDate };
      };
      const { newBnrRate } = await load();

      // If BNR succeeded, apply the latest stored rate to all contracts
      if (!bnrFailed && typeof newBnrRate === "number" && newBnrRate > 0) {
        try {
          const res = await fetch("/api/contracts/apply-exchange-rate", {
            method: "POST",
            cache: "no-store",
          });
          if (!res.ok) {
            // Mark as error for toast
            bnrFailed = true;
          }
        } catch {
          bnrFailed = true;
        }
      }

      if (bnrFailed || btFailed) {
        const type = bnrFailed && btFailed ? "both" : bnrFailed ? "bnr" : "bt";
        setFxError(type);
        try {
          window.dispatchEvent(
            new CustomEvent("app:toast", {
              detail: {
                type: "error",
                message:
                  type === "both"
                    ? "Eroare: cursurile BNR și BT nu au putut fi reîmprospătate/aplicate."
                    : type === "bnr"
                    ? "Eroare la reîmprospătarea sau aplicarea cursului BNR."
                    : "Eroare la reîmprospătarea cursului BT.",
              },
            })
          );
        } catch {}
      } else {
        try {
          window.dispatchEvent(
            new CustomEvent("app:toast", {
              detail: {
                type: "success",
                message:
                  "Cursurile EUR/RON au fost reîmprospătate și aplicate contractelor.",
              },
            })
          );
        } catch {}
      }
    } finally {
      setRefreshingFx(false);
    }
  }, [
    refreshingFx,
    setBnrRate,
    setBnrDate,
    setBnrSource,
    setBtRate,
    setBtDate,
    setBtSource,
  ]);
  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    const loadMe = async (force = false) => {
      try {
        const me = await fetchMeCached({ force });
        if (!aborted) {
          setIsAdmin(Boolean(me?.isAdmin));
          setEmail(me?.email ?? null);
        }
      } catch {
        if (!aborted) {
          setIsAdmin(false);
          setEmail(null);
        }
      }
    };
    // Restore last known DB status from localStorage (manual; no auto network call)
    try {
      const raw = localStorage.getItem(DB_LAST_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const ts = typeof cached?.ts === "number" ? cached.ts : null;
        const ok = typeof cached?.ok === "boolean" ? cached.ok : null;
        setDbLastCheckedAt(ts);
        setDbLastOk(ok);
        // Reflect cached fields into current UI
        setDbConnected(ok === true);
        setDbName(cached?.name ?? null);
        setDbLatency(
          typeof cached?.latency === "number" ? cached.latency : null
        );
        setDbLocation(cached?.location ?? null);
        setDbProvider(cached?.provider ?? null);
      }
    } catch {}
    // DB status is now manual; do not auto-check on mount/focus
    const loadBnr = async () => {
      try {
        const res = await fetch("/api/exchange/eurron", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted && data) {
          setBnrRate(typeof data.rate === "number" ? data.rate : null);
          setBnrDate(typeof data.date === "string" ? data.date : null);
          setBnrSource(typeof data.source === "string" ? data.source : null);
        }
      } catch {
        if (aborted) return;
        setBnrRate(null);
        setBnrDate(null);
        setBnrSource(null);
      }
    };
    const loadBt = async () => {
      try {
        const res = await fetch("/api/exchange/bt", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted && data) {
          setBtRate(typeof data.rate === "number" ? data.rate : null);
          setBtDate(typeof data.date === "string" ? data.date : null);
          setBtSource(typeof data.source === "string" ? data.source : null);
        }
      } catch {
        if (aborted) return;
        setBtRate(null);
        setBtDate(null);
        setBtSource(null);
      }
    };
    loadMe();
    loadBnr();
    loadBt();

    // Also refetch when tab regains focus to keep it fresh
    const onFocus = () => {
      // Refresh /api/me only if cache is stale (handled inside fetchMeCached)
      loadMe();
      loadBnr();
      loadBt();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      aborted = true;
      controller.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  // Manual DB check action (desktop + mobile)
  const checkDb = useCallback(async () => {
    if (checkingDb) return;
    setCheckingDb(true);
    try {
      const res = await fetch("/api/db/status", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDbConnected(Boolean(data.connected));
        setDbName(data?.db?.name ?? null);
        setDbLatency(
          typeof data?.latencyMs === "number" ? data.latencyMs : null
        );
        setDbLocation(data?.cluster?.location ?? null);
        setDbProvider(data?.cluster?.provider ?? null);
        // Persist last successful/failed check
        const now = Date.now();
        setDbLastCheckedAt(now);
        setDbLastOk(Boolean(data.connected));
        try {
          localStorage.setItem(
            DB_LAST_KEY,
            JSON.stringify({
              ts: now,
              ok: Boolean(data.connected),
              name: data?.db?.name ?? null,
              latency:
                typeof data?.latencyMs === "number" ? data.latencyMs : null,
              location: data?.cluster?.location ?? null,
              provider: data?.cluster?.provider ?? null,
            })
          );
        } catch {}
        try {
          window.dispatchEvent(
            new CustomEvent("app:toast", {
              detail: {
                type: "success",
                message: "Conexiunea la baza de date a fost verificată.",
              },
            })
          );
        } catch {}
      } else {
        setDbConnected(false);
        setDbName(null);
        setDbLatency(null);
        setDbLocation(null);
        setDbProvider(null);
        const now = Date.now();
        setDbLastCheckedAt(now);
        setDbLastOk(false);
        try {
          localStorage.setItem(
            DB_LAST_KEY,
            JSON.stringify({ ts: now, ok: false })
          );
        } catch {}
      }
    } catch {
      setDbConnected(false);
      setDbName(null);
      setDbLatency(null);
      setDbLocation(null);
      setDbProvider(null);
      const now = Date.now();
      setDbLastCheckedAt(now);
      setDbLastOk(false);
      try {
        localStorage.setItem(
          DB_LAST_KEY,
          JSON.stringify({ ts: now, ok: false })
        );
      } catch {}
    } finally {
      setCheckingDb(false);
    }
  }, [checkingDb]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-background sm:bg-background/80 sm:backdrop-blur sm:supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-foreground" />
            <span>RentApp</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-1">
            {links.map((l) => {
              const isActive =
                pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href + l.label}
                  href={l.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/5 ${
                    isActive ? "text-foreground" : "text-foreground/70"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin"
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/5 ${
                  pathname.startsWith("/admin")
                    ? "text-foreground"
                    : "text-foreground/70"
                }`}
              >
                Admin
              </Link>
            )}
          </div>

          {/* Desktop CTA */}
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5 inline-flex items-center gap-1"
                title={
                  mounted
                    ? theme === "light"
                      ? "Comută pe tema închisă"
                      : "Comută pe tema deschisă"
                    : "Comută tema"
                }
                aria-label="Comută tema"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden
                >
                  {mounted &&
                    (theme === "light" ? (
                      <path d="M12 18a6 6 0 100-12 6 6 0 000 12zm0 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm0-22a1 1 0 011-1V-1a1 1 0 10-2 0V0a1 1 0 011 1zm11 11a1 1 0 011 1h1a1 1 0 110 2h-1a1 1 0 11-2 0 1 1 0 011-1zM1 12a1 1 0 01-1-1H-1a1 1 0 100 2H0a1 1 0 011-1zm16.95 6.364a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.415l-.707-.708a1 1 0 010-1.414zM4.636 5.05a1 1 0 010-1.414l.707-.707A1 1 0 016.757 4.343l-.707.707A1 1 0 014.636 5.05zm14.142-2.121a1 1 0 010 1.414l-.707.707A1 1 0 0116.657 3.94l.707-.707a1 1 0 011.414 0zM5.343 18.95a1 1 0 010 1.414l-.707.707A1 1 0 112.222 19.95l.707-.707a1 1 0 011.414 0z" />
                    ) : (
                      <path d="M21 12.79A9 9 0 1111.21 3c.05-.34.79-.21.79-.21A7 7 0 1021 12.79z" />
                    ))}
                </svg>
                <span>
                  {mounted
                    ? theme === "light"
                      ? "Luminos"
                      : "Întunecat"
                    : "Tema"}
                </span>
              </button>
              {/* FX Refresh */}
              <button
                onClick={refreshFx}
                disabled={refreshingFx}
                className={`relative rounded-md border px-2 py-1 text-xs inline-flex items-center gap-1 transition-colors ${
                  refreshingFx
                    ? "border-foreground/30 text-foreground/40 cursor-wait"
                    : fxError
                    ? "border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    : "border-foreground/20 hover:bg-foreground/5"
                }`}
                title={
                  fxError === null
                    ? "Reîmprospătează cursurile EUR/RON (BNR + BT)"
                    : fxError === "both"
                    ? "Eroare la reîmprospătarea cursurilor BNR și BT"
                    : fxError === "bnr"
                    ? "Eroare la reîmprospătarea cursului BNR"
                    : "Eroare la reîmprospătarea cursului BT"
                }
                aria-label="Reîmprospătează cursurile EUR/RON"
              >
                {fxError && !refreshingFx && (
                  <span
                    className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow ring-2 ring-background"
                    aria-label="Eroare la reîmprospătare"
                  />
                )}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-4 w-4 ${refreshingFx ? "animate-spin" : ""}`}
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M4 10h8" />
                  <path d="M4 14h8" />
                  <path d="M12 6a4 4 0 110 12" />
                </svg>
                <span>EUR</span>
              </button>
              {/* DB status indicator */}
              <button
                type="button"
                onClick={checkDb}
                disabled={checkingDb}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                  checkingDb
                    ? "border-foreground/20 text-foreground/50 cursor-wait"
                    : "border-foreground/10 text-foreground/70 hover:bg-foreground/5"
                }`}
                title={
                  checkingDb
                    ? "Verific conexiunea la baza de date..."
                    : dbLastCheckedAt == null
                    ? "Click pentru a verifica conexiunea la baza de date"
                    : dbLastOk
                    ? `DB: ${dbName ?? "—"}${
                        dbLatency != null ? ` • ${dbLatency}ms` : ""
                      } • ${dbLocation ?? "?"}${
                        dbProvider
                          ? dbProvider === "atlas"
                            ? " (Atlas)"
                            : ""
                          : ""
                      }`
                    : "DB offline (click pentru verificare)"
                }
                aria-live="polite"
                aria-label="Verifică starea bazei de date"
              >
                <span
                  className={
                    "h-2 w-2 rounded-full " +
                    (checkingDb
                      ? "bg-foreground/40 animate-pulse"
                      : dbLastCheckedAt != null &&
                        Date.now() - dbLastCheckedAt > 12 * 3600 * 1000
                      ? "bg-blue-500"
                      : dbLastOk === true
                      ? "bg-emerald-500"
                      : dbLastOk === false
                      ? "bg-red-500"
                      : "bg-foreground/40")
                  }
                  aria-hidden="true"
                />
                <span>
                  DB{dbLastOk && dbLocation ? ` • ${dbLocation}` : ""}
                </span>
              </button>
              {/* BNR EUR/RON indicator */}
              <span
                className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[11px] text-foreground/70"
                title={
                  bnrRate != null
                    ? `BNR ${bnrDate ?? ""}${
                        bnrSource ? ` • ${bnrSource}` : ""
                      }${
                        hoursSince(bnrDate) ? ` • ${hoursSince(bnrDate)}` : ""
                      }`
                    : "Curs BNR indisponibil"
                }
                aria-live="polite"
              >
                <span
                  className="h-2 w-2 rounded-full bg-blue-500"
                  aria-hidden="true"
                />
                <span>
                  BNR{bnrRate != null ? ` • ${bnrRate.toFixed(4)}` : ""}
                </span>
              </span>
              {/* BT EUR sell indicator */}
              <span
                className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[11px] text-foreground/70"
                title={
                  btRate != null
                    ? `BT ${btDate ?? ""}${btSource ? ` • ${btSource}` : ""}${
                        hoursSince(btDate) ? ` • ${hoursSince(btDate)}` : ""
                      }`
                    : "Curs BT indisponibil"
                }
                aria-live="polite"
              >
                <span
                  className="h-2 w-2 rounded-full bg-fuchsia-500"
                  aria-hidden="true"
                />
                <span>BT{btRate != null ? ` • ${btRate.toFixed(4)}` : ""}</span>
              </span>
              {/* Removed Add Contract from navbar */}
              {email ? (
                <>
                  <span
                    className="text-xs text-foreground/70 truncate max-w-[18ch]"
                    title={email}
                  >
                    {email}
                  </span>
                  <form action="/api/logout" method="POST">
                    <button className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5">
                      Ieși
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm text-foreground/80 hover:underline"
                  >
                    Intră
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm text-foreground/80 hover:underline"
                  >
                    Înregistrare
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="sm:hidden inline-flex items-center justify-center rounded-md p-2 text-foreground/80 hover:bg-foreground/10 focus:outline-none"
            aria-label="Deschide meniul"
            aria-expanded={open}
          >
            <span className="sr-only">Meniu</span>
            {/* Hamburger / Close */}
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {open ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>
        {/* Mobile menu overlay + panel (opaque) */}
        {open && (
          <>
            {/* Backdrop to block content and close on click */}
            <div
              className="sm:hidden fixed inset-0 z-40 bg-white dark:bg-neutral-950"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            {/* Slide-down panel from under the navbar */}
            <div className="sm:hidden fixed inset-x-0 top-14 z-50 bg-white dark:bg-neutral-900 border-t border-foreground/10 shadow-md max-h-[calc(100vh-3.5rem)] overflow-y-auto">
              {/* Panel header with visible close button */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-foreground/10 bg-white/95 dark:bg-neutral-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:dark:bg-neutral-900/80">
                <span className="text-sm font-medium text-foreground/80">
                  Meniu
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5 text-foreground"
                  aria-label="Închide meniul"
                  title="Închide"
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
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  <span>Închide</span>
                </button>
              </div>
              <div className="pb-3">
                <div className="flex flex-col gap-1">
                  {/* DB status indicator (mobile) */}
                  <div className="px-3 py-2">
                    {/* Theme toggle (mobile) */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-foreground/70">Tema</span>
                      <button
                        onClick={toggleTheme}
                        className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5 inline-flex items-center gap-1"
                        title={
                          mounted
                            ? theme === "light"
                              ? "Comută pe tema închisă"
                              : "Comută pe tema deschisă"
                            : "Comută tema"
                        }
                        aria-label="Comută tema"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4"
                          aria-hidden
                        >
                          {mounted &&
                            (theme === "light" ? (
                              <path d="M12 18a6 6 0 100-12 6 6 0 000 12zm0 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm0-22a1 1 0 011-1V-1a1 1 0 10-2 0V0a1 1 0 011 1zm11 11a1 1 0 011 1h1a1 1 0 110 2h-1a1 1 0 11-2 0 1 1 0 011-1zM1 12a1 1 0 01-1-1H-1a1 1 0 100 2H0a1 1 0 011-1zm16.95 6.364a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.415l-.707-.708a1 1 0 010-1.414zM4.636 5.05a1 1 0 010-1.414l.707-.707A1 1 0 016.757 4.343l-.707.707A1 1 0 014.636 5.05zm14.142-2.121a1 1 0 010 1.414l-.707.707A1 1 0 0116.657 3.94l.707-.707a1 1 0 011.414 0zM5.343 18.95a1 1 0 010 1.414l-.707.707A1 1 0 112.222 19.95l.707-.707a1 1 0 011.414 0z" />
                            ) : (
                              <path d="M21 12.79A9 9 0 1111.21 3c.05-.34.79-.21.79-.21A7 7 0 1021 12.79z" />
                            ))}
                        </svg>
                        <span>
                          {mounted
                            ? theme === "light"
                              ? "Luminos"
                              : "Întunecat"
                            : "Tema"}
                        </span>
                      </button>
                    </div>
                    {/* FX refresh (mobile) */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-foreground/70">
                        Cursuri EUR
                      </span>
                      <button
                        onClick={refreshFx}
                        disabled={refreshingFx}
                        className={`relative rounded-md border px-2 py-1 text-[11px] inline-flex items-center gap-1 ${
                          refreshingFx
                            ? "border-foreground/30 text-foreground/40 cursor-wait"
                            : fxError
                            ? "border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                            : "border-foreground/20 hover:bg-foreground/5"
                        }`}
                        title={
                          fxError === null
                            ? "Reîmprospătează cursurile EUR/RON"
                            : fxError === "both"
                            ? "Eroare la reîmprospătarea cursurilor BNR și BT"
                            : fxError === "bnr"
                            ? "Eroare la reîmprospătarea cursului BNR"
                            : "Eroare la reîmprospătarea cursului BT"
                        }
                      >
                        {fxError && !refreshingFx && (
                          <span
                            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow ring-2 ring-background"
                            aria-label="Eroare la reîmprospătare"
                          />
                        )}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`h-4 w-4 ${
                            refreshingFx ? "animate-spin" : ""
                          }`}
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M4 10h8" />
                          <path d="M4 14h8" />
                          <path d="M12 6a4 4 0 110 12" />
                        </svg>
                        <span>EUR</span>
                      </button>
                    </div>
                    {/* BNR indicator (mobile) */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-foreground/70">
                        Curs BNR
                      </span>
                      <span
                        className="inline-flex items-center gap-1 rounded-md border border-foreground/15 bg-white dark:bg-neutral-950 px-2 py-1 text-[11px] text-foreground/70 shadow-sm"
                        title={
                          bnrRate != null
                            ? `BNR ${bnrDate ?? ""}${
                                bnrSource ? ` • ${bnrSource}` : ""
                              }${
                                hoursSince(bnrDate)
                                  ? ` • ${hoursSince(bnrDate)}`
                                  : ""
                              }`
                            : "Curs BNR indisponibil"
                        }
                        aria-live="polite"
                      >
                        <span
                          className="h-2 w-2 rounded-full bg-blue-500"
                          aria-hidden="true"
                        />
                        <span>
                          {bnrRate != null ? bnrRate.toFixed(4) : "—"}
                        </span>
                      </span>
                    </div>
                    {/* BT indicator (mobile) */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-foreground/70">
                        Curs BT
                      </span>
                      <span
                        className="inline-flex items-center gap-1 rounded-md border border-foreground/15 bg-white dark:bg-neutral-950 px-2 py-1 text-[11px] text-foreground/70 shadow-sm"
                        title={
                          btRate != null
                            ? `BT ${btDate ?? ""}${
                                btSource ? ` • ${btSource}` : ""
                              }${
                                hoursSince(btDate)
                                  ? ` • ${hoursSince(btDate)}`
                                  : ""
                              }`
                            : "Curs BT indisponibil"
                        }
                        aria-live="polite"
                      >
                        <span
                          className="h-2 w-2 rounded-full bg-fuchsia-500"
                          aria-hidden="true"
                        />
                        <span>{btRate != null ? btRate.toFixed(4) : "—"}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={checkDb}
                      disabled={checkingDb}
                      className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs text-foreground/70 shadow-sm ${
                        checkingDb
                          ? "border-foreground/20 bg-white/70 dark:bg-neutral-900/70 cursor-wait"
                          : "border-foreground/15 bg-white dark:bg-neutral-950 hover:bg-foreground/5"
                      }`}
                      title={
                        checkingDb
                          ? "Verific conexiunea la baza de date..."
                          : dbLastCheckedAt === null
                          ? "Atinge pentru a verifica conexiunea la baza de date"
                          : dbLastOk
                          ? `DB: ${dbName ?? "—"}${
                              dbLatency != null ? ` • ${dbLatency}ms` : ""
                            } • ${dbLocation ?? "?"}${
                              dbProvider
                                ? dbProvider === "atlas"
                                  ? " (Atlas)"
                                  : ""
                                : ""
                            }`
                          : "DB offline (atinge pentru verificare)"
                      }
                      aria-live="polite"
                      aria-label="Verifică starea bazei de date"
                    >
                      <span
                        className={
                          "h-2.5 w-2.5 rounded-full " +
                          (checkingDb
                            ? "bg-foreground/40 animate-pulse"
                            : dbLastCheckedAt != null &&
                              Date.now() - dbLastCheckedAt > 12 * 3600 * 1000
                            ? "bg-blue-500"
                            : dbLastOk === true
                            ? "bg-emerald-500"
                            : dbLastOk === false
                            ? "bg-red-500"
                            : "bg-foreground/40")
                        }
                        aria-hidden="true"
                      />
                      <span>
                        {dbLastOk
                          ? `Baza de date: conectat${
                              dbLocation
                                ? ` (${dbLocation}${
                                    dbProvider === "atlas" ? ", Atlas" : ""
                                  })`
                                : ""
                            }`
                          : checkingDb
                          ? "Baza de date: verific..."
                          : dbLastCheckedAt != null &&
                            Date.now() - dbLastCheckedAt > 12 * 3600 * 1000
                          ? "Baza de date: verificare veche (>12h)"
                          : "Baza de date: offline (atinge pentru verificare)"}
                      </span>
                    </button>
                  </div>
                  {links.map((l) => {
                    const isActive =
                      pathname === l.href || pathname.startsWith(l.href + "/");
                    return (
                      <Link
                        key={l.href + l.label}
                        href={l.href}
                        className={`rounded-md px-3 py-2 text-sm font-medium hover:bg-foreground/5 ${
                          isActive ? "text-foreground" : "text-foreground/70"
                        }`}
                      >
                        {l.label}
                      </Link>
                    );
                  })}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className={`rounded-md px-3 py-2 text-sm font-medium hover:bg-foreground/5 ${
                        pathname === "/admin"
                          ? "text-foreground"
                          : "text-foreground/70"
                      }`}
                    >
                      Admin
                    </Link>
                  )}
                  {email ? (
                    <div className="flex items-center justify-between gap-3 px-3 mt-2">
                      <span
                        className="text-xs text-foreground/70 truncate"
                        title={email}
                      >
                        {email}
                      </span>
                      <form action="/api/logout" method="POST">
                        <button className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5">
                          Ieși
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-3">
                      <Link
                        href="/login"
                        className="text-sm text-foreground/80 hover:underline"
                      >
                        Intră
                      </Link>
                      <Link
                        href="/register"
                        className="text-sm text-foreground/80 hover:underline"
                      >
                        Înregistrare
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </nav>
    </header>
  );
}
