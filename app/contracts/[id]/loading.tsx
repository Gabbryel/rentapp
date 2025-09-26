export default function Loading() {
  return (
    <main className="min-h-screen px-4 sm:px-6 py-10 animate-pulse">
      <div className="h-5 w-40 rounded bg-foreground/10" />
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <div className="rounded-lg border border-foreground/15 p-4">
            <div className="h-5 w-28 rounded bg-foreground/10" />
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-16 rounded bg-foreground/10" />
                  <div className="h-4 w-24 rounded bg-foreground/10" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-foreground/15 overflow-hidden">
            <div className="h-9 bg-foreground/5" />
            <div className="aspect-[4/3] bg-foreground/5" />
          </div>
        </div>
      </div>
    </main>
  );
}
