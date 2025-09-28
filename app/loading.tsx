export default function Loading() {
  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-screen-2xl">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Contracte
        </h1>
        <div className="mt-2 flex items-center gap-3">
          <p className="text-foreground/70">Se încarcă contractele…</p>
          <div className="h-9 w-80 max-w-full rounded-md bg-foreground/10" />
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-foreground/10 p-4 sm:p-5 animate-pulse bg-background/60 shadow-sm"
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
      </div>
    </main>
  );
}
