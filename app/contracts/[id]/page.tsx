import Image from "next/image";
import Link from "next/link";
import { deleteContractById, fetchContractById } from "@/lib/contracts";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import DeleteButton from "@/app/components/delete-button";
import { logAction, deleteLocalUploadIfPresent } from "@/lib/audit";

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
          <h1 className="text-3xl sm:text-4xl font-bold">{contract.name}</h1>
          <p className="text-base text-foreground/70">Partener: {contract.partner}</p>
        </div>
        <div className="flex items-center gap-3">
          {process.env.MONGODB_URI && process.env.MONGODB_DB ? (
            <Link
              href={`/contracts/${contract.id}/edit`}
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/5"
            >
              Editează
            </Link>
          ) : null}
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ring-1 ${
              isExpired
                ? "ring-red-500/20 text-red-600 dark:text-red-400"
                : "ring-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {isExpired ? "Expirat" : "Activ"}
          </span>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <div className="rounded-lg border border-foreground/15 p-4">
            <h2 className="text-base font-semibold">Detalii</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-base">
              <div>
                <dt className="text-foreground/60">Proprietar</dt>
                <dd className="font-medium">{contract.owner}</dd>
              </div>
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
              {typeof contract.amountEUR === "number" &&
              typeof contract.exchangeRateRON === "number" ? (
                <div className="col-span-2">
                  <dt className="text-foreground/60">Valoare</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-foreground/5 px-2 py-1 text-indigo-700 dark:text-indigo-400">
                      {contract.amountEUR.toFixed(2)} EUR
                    </span>
                    <span className="text-foreground/60">la curs</span>
                    <span className="rounded-md bg-foreground/5 px-2 py-1 text-cyan-700 dark:text-cyan-400">
                      {contract.exchangeRateRON.toFixed(4)} RON/EUR
                    </span>
                    <span className="text-foreground/60">≈</span>
                    <span className="rounded-md bg-foreground/5 px-2 py-1 text-sky-700 dark:text-sky-400">
                      {(contract.amountEUR * contract.exchangeRateRON).toFixed(2)} RON
                    </span>
                  </dd>
                  {typeof contract.correctionPercent === "number" && contract.correctionPercent > 0 ? (
                    <dd className="mt-1 flex flex-wrap items-center gap-3">
                      <span className="text-foreground/60">Corecție {contract.correctionPercent}%</span>
                      <span className="rounded-md bg-foreground/5 px-2 py-1 text-amber-700 dark:text-amber-400">
                        {(
                          contract.amountEUR *
                          contract.exchangeRateRON *
                          (contract.correctionPercent / 100)
                        ).toFixed(2)} RON
                      </span>
                    </dd>
                  ) : null}
                  {typeof contract.correctionPercent === "number" ? (
                    <dd className="mt-1 flex flex-wrap items-center gap-3">
                      <span className="text-foreground/60">RON (după corecție)</span>
                      <span className="rounded-md bg-foreground/5 px-2 py-1 text-sky-700 dark:text-sky-400">
                        {(() => {
                          const base = contract.amountEUR * contract.exchangeRateRON;
                          const corrected = base * (1 + (contract.correctionPercent ?? 0) / 100);
                          return corrected.toFixed(2);
                        })()} RON
                      </span>
                    </dd>
                  ) : null}
                  {typeof contract.tvaPercent === "number" &&
                  contract.tvaPercent > 0 ? (
                    <dd className="mt-1 flex flex-wrap items-center gap-3">
                      <span className="text-foreground/60">
                        RON (cu TVA {contract.tvaPercent}%)
                      </span>
                      <span className="rounded-md bg-foreground/5 px-2 py-1 text-emerald-700 dark:text-emerald-400">
                        {(() => {
                          const base = contract.amountEUR * contract.exchangeRateRON;
                          const corrected = base * (1 + (typeof contract.correctionPercent === "number" ? contract.correctionPercent : 0) / 100);
                          return (corrected * (1 + contract.tvaPercent / 100)).toFixed(2);
                        })()} {" "}
                        RON
                      </span>
                      <span className="text-foreground/60">
                        <span className="text-rose-700 dark:text-rose-400">
                          {(() => {
                            const base = contract.amountEUR * contract.exchangeRateRON;
                            const corrected = base * (1 + (typeof contract.correctionPercent === "number" ? contract.correctionPercent : 0) / 100);
                            const tva = corrected * (contract.tvaPercent / 100);
                            return `(TVA: ${tva.toFixed(2)} RON)`;
                          })()}
                        </span>
                      </span>
                    </dd>
                  ) : null}
                </div>
              ) : null}
              {contract.indexingDates && contract.indexingDates.length > 0 ? (
                <div className="col-span-2">
                  <dt className="text-foreground/60">Indexări chirie</dt>
                  <dd className="mt-1 flex flex-wrap gap-2 text-sm">
                    {contract.indexingDates.map((d) => (
                      <span
                        key={d}
                        className="rounded-md bg-foreground/5 px-2 py-1 text-xs"
                      >
                        {fmt(d)}
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-lg border border-foreground/15 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-foreground/10">
              <h2 className="text-base font-semibold">Scan contract</h2>
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
                      // Try to delete local scan file if applicable before removing DB record
                      const fileDeletion = await deleteLocalUploadIfPresent(
                        contract.scanUrl ?? undefined
                      );
                      const ok = await deleteContractById(contract.id);
                      if (!ok)
                        throw new Error("Nu am putut șterge contractul.");
                      await logAction({
                        action: "contract.delete",
                        targetType: "contract",
                        targetId: contract.id,
                        meta: {
                          name: contract.name,
                          deletedScan: fileDeletion,
                        },
                      });
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
