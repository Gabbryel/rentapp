"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string };
const navItems: NavItem[] = [
  { href: "/admin", label: "Panou" },
  { href: "/admin/contracts", label: "Contracte" },
  { href: "/admin/partners", label: "Parteneri" },
  { href: "/admin/users", label: "Utilizatori" },
  { href: "/admin/notifications", label: "Notificări" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="mt-4 space-y-1">
      {navItems.map((item) => {
        const active =
          pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`block rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-foreground/10 text-foreground font-semibold"
                : "text-foreground/80 hover:bg-foreground/5"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <div className="mt-3 pt-3 border-t border-foreground/10">
        <Link
          href="/"
          className="block rounded-md px-3 py-2 text-sm text-foreground/70 hover:bg-foreground/5"
        >
          ← Înapoi la site
        </Link>
      </div>
    </nav>
  );
}

export default function AdminSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-foreground/10 bg-background/80 backdrop-blur px-4 py-3">
        <div className="text-sm font-semibold">Admin</div>
        <button
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-medium hover:bg-foreground/5"
          onClick={() => setOpen(true)}
          aria-label="Deschide meniul"
        >
          Meniu
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:block h-screen sticky top-0 border-r border-foreground/10 bg-background/80 backdrop-blur">
        <div className="p-4">
          <div className="text-lg font-bold tracking-tight">Admin</div>
          <NavLinks />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] bg-background border-r border-foreground/10 shadow-xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">Admin</div>
              <button
                className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                onClick={() => setOpen(false)}
                aria-label="Închide meniul"
              >
                Închide
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
