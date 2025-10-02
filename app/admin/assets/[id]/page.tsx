import Link from "next/link";
import { getAssetById } from "@/lib/assets";
import { notFound } from "next/navigation";
import AssetScans from "@/app/components/asset-scans";
import DeleteAssetClient from "./delete/DeleteAssetClient";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAssetById(id);
  if (!asset) return notFound();
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
        <AssetScans scans={asset.scans as any} assetName={asset.name} />
      </div>
    </main>
  );
}
