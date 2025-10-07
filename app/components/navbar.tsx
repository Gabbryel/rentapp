"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

const links = [
  { href: "/contracts", label: "Contracte" },
  { href: "/messages", label: "Mesaje" },
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
  const [bnrRate, setBnrRate] = useState<number | null>(null);
  const [bnrDate, setBnrDate] = useState<string | null>(null);
  const [bnrSource, setBnrSource] = useState<string | null>(null);
  const [btRate, setBtRate] = useState<number | null>(null);
  const [btDate, setBtDate] = useState<string | null>(null);
  const [btSource, setBtSource] = useState<string | null>(null);

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
        meta.setAttribute("content", theme === "light" ? "#f5f7fb" : "#051932");
      }
    } catch {
      // ignore
    }
  }, [theme]);

  // Keep in sync with system preference if user hasn't explicitly chosen
  useEffect(() => {
    const storageKey = "rentapp:theme";
    const mql =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: light)");
    if (!mql) return;
    const onChange = () => {
      const saved = localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark") return; // user preference wins
      setTheme(mql.matches ? "light" : "dark");
    };
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);
  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    const loadMe = async () => {
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted && data) {
          setIsAdmin(Boolean(data.isAdmin));
          setEmail(data.email ?? null);
        }
      } catch {
        // ignore
      }
    };
    const loadDb = async () => {
      try {
        const res = await fetch("/api/db/status", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (aborted) return;
        if (res.ok) {
          const data = await res.json();
          setDbConnected(Boolean(data.connected));
          setDbName(data?.db?.name ?? null);
          setDbLatency(
            typeof data?.latencyMs === "number" ? data.latencyMs : null
          );
          setDbLocation(data?.cluster?.location ?? null);
          setDbProvider(data?.cluster?.provider ?? null);
        } else {
          setDbConnected(false);
          setDbName(null);
          setDbLatency(null);
          setDbLocation(null);
          setDbProvider(null);
        }
      } catch {
        if (aborted) return;
        setDbConnected(false);
        setDbName(null);
        setDbLatency(null);
        setDbLocation(null);
        setDbProvider(null);
      }
    };
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
    loadDb();
    loadBnr();
    loadBt();

    // Also refetch when tab regains focus to keep it fresh
    const onFocus = () => {
      loadMe();
      loadDb();
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
                      // Sun icon
                      <path d="M12 18a6 6 0 100-12 6 6 0 000 12zm0 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm0-22a1 1 0 011-1V-1a1 1 0 10-2 0V0a1 1 0 011 1zm11 11a1 1 0 011 1h1a1 1 0 110 2h-1a1 1 0 11-2 0 1 1 0 011-1zM1 12a1 1 0 01-1-1H-1a1 1 0 100 2H0a1 1 0 011-1zm16.95 6.364a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.415l-.707-.708a1 1 0 010-1.414zM4.636 5.05a1 1 0 010-1.414l.707-.707A1 1 0 016.757 4.343l-.707.707A1 1 0 014.636 5.05zm14.142-2.121a1 1 0 010 1.414l-.707.707A1 1 0 0116.657 3.94l.707-.707a1 1 0 011.414 0zM5.343 18.95a1 1 0 010 1.414l-.707.707A1 1 0 112.222 19.95l.707-.707a1 1 0 011.414 0z" />
                    ) : (
                      // Moon icon
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
              {/* DB status indicator */}
              <span
                className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[11px] text-foreground/70"
                title={
                  dbConnected === null
                    ? "Verific conexiunea la baza de date..."
                    : dbConnected
                    ? `DB: ${dbName ?? "—"}${
                        dbLatency != null ? ` • ${dbLatency}ms` : ""
                      } • ${dbLocation ?? "?"}${
                        dbProvider
                          ? dbProvider === "atlas"
                            ? " (Atlas)"
                            : ""
                          : ""
                      }`
                    : "DB offline"
                }
                aria-live="polite"
              >
                <span
                  className={
                    "h-2 w-2 rounded-full " +
                    (dbConnected === null
                      ? "bg-foreground/40"
                      : dbConnected
                      ? "bg-emerald-500"
                      : "bg-red-500")
                  }
                  aria-hidden="true"
                />
                <span>
                  DB{dbConnected && dbLocation ? ` • ${dbLocation}` : ""}
                </span>
              </span>
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
              className="sm:hidden fixed inset-0 z-40 bg-background"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            {/* Slide-down panel from under the navbar */}
            <div className="sm:hidden fixed inset-x-0 top-14 z-50 bg-background border-t border-foreground/10 shadow-md max-h-[calc(100vh-3.5rem)] overflow-y-auto">
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
                    {/* BNR indicator (mobile) */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-foreground/70">
                        Curs BNR
                      </span>
                      <span
                        className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[11px] text-foreground/70"
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
                        className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[11px] text-foreground/70"
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
                    <span
                      className="inline-flex items-center gap-2 rounded-md border border-foreground/10 px-2 py-1 text-xs text-foreground/70"
                      title={
                        dbConnected === null
                          ? "Verific conexiunea la baza de date..."
                          : dbConnected
                          ? `DB: ${dbName ?? "—"}${
                              dbLatency != null ? ` • ${dbLatency}ms` : ""
                            } • ${dbLocation ?? "?"}${
                              dbProvider
                                ? dbProvider === "atlas"
                                  ? " (Atlas)"
                                  : ""
                                : ""
                            }`
                          : "DB offline"
                      }
                      aria-live="polite"
                    >
                      <span
                        className={
                          "h-2.5 w-2.5 rounded-full " +
                          (dbConnected === null
                            ? "bg-foreground/40"
                            : dbConnected
                            ? "bg-emerald-500"
                            : "bg-red-500")
                        }
                        aria-hidden="true"
                      />
                      <span>
                        {dbConnected
                          ? `Baza de date: conectat${
                              dbLocation
                                ? ` (${dbLocation}${
                                    dbProvider === "atlas" ? ", Atlas" : ""
                                  })`
                                : ""
                            }`
                          : dbConnected === null
                          ? "Baza de date: verific..."
                          : "Baza de date: offline"}
                      </span>
                    </span>
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
