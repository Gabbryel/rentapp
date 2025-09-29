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
        <main className="min-h-screen px-4 sm:px-6 py-10">
          <h1 className="text-2xl sm:text-3xl font-bold">A apărut o eroare</h1>
          <p className="mt-2 text-foreground/70">{error.message}</p>
          <button
            onClick={() => reset()}
            className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90"
          >
            Reîncearcă
          </button>
        </main>
      </body>
    </html>
  );
}
