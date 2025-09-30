import * as React from "react";
import ScanSection from "@/app/components/scan-section";
import Link from "next/link";
import { fetchContractById } from "@/lib/contracts";
import { getEuroInflationPercent } from "@/lib/inflation";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" }).format(
    n
  );
const fmtRON = (n: number) =>
  new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 2,
  }).format(n);

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await fetchContractById(id);
  if (!contract) return notFound();

  const isExpired = new Date(contract.endDate) < new Date();

  // Inflation since last indexing date or start date, up to current month
  let inflation: {
    percent: number;
    fromMonth: string;
    toMonth: string;
  } | null = null;
  try {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const from = (() => {
      const idxPast = (contract.indexingDates ?? [])
        .filter((d) => !!d && new Date(d) <= startOfToday)
        .sort();
      return idxPast.length > 0
        ? idxPast[idxPast.length - 1]
        : contract.startDate;
    })();
    const res = await getEuroInflationPercent({ from });
    inflation = {
      percent: res.percent,
      fromMonth: res.fromMonth,
      toMonth: res.toMonth,
    };
  } catch {}

  // Server action: force refresh inflation series and revalidate this page
  async function refreshInflation() {
    "use server";
    try {
      await getEuroInflationPercent({ from: "2000-01-01", forceRefresh: true });
    } catch {}
    revalidatePath(`/contracts/${id}`);
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm text-foreground/70 hover:underline">
          ← Înapoi la listă
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-fluid-4xl font-bold">{contract.name}</h1>
          <p className="text-base text-foreground/70">
            Partener: {contract.partner}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {process.env.MONGODB_URI ? (
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
              {contract.extensionDate ? (
                <div>
                  <dt className="text-foreground/60">Prelungire</dt>
                  <dd className="font-medium">{fmt(contract.extensionDate)}</dd>
                </div>
              ) : null}
              {typeof contract.paymentDueDays === "number" ? (
                <div>
                  <dt className="text-foreground/60">Termen plată</dt>
                  <dd className="font-medium">
                    {contract.paymentDueDays} zile de la facturare
                  </dd>
                </div>
              ) : null}
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
                      {(contract.amountEUR * contract.exchangeRateRON).toFixed(
                        2
                      )}{" "}
                      RON
                    </span>
                  </dd>
                  {typeof contract.correctionPercent === "number" &&
                  contract.correctionPercent > 0 ? (
                    <dd className="mt-1 flex flex-wrap items-center gap-3">
                      <span className="text-foreground/60">
                        Corecție {contract.correctionPercent}%
                      </span>
                      <span className="rounded-md bg-foreground/5 px-2 py-1 text-amber-700 dark:text-amber-400">
                        {(
                          contract.amountEUR *
                          contract.exchangeRateRON *
                          (contract.correctionPercent / 100)
                        ).toFixed(2)}{" "}
                        RON
                      </span>
                    </dd>
                  ) : null}
                  {typeof contract.correctionPercent === "number" ? (
                    <dd className="mt-1 flex flex-wrap items-center gap-3">
                      <span className="text-foreground/60">
                        RON (după corecție)
                      </span>
                      <span className="rounded-md bg-foreground/5 px-2 py-1 text-sky-700 dark:text-sky-400">
                        {(() => {
                          const base =
                            contract.amountEUR * contract.exchangeRateRON;
                          const corrected =
                            base *
                            (1 + (contract.correctionPercent ?? 0) / 100);
                          return corrected.toFixed(2);
                        })()}{" "}
                        RON
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
                          const base =
                            contract.amountEUR * contract.exchangeRateRON;
                          const corrected =
                            base *
                            (1 +
                              (typeof contract.correctionPercent === "number"
                                ? contract.correctionPercent
                                : 0) /
                                100);
                          return (
                            corrected *
                            (1 + contract.tvaPercent / 100)
                          ).toFixed(2);
                        })()}{" "}
                        RON
                      </span>
                      <span className="text-foreground/60">
                        <span className="text-rose-700 dark:text-rose-400">
                          {(() => {
                            const base =
                              contract.amountEUR * contract.exchangeRateRON;
                            const corrected =
                              base *
                              (1 +
                                (typeof contract.correctionPercent === "number"
                                  ? contract.correctionPercent
                                  : 0) /
                                  100);
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
              <div className="col-span-2">
                <dt className="text-foreground/60">Inflație EUR (HICP)</dt>
                {inflation ? (
                  <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span>{inflation.percent.toFixed(2)}%</span>
                    <span className="text-foreground/60">
                      ({inflation.fromMonth} → {inflation.toMonth})
                    </span>
                  </dd>
                ) : (
                  <dd className="mt-1 text-sm text-foreground/60 italic">
                    Indisponibil
                  </dd>
                )}
                <form action={refreshInflation} className="mt-2">
                  <button
                    type="submit"
                    className="rounded-md border border-foreground/20 px-2.5 py-1.5 text-xs font-semibold hover:bg-foreground/5"
                    title="Actualizează seria de inflație EUR (HICP)"
                  >
                    Actualizează inflația EUR
                  </button>
                </form>
              </div>
            </dl>
          </div>
        </div>

        <div className="lg:col-span-2">
          <ScanSection
            scanUrl={contract.scanUrl}
            contractName={contract.name}
          />
        </div>
      </section>

      {contract.rentType === "yearly" &&
      (contract.yearlyInvoices?.length ?? 0) > 0 ? (
        <section className="mt-8">
          <div className="rounded-lg border border-foreground/15 p-4">
            <h2 className="text-base font-semibold">Facturi anuale</h2>
            <div className="mt-3 grid grid-cols-1 gap-4">
              {contract.yearlyInvoices!.map((inv, idx) => {
                const eur = inv.amountEUR;
                const rate =
                  typeof contract.exchangeRateRON === "number"
                    ? contract.exchangeRateRON
                    : undefined;
                const corrPct =
                  typeof contract.correctionPercent === "number"
                    ? contract.correctionPercent
                    : 0;
                const tvaPct =
                  typeof contract.tvaPercent === "number"
                    ? contract.tvaPercent
                    : 0;
                const baseRon =
                  typeof rate === "number" ? eur * rate : undefined;
                const correctedEur = eur * (1 + corrPct / 100);
                const correctionRon =
                  typeof baseRon === "number"
                    ? baseRon * (corrPct / 100)
                    : undefined;
                const correctedRon =
                  typeof baseRon === "number"
                    ? baseRon * (1 + corrPct / 100)
                    : undefined;
                const vatAmount =
                  typeof correctedRon === "number"
                    ? correctedRon * (tvaPct / 100)
                    : undefined;
                const withVat =
                  typeof correctedRon === "number"
                    ? correctedRon * (1 + tvaPct / 100)
                    : undefined;
                const monthStr = String(inv.month).padStart(2, "0");
                const dayStr = String(inv.day).padStart(2, "0");
                return (
                  <div
                    key={`${idx}-${inv.month}-${inv.day}`}
                    className="rounded-md bg-foreground/5 p-3"
                  >
                    <div className="text-sm text-foreground/60">
                      Data: {dayStr}/{monthStr}
                    </div>
                    <div className="mt-1 space-y-1 text-sm">
                      <div>
                        <span className="text-foreground/60">EUR: </span>
                        <span className="font-medium text-indigo-700 dark:text-indigo-400">
                          {fmtEUR(eur)}
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground/60">RON: </span>
                        <span className="font-medium">
                          {typeof baseRon === "number"
                            ? fmtRON(baseRon)
                            : "Indisponibil"}
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground/60">
                          Corecție{corrPct ? ` (${corrPct}%)` : ""}:{" "}
                        </span>
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          {typeof correctionRon === "number"
                            ? fmtRON(correctionRon)
                            : "Indisponibil"}
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground/60">
                          EUR după corecție:{" "}
                        </span>
                        <span className="font-medium text-indigo-700 dark:text-indigo-400">
                          {fmtEUR(correctedEur)}
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground/60">
                          RON după corecție:{" "}
                        </span>
                        <span className="font-medium text-sky-700 dark:text-sky-400">
                          {typeof correctedRon === "number"
                            ? fmtRON(correctedRon)
                            : "Indisponibil"}
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground/60">
                          RON cu TVA{tvaPct ? ` (${tvaPct}%)` : ""}:{" "}
                        </span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">
                          {typeof withVat === "number"
                            ? fmtRON(withVat)
                            : "Indisponibil"}
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground/60">TVA: </span>
                        <span className="font-medium text-rose-700 dark:text-rose-400">
                          {typeof vatAmount === "number"
                            ? fmtRON(vatAmount)
                            : "Indisponibil"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

// (ScanSection moved to a client component in app/components/scan-section.tsx)
