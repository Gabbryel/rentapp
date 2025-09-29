"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const links = [
  { href: "/", label: "Contracte" },
  { href: "/about", label: "Despre" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  // Close menu on route change
  useEffect(() => setOpen(false), [pathname]);
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
    loadMe();

    // Also refetch when tab regains focus to keep it fresh
    const onFocus = () => loadMe();
    window.addEventListener("focus", onFocus);
    return () => {
      aborted = true;
      controller.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                l.href === "/"
                  ? pathname === "/" || pathname.startsWith("/contracts")
                  : pathname === l.href;
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
                  pathname === "/admin"
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
              <Link
                href="/contracts/new"
                className="rounded-full bg-foreground px-3.5 py-2 text-sm font-semibold text-background shadow-sm transition hover:bg-foreground/90"
              >
                Adaugă contract
              </Link>
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

        {/* Mobile menu */}
        {open && (
          <div className="sm:hidden pb-3">
            <div className="flex flex-col gap-1">
              {links.map((l) => {
                const isActive =
                  l.href === "/"
                    ? pathname === "/" || pathname.startsWith("/contracts")
                    : pathname === l.href;
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
              <Link
                href="/contracts/new"
                className="mt-1 rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background hover:bg-foreground/90"
              >
                Adaugă contract
              </Link>
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
        )}
      </nav>
    </header>
  );
}
