"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Modal({
  children,
  title,
  fallbackHref,
}: {
  children: React.ReactNode;
  title?: string;
  fallbackHref?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // Prefer going back to preserve background state
        router.back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => router.back()}
        aria-hidden
      />
      <div className="relative z-10 w-[92vw] max-w-2xl max-h-[90vh] overflow-auto rounded-xl border border-foreground/20 bg-background shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-foreground/10 bg-background/80 px-4 py-2 backdrop-blur">
          <h3 className="text-sm font-semibold truncate">{title ?? "Formular"}</h3>
          {fallbackHref ? (
            <Link
              href={fallbackHref}
              className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
            >
              Închide
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
            >
              Închide
            </button>
          )}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
