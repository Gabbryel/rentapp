import { fetchContracts } from "@/lib/contracts";

export default async function Home() {
  const contracts = await fetchContracts();

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("ro-RO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });

  const now = new Date();

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Contracte</h1>
          <p className="text-foreground/70">Placeholder-e pentru fiecare contract din baza de date</p>
        </div>
        <div className="text-sm text-foreground/60">Total: {contracts.length}</div>
      </header>

      <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {contracts.map((c) => (
          <article
            key={c.id}
            className="rounded-lg border border-foreground/15 p-4 hover:border-foreground/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold truncate" title={c.name}>
                {c.name}
              </h2>
              {new Date(c.endDate) < now ? (
                <span className="shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ring-1 ring-red-500/20 text-red-600 dark:text-red-400">
                  Expirat
                </span>
              ) : (
                <span className="shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  Activ
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-foreground/70 truncate" title={c.partner}>
              Partener: {c.partner}
            </p>

            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-md bg-foreground/5 p-3">
                <dt className="text-foreground/60">Semnat</dt>
                <dd className="font-medium">{fmt(c.signedAt)}</dd>
              </div>
              <div className="rounded-md bg-foreground/5 p-3">
                <dt className="text-foreground/60">Început</dt>
                <dd className="font-medium">{fmt(c.startDate)}</dd>
              </div>
              <div className="rounded-md bg-foreground/5 p-3">
                <dt className="text-foreground/60">Expiră</dt>
                <dd className="font-medium">{fmt(c.endDate)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </main>
  );
}
