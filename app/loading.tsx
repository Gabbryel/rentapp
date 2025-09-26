export default function Loading() {
  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <h1 className="text-2xl sm:text-3xl font-bold">Contracte</h1>
      <p className="mt-1 text-foreground/70">Se încarcă contractele…</p>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-foreground/10 p-4 animate-pulse"
          >
            <div className="h-5 w-2/3 rounded bg-foreground/10" />
            <div className="mt-2 h-4 w-1/2 rounded bg-foreground/10" />
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="h-12 rounded bg-foreground/10" />
              <div className="h-12 rounded bg-foreground/10" />
              <div className="h-12 rounded bg-foreground/10" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
