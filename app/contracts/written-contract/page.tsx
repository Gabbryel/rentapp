import Link from "next/link";
import { fetchContractById } from "@/lib/contracts";
import { fetchOwners } from "@/lib/owners";
import { fetchPartners } from "@/lib/partners";
import { listAssets } from "@/lib/assets";
import WrittenContractForm from "./written-contract-form";
import { getWrittenContractById } from "@/lib/written-contracts";
import type { WrittenContract } from "@/lib/schemas/written-contract";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WrittenContractPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const contractIdParam = resolvedParams?.contractId;
  const contractIdFromQuery = Array.isArray(contractIdParam)
    ? contractIdParam[0]
    : contractIdParam;

  const writtenContractParam = resolvedParams?.writtenContractId;
  const writtenContractId = Array.isArray(writtenContractParam)
    ? writtenContractParam[0]
    : writtenContractParam;

  let initialDocument: WrittenContract | null = null;
  if (writtenContractId) {
    try {
      initialDocument = await getWrittenContractById(writtenContractId);
    } catch (error) {
      console.warn("Nu am putut încărca documentul scris", {
        writtenContractId,
        error,
      });
    }
  }

  const contractId = initialDocument?.contractId ?? contractIdFromQuery ?? null;

  let contract = null;
  if (contractId) {
    try {
      contract = await fetchContractById(contractId);
    } catch (error) {
      console.warn("Nu am putut încărca contractul pentru contractId", {
        contractId,
        error,
      });
    }
  }

  const [owners, partners, assets] = await Promise.all([
    fetchOwners(),
    fetchPartners(),
    listAssets(),
  ]);

  return (
    <main className="mx-auto max-w-[1600px] px-6 lg:px-12 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Contract scris</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Verifică și actualizează detaliile înainte de a genera documentul
            final. Valorile sunt completate automat din contract.
          </p>
        </div>
        {contractId ? (
          <Link
            href={`/contracts/${encodeURIComponent(contractId)}`}
            className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-foreground/5"
          >
            Înapoi la contract
          </Link>
        ) : (
          <Link
            href="/admin/written-contracts"
            className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-foreground/5"
          >
            Înapoi la contracte
          </Link>
        )}
      </div>
      {writtenContractId && !initialDocument ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
          Documentul scris solicitat nu a fost găsit. Poți continua cu un
          document nou sau alege un alt contract.
        </div>
      ) : null}
      <WrittenContractForm
        initialContract={contract}
        initialDocument={initialDocument}
        owners={owners}
        partners={partners}
        assets={assets}
      />
    </main>
  );
}
