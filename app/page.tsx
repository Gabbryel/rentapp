import Link from "next/link";
import { deleteContractById, fetchContracts } from "@/lib/contracts";
import SearchContracts from "@/app/components/search-contracts";
import DeleteButton from "@/app/components/delete-button";
import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const { q = "" } = (await searchParams) ?? {};
  const all = await fetchContracts();
  const query = q.trim().toLowerCase();
  const contracts = query
    ? all.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.partner.toLowerCase().includes(query) ||
          (c.owner?.toLowerCase?.().includes(query) ?? false)
      )
    : all;

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
          <p className="text-foreground/70">
            Placeholder-e pentru fiecare contract din baza de date
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <SearchContracts initialQuery={q} />
          <div className="text-sm text-foreground/60 shrink-0">
            Total: {contracts.length}
          </div>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {contracts.map((c) => (
          <article
            key={c.id}
            className="rounded-lg border border-foreground/15 p-4 hover:border-foreground/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold truncate" title={c.name}>
                <Link href={`/contracts/${c.id}`} className="hover:underline">
                  {c.name}
                </Link>
              </h2>
              <div className="flex items-center gap-2">
                {process.env.MONGODB_URI && process.env.MONGODB_DB ? (
                  <Link
                    href={`/contracts/${c.id}/edit`}
                    className="rounded-md border border-foreground/20 px-2 py-1 text-[10px] font-semibold hover:bg-foreground/5"
                  >
                    Edit
                  </Link>
                ) : null}
                {new Date(c.endDate) < now ? (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ring-1 ring-red-500/20 text-red-600 dark:text-red-400">
                    Expirat
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ring-1 ring-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    Activ
                  </span>
                )}
                {process.env.MONGODB_URI && process.env.MONGODB_DB ? (
                  <DeleteButton
                    label="Șterge"
                    action={async () => {
                      "use server";
                      const ok = await deleteContractById(c.id);
                      if (!ok) throw new Error("Nu am putut șterge contractul.");
                      redirect("/");
                    }}
                  />
                ) : null}
              </div>
            </div>
            <p
              className="mt-1 text-sm text-foreground/70 truncate"
              title={c.partner}
            >
              Partener: {c.partner}
            </p>
            <p className="mt-1 text-xs text-foreground/60 truncate" title={c.owner}>
              Proprietar: {c.owner ?? "Markov Services s.r.l."}
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
