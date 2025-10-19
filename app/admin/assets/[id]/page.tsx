import Link from "next/link";
import { getAssetById } from "@/lib/assets";
import { notFound } from "next/navigation";
import AssetScans from "@/app/components/asset-scans";
import DeleteAssetClient from "./delete/DeleteAssetClient";
import { fetchContractsByAssetId } from "@/lib/contracts";
import { Contract } from "@/lib/schemas/contract";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAssetById(id);
  if (!asset) return notFound();
  const contracts = await fetchContractsByAssetId(asset.id);
  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          <div className="flex items-center gap-3">
            <DeleteAssetClient id={asset.id} name={asset.name} />
            <Link
              href={`/admin/assets/${asset.id}/edit`}
              className="rounded-md border border-foreground/20 px-2.5 py-1.5 text-xs font-semibold hover:bg-foreground/5"
            >
              Editează
            </Link>
            <Link
              href="/admin/assets"
              className="text-sm text-foreground/70 hover:underline"
            >
              Înapoi
            </Link>
          </div>
        </div>
        <div className="rounded-md border border-foreground/10 p-4">
          <div className="text-sm text-foreground/60">Adresă</div>
          <div className="mt-1">{asset.address}</div>
        </div>
        {(asset as any).owner && (
          <div className="rounded-md border border-foreground/10 p-4">
            <div className="text-sm text-foreground/60">Proprietar</div>
            <div className="mt-1">
              <Link href={`/owners/${encodeURIComponent((asset as any).ownerId || (asset as any).owner)}`} className="hover:underline">
                {(asset as any).owner}
              </Link>
            </div>
          </div>
        )}
        {typeof (asset as any).areaSqm === "number" && (
          <div className="rounded-md border border-foreground/10 p-4">
            <div className="text-sm text-foreground/60">Suprafață</div>
            <div className="mt-1">{(asset as any).areaSqm} mp</div>
          </div>
        )}
        {contracts.length > 0 && (
          <div className="rounded-md border border-foreground/10 p-4">
            <div className="text-sm text-foreground/60">
              Contract(e) asociat(e)
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {contracts.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}`}
                  className="text-sm text-foreground/80 hover:underline"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-foreground/60">
                    {c.partner ?? ""}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
        <AssetScans scans={asset.scans as any} assetName={asset.name} />
      </div>
    </main>
  );
}
