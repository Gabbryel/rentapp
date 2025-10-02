import Link from "next/link";
import { listAssets } from "@/lib/assets";

export const dynamic = "force-dynamic";

export default async function AdminAssetsPage() {
  const assets = await listAssets();
  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">Assets</h1>
          <Link
            href="/admin/assets/new"
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-semibold text-background hover:bg-foreground/90"
          >
            Adaugă
          </Link>
        </div>
        <div className="mt-6 divide-y divide-foreground/10 rounded-md border border-foreground/10">
          {assets.length === 0 ? (
            <p className="p-4 text-sm text-foreground/60">Niciun asset.</p>
          ) : (
            assets.map((a) => (
              <Link
                key={a.id}
                href={`/admin/assets/${a.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-foreground/5"
              >
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-foreground/60">{a.address}</div>
                </div>
                <div className="text-xs text-foreground/60">
                  {a.scans.length} fișiere
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
