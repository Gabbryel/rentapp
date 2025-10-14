import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPartnerById } from "@/lib/partners";
import { listPartnerDocs } from "@/lib/partner-docs";
import DocsList from "@/app/components/docs-list";
import ContractScans from "@/app/components/contract-scans";
import AssetScans from "@/app/components/asset-scans";
import { getAssetById } from "@/lib/assets";
import { fetchContracts } from "@/lib/contracts";
import CardsGrid from "@/app/components/ui/cards-grid";
import Card from "@/app/components/ui/card";

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
    relatedContracts = all.filter((c) => {
      const ps = (c as any).partners as
        | Array<{ id?: string; name: string }>
        | undefined;
      if (ps && ps.length > 0) {
        if (ps.some((p) => p.id && p.id === partner.id)) return true;
        if (!ps.some((p) => p.id)) {
          return ps.some((p) => p.name === partner.name);
        }
      }
      return (
        (c.partnerId && c.partnerId === partner.id) ||
        (!c.partnerId && c.partner === partner.name)
      );
    });
  } catch {}

  // Load partner documents
  const docs = await listPartnerDocs(partner.id);

  // Build related scans from contracts and assets
  const contractDocs = relatedContracts
    .map((c) => {
      const raw = [
        ...(Array.isArray((c as any).scans)
          ? ((c as any).scans as { url: string; title?: string }[])
          : []),
        ...(c.scanUrl ? [{ url: String(c.scanUrl) }] : []),
      ];
      // Deduplicate by URL; prefer entries with titles
      const byUrl = new Map<string, { url: string; title?: string }>();
      for (const s of raw) {
        const u = String(s.url);
        const existing = byUrl.get(u);
        if (!existing) {
          byUrl.set(u, { url: u, title: s.title });
        } else if (!existing.title && s.title) {
          byUrl.set(u, { url: u, title: s.title });
        }
      }
      const scans = Array.from(byUrl.values());
      return { contract: c, scans } as const;
    })
    .filter((x) => x.scans.length > 0);

  const assetIds = Array.from(
    new Set(
      relatedContracts
        .map((c) => (c.assetId ? String(c.assetId) : null))
        .filter((v): v is string => Boolean(v))
    )
  );
  const assets = (
    await Promise.all(assetIds.map((aid) => getAssetById(aid)))
  ).filter(Boolean) as Awaited<ReturnType<typeof getAssetById>>[];
  const assetDocs = assets
    .map((a) => {
      const raw = Array.isArray(a?.scans) ? a!.scans : [];
      const byUrl = new Map<string, { url: string; title?: string }>();
      for (const s of raw) {
        const u = String(s.url);
        const existing = byUrl.get(u);
        if (!existing) byUrl.set(u, { url: u, title: s.title });
        else if (!existing.title && s.title)
          byUrl.set(u, { url: u, title: s.title });
      }
      const scans = Array.from(byUrl.values());
      return { asset: a!, scans };
    })
    .filter((x) => x.scans.length > 0);

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
      } else if (typeof (c as any).rentAmountEuro === "number") {
        monthlyEur = (c as any).rentAmountEuro;
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
      } else if (typeof (c as any).rentAmountEuro === "number") {
        yearlyEur = (c as any).rentAmountEuro * 12;
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
          className="rounded-md border border-foreground/20 p-2 text-foreground/80 hover:bg-foreground/5 inline-flex items-center"
          aria-label="Înapoi la parteneri"
          title="Înapoi la parteneri"
        >
          <span className="sr-only">Înapoi la parteneri</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-2 w-2"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        {process.env.MONGODB_URI ? (
          <Link
            href={`/admin/partners/${partner.id}`}
            className="rounded-md border border-foreground/20 p-2 text-foreground/80 hover:bg-foreground/5 inline-flex items-center"
            aria-label="Editează"
            title="Editează"
          >
            <span className="sr-only">Editează</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-2 w-2"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </Link>
        ) : null}
      </div>

      <header className="mb-6">
        <h1 className="text-fluid-4xl font-bold">{partner.name}</h1>
        <p className="mt-1 text-foreground/70">
          ID: <span className="text-xs">{partner.id}</span>
        </p>
      </header>

      <CardsGrid>
        <Card>
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
              <dt className="text-foreground/60">Actualizat</dt>
              <dd className="font-medium">{partner.updatedAt}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">Reprezentanți</h2>
          {Array.isArray((partner as any).representatives) &&
          (partner as any).representatives.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {(partner as any).representatives.map(
                (
                  r: {
                    fullname?: string | null;
                    phone?: string | null;
                    email?: string | null;
                  },
                  idx: number
                ) => (
                  <li
                    key={idx}
                    className="rounded-md bg-foreground/5 flex flex-col"
                  >
                    <div className="font-medium">{r.fullname || "—"}</div>
                    <div className="mt-1 grid grid-cols-1 gap-2 text-foreground/80">
                      <div>
                        <span className="text-foreground/60">Telefon:</span>{" "}
                        {r.phone ? (
                          <a
                            href={`tel:${r.phone}`}
                            className="hover:underline"
                          >
                            {r.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </div>
                      <div>
                        <span className="text-foreground/60">Email:</span>{" "}
                        {r.email ? (
                          <a
                            href={`mailto:${r.email}`}
                            className="hover:underline"
                          >
                            {r.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                  </li>
                )
              )}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-foreground/60">
              Niciun reprezentant definit.
            </p>
          )}
        </Card>
        <Card>
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
        </Card>
        <Card>
          <h2 className="text-base font-semibold">Documente</h2>
          <DocsList partnerId={partner.id} docs={docs} allowDelete={false} />
        </Card>
        <Card className="xl:col-span-2">
          <h2 className="text-base font-semibold">Documente asociate</h2>
          {contractDocs.length === 0 && assetDocs.length === 0 ? (
            <p className="mt-2 text-sm text-foreground/60">
              Nu există documente asociate din contracte sau asset-uri.
            </p>
          ) : (
            <div className="mt-3 space-y-6">
              {contractDocs.length > 0 && (
                <div>
                  <div className="text-sm text-foreground/60 mb-2">
                    Din contracte
                  </div>
                  <div className="space-y-4">
                    {contractDocs.map(({ contract: c, scans }) => (
                      <div
                        key={`c-${c.id}`}
                        className="rounded-md bg-foreground/5 p-3"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="font-medium">{c.name}</div>
                          <Link
                            href={`/contracts/${c.id}`}
                            className="rounded-md border border-foreground/20 p-1.5 text-foreground/80 hover:bg-foreground/5 inline-flex items-center"
                            aria-label="Deschide contract"
                            title="Deschide contract"
                          >
                            <span className="sr-only">Deschide contract</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-2 w-2"
                              aria-hidden="true"
                            >
                              <path d="M14 3h7v7" />
                              <path d="M10 14L21 3" />
                              <path d="M5 7v11a2 2 0 0 0 2 2h11" />
                            </svg>
                          </Link>
                        </div>
                        <ContractScans scans={scans} contractName={c.name} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {assetDocs.length > 0 && (
                <div>
                  <div className="text-sm text-foreground/60 mb-2">
                    Din asset-uri
                  </div>
                  <div className="space-y-4">
                    {assetDocs.map(({ asset: a, scans }) => (
                      <div
                        key={`a-${a.id}`}
                        className="rounded-md bg-foreground/5 p-3"
                      >
                        <div className="font-medium mb-2">{a.name}</div>
                        <AssetScans scans={scans} assetName={a.name} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </CardsGrid>
    </main>
  );
}
