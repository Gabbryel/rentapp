import Image from "next/image";
import Link from "next/link";
import { deleteContractById, fetchContractById } from "@/lib/contracts";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import DeleteButton from "@/app/components/delete-button";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await fetchContractById(id);
  if (!contract) return notFound();

  const isExpired = new Date(contract.endDate) < new Date();

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm text-foreground/70 hover:underline">
          ← Înapoi la listă
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{contract.name}</h1>
          <p className="text-foreground/70">Partener: {contract.partner}</p>
        </div>
        <span
          className={`shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ring-1 ${
            isExpired
              ? "ring-red-500/20 text-red-600 dark:text-red-400"
              : "ring-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {isExpired ? "Expirat" : "Activ"}
        </span>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <div className="rounded-lg border border-foreground/15 p-4">
            <h2 className="text-sm font-semibold">Detalii</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-foreground/60">Semnat</dt>
                <dd className="font-medium">{fmt(contract.signedAt)}</dd>
              </div>
              <div>
                <dt className="text-foreground/60">Început</dt>
                <dd className="font-medium">{fmt(contract.startDate)}</dd>
              </div>
              <div>
                <dt className="text-foreground/60">Expiră</dt>
                <dd className="font-medium">{fmt(contract.endDate)}</dd>
              </div>
              <div>
                <dt className="text-foreground/60">ID</dt>
                <dd className="font-mono text-xs text-foreground/80">
                  {contract.id}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-lg border border-foreground/15 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-foreground/10">
              <h2 className="text-sm font-semibold">Scan contract</h2>
              <div className="flex items-center gap-3">
                {contract.scanUrl && (
                  <a
                    href={contract.scanUrl}
                    download
                    className="text-sm text-foreground/70 hover:underline"
                  >
                    Descarcă
                  </a>
                )}
                {process.env.MONGODB_URI && process.env.MONGODB_DB ? (
                  <DeleteButton
                    label="Șterge"
                    action={async () => {
                      "use server";
                      const ok = await deleteContractById(contract.id);
                      if (!ok) throw new Error("Nu am putut șterge contractul.");
                      redirect("/");
                    }}
                  />
                ) : null}
              </div>
            </div>
            <div className="bg-foreground/5">
              {contract.scanUrl ? (
                /\.pdf(?:$|[?#])/i.test(contract.scanUrl) ? (
                  <object
                    data={contract.scanUrl}
                    type="application/pdf"
                    className="w-full aspect-[4/3]"
                  >
                    <iframe
                      src={contract.scanUrl}
                      title={`Scan contract ${contract.name}`}
                      className="w-full h-full"
                    />
                  </object>
                ) : (
                  <Image
                    src={contract.scanUrl}
                    alt={`Scan contract ${contract.name}`}
                    width={1600}
                    height={1000}
                    className="w-full h-auto"
                  />
                )
              ) : (
                <div className="aspect-[4/3] grid place-items-center text-foreground/60">
                  Niciun scan disponibil
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
