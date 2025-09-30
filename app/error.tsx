"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
          <div className="mx-auto max-w-screen-md">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
              A apărut o eroare
            </h1>
            <p className="text-foreground/70">
              Ne pare rău, ceva nu a mers bine.
            </p>
            <pre className="mt-3 overflow-auto rounded-md bg-foreground/5 p-3 text-xs text-foreground/70">
              {error?.message}
            </pre>
            <button
              className="mt-4 rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5"
              onClick={() => reset()}
            >
              Reîncearcă
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
