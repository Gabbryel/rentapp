"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  asideTitle?: string;
  asidePoints?: string[];
};

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  asideTitle = "Bine ați venit la RentApp",
  asidePoints = [
    "Gestionează contracte și facturi rapid",
    "Urcă documente și partajează în siguranță",
    "Acces securizat cu verificare email",
  ],
}: Props) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const switchHref = isLogin ? "/register" : "/login";
  const switchText = isLogin
    ? "Nu ai cont? Creează unul"
    : "Ai deja cont? Autentifică-te";
  return (
    <div className="min-h-dvh grid grid-cols-1 md:grid-cols-2">
      {/* Aside / Hero panel */}
      <div className="hidden md:flex relative items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-foreground/5 dark:to-foreground/10">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/70 px-3 py-1 text-xs font-semibold text-foreground/80 shadow-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
            RentApp
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
            {asideTitle}
          </h2>
          <ul className="mt-4 space-y-2 text-foreground/80">
            {asidePoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-foreground/50" />
                <span className="text-sm">{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 text-sm text-foreground/70">
            <Link href="/" className="underline">
              ← Înapoi la homepage
            </Link>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center px-4 py-10">
        <div className="absolute top-4 right-4 text-sm text-foreground/70">
          <Link className="hover:underline" href={switchHref}>
            {switchText}
          </Link>
        </div>
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-foreground/10 bg-background/80 backdrop-blur p-6 shadow-lg">
            <h1 className="text-2xl font-bold tracking-tight mb-1">{title}</h1>
            {subtitle ? (
              <p className="text-sm text-foreground/70 mb-4">{subtitle}</p>
            ) : null}
            <div className="grid gap-3">{children}</div>
            {footer ? (
              <div className="mt-4 border-t border-foreground/10 pt-3 text-sm text-foreground/80">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
