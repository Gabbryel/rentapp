import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPartnerById } from "@/lib/partners";
import { listPartnerDocs } from "@/lib/partner-docs";
import DocsList from "@/app/components/docs-list";
import { fetchContracts } from "@/lib/contracts";

export default async function PartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await fetchPartnerById(id);
  if (!partner) return notFound();

  // Try to list related contracts by partnerId or fallback to name
  let relatedContracts: Awaited<ReturnType<typeof fetchContracts>> = [];
  try {
    const all = await fetchContracts();
    relatedContracts = all.filter(
      (c) =>
        (c.partnerId && c.partnerId === partner.id) ||
        (!c.partnerId && c.partner === partner.name)
    );
  } catch {}

  // Load partner documents
  const docs = await listPartnerDocs(partner.id);

  // Formatting helpers
  const fmtEUR = (n: number) =>
    new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency: "EUR",
    }).format(n);
  const fmtRON = (n: number) =>
    new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency: "RON",
      maximumFractionDigits: 2,
    }).format(n);

  // Aggregates: monthly-equivalent and yearly for this partner (EUR, RON base, RON corrected; no VAT)
  const monthlyEqTotals = relatedContracts.reduce(
    (acc, c) => {
      let monthlyEur = 0;
      if (c.rentType === "yearly") {
        const sumYear = (c.yearlyInvoices ?? []).reduce(
          (s, r) => s + (r.amountEUR || 0),
          0
        );
        monthlyEur = sumYear > 0 ? sumYear / 12 : 0;
      } else if (typeof c.amountEUR === "number") {
        monthlyEur = c.amountEUR;
      }
      acc.eur += monthlyEur;
      if (monthlyEur > 0 && typeof c.exchangeRateRON === "number") {
        const baseRon = monthlyEur * c.exchangeRateRON;
        const corrPct =
          typeof c.correctionPercent === "number" ? c.correctionPercent : 0;
        const corrected = baseRon * (1 + corrPct / 100);
        acc.ronBase += baseRon;
        acc.ronCorrected += corrected;
      }
      return acc;
    },
    { eur: 0, ronBase: 0, ronCorrected: 0 }
  );

  const yearlyTotals = relatedContracts.reduce(
    (acc, c) => {
      let yearlyEur = 0;
      if (c.rentType === "yearly") {
        yearlyEur = (c.yearlyInvoices ?? []).reduce(
          (s, r) => s + (r.amountEUR || 0),
          0
        );
      } else if (typeof c.amountEUR === "number") {
        yearlyEur = c.amountEUR * 12;
      }
      acc.eur += yearlyEur;
      if (yearlyEur > 0 && typeof c.exchangeRateRON === "number") {
        const baseRon = yearlyEur * c.exchangeRateRON;
        const corrPct =
          typeof c.correctionPercent === "number" ? c.correctionPercent : 0;
        const corrected = baseRon * (1 + corrPct / 100);
        acc.ronBase += baseRon;
        acc.ronCorrected += corrected;
      }
      return acc;
    },
    { eur: 0, ronBase: 0, ronCorrected: 0 }
  );

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/admin/partners"
          className="text-sm text-foreground/70 hover:underline"
        >
          ← Înapoi la parteneri
        </Link>
        {process.env.MONGODB_URI ? (
          <Link
            href={`/admin/partners/${partner.id}`}
            className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/5"
          >
            Editează
          </Link>
        ) : null}
      </div>

      <header>
        <h1 className="text-fluid-4xl font-bold">{partner.name}</h1>
        <p className="mt-1 text-foreground/70">
          ID: <span className="font-mono text-xs">{partner.id}</span>
        </p>
      </header>

      <section className="mt-6">
        <div className="rounded-lg border border-foreground/15 p-4">
          <h2 className="text-base font-semibold">Detalii</h2>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <dt className="text-foreground/60">CUI</dt>
              <dd className="font-medium">{partner.vatNumber}</dd>
            </div>
            <div>
              <dt className="text-foreground/60">Nr. ORC</dt>
              <dd className="font-medium">{partner.orcNumber}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-foreground/60">Sediu</dt>
              <dd className="font-medium">{partner.headquarters}</dd>
            </div>
            <div>
              <dt className="text-foreground/60">Creat</dt>
              <dd className="font-medium">{partner.createdAt}</dd>
            </div>
            <div>
              <dt className="text-foreground/60">Actualizat</dt>
              <dd className="font-medium">{partner.updatedAt}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-8">
        <div className="rounded-lg border border-foreground/15 p-4">
          <h2 className="text-base font-semibold">Totaluri</h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-md bg-foreground/5 p-3">
              <div className="text-foreground/60 text-xs uppercase tracking-wide">
                Lunar (echivalent)
              </div>
              <div className="mt-2 space-y-1">
                <div>
                  <span className="text-foreground/60">EUR:</span>{" "}
                  <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                    {fmtEUR(monthlyEqTotals.eur)}
                  </span>
                </div>
                <div>
                  <span className="text-foreground/60">
                    RON (fără corecție):
                  </span>{" "}
                  <span className="font-semibold">
                    {fmtRON(monthlyEqTotals.ronBase)}
                  </span>
                </div>
                <div>
                  <span className="text-foreground/60">RON după corecție:</span>{" "}
                  <span className="font-semibold text-sky-700 dark:text-sky-400">
                    {fmtRON(monthlyEqTotals.ronCorrected)}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-md bg-foreground/5 p-3">
              <div className="text-foreground/60 text-xs uppercase tracking-wide">
                Total anual
              </div>
              <div className="mt-2 space-y-1">
                <div>
                  <span className="text-foreground/60">EUR:</span>{" "}
                  <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                    {fmtEUR(yearlyTotals.eur)}
                  </span>
                </div>
                <div>
                  <span className="text-foreground/60">
                    RON (fără corecție):
                  </span>{" "}
                  <span className="font-semibold">
                    {fmtRON(yearlyTotals.ronBase)}
                  </span>
                </div>
                <div>
                  <span className="text-foreground/60">RON după corecție:</span>{" "}
                  <span className="font-semibold text-sky-700 dark:text-sky-400">
                    {fmtRON(yearlyTotals.ronCorrected)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="rounded-lg border border-foreground/15 p-4">
          <h2 className="text-base font-semibold">Contracte</h2>
          {relatedContracts.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {relatedContracts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-md bg-foreground/5 px-3 py-2"
                >
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-foreground/60">{c.id}</div>
                  </div>
                  <Link
                    href={`/contracts/${c.id}`}
                    className="text-sm text-foreground/80 hover:underline"
                  >
                    Deschide
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-foreground/60">
              Nu există contracte asociate.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="rounded-lg border border-foreground/15 p-4">
          <h2 className="text-base font-semibold">Documente</h2>
          <DocsList partnerId={partner.id} docs={docs} allowDelete={false} />
          {/* Camera scan is admin-only, kept on edit page */}
        </div>
      </section>
    </main>
  );
}
