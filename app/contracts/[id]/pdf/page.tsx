import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchContractById } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  id: string;
}

export default async function ContractPdfPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const contract = await fetchContractById(id);
  if (!contract) return notFound();

  const safeId = encodeURIComponent(id);
  const timestamp = Date.now();
  const pdfUrl = `/contracts/${safeId}/export?ts=${timestamp}`;
  const title = contract.name || `Contract ${id}`;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col gap-2">
          <Link
            href={`/contracts/${safeId}`}
            className="text-sm text-foreground/70 hover:underline"
          >
            ← Înapoi la contract
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-foreground/60">
              Vizualizare PDF pentru contractul {title}.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-foreground/15 bg-background/60 shadow-sm">
          <iframe
            src={pdfUrl}
            title={`Contract ${title} - PDF`}
            className="h-[calc(100vh-220px)] w-full rounded-lg border-0"
            loading="lazy"
          />
        </div>
        <p className="text-sm text-foreground/60">
          Dacă documentul nu se încarcă în fereastră, poți{" "}
          <Link
            href={`/contracts/${safeId}/export`}
            prefetch={false}
            className="text-foreground hover:underline"
          >
            descărca PDF-ul într-o filă separată
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
