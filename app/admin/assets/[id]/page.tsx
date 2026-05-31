import Link from "next/link";
import { getAssetById } from "@/lib/assets";
import { notFound } from "next/navigation";
import DeleteAssetClient from "./delete/DeleteAssetClient";
import { fetchContractsByAssetId, effectiveEndDate } from "@/lib/contracts";
import type { Contract as ContractType } from "@/lib/schemas/contract";
import Breadcrumb from "@/app/components/breadcrumb";
import PdfModal from "@/app/components/pdf-modal";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAssetById(id);
  if (!asset) return notFound();

  const contracts = await fetchContractsByAssetId(asset.id);
  const todayISO = new Date().toISOString().slice(0, 10);
  const activeContracts = contracts.filter((c) => effectiveEndDate(c) >= todayISO);
  const endedContracts = contracts.filter((c) => effectiveEndDate(c) < todayISO);

  function fmtDate(iso?: string | null) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("ro-RO", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }

  function scanLabel(url: string, title?: string) {
    if (title) return title;
    const parts = url.split("/");
    const last = parts[parts.length - 1];
    return last.length > 30 ? last.slice(0, 27) + "…" : last;
  }

  function scanIcon(url: string) {
    if (/\.pdf($|\?)/i.test(url) || url.includes("/api/uploads/")) return "📄";
    if (/\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(url)) return "🖼️";
    return "📎";
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Breadcrumb
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Assets", href: "/admin/assets" },
            { label: asset.name },
          ]}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{asset.name}</h1>
            {(asset.createdAt || asset.updatedAt) && (
              <p className="mt-1 text-xs text-foreground/40">
                {asset.createdAt && <>Creat {fmtDate(asset.createdAt)}</>}
                {asset.createdAt && asset.updatedAt && <span className="mx-1.5">·</span>}
                {asset.updatedAt && <>Actualizat {fmtDate(asset.updatedAt)}</>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/admin/assets/${asset.id}/edit`}
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/5"
            >
              Editează
            </Link>
            <DeleteAssetClient id={asset.id} name={asset.name} />
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Address */}
          <div className="rounded-xl border border-foreground/10 p-4 sm:col-span-2">
            <div className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1">
              Adresă
            </div>
            <div className="text-sm">{asset.address}</div>
          </div>

          {/* Owner */}
          {asset.owner && (
            <div className="rounded-xl border border-foreground/10 p-4">
              <div className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1">
                Proprietar
              </div>
              <Link
                href={`/admin/owners/${encodeURIComponent(asset.ownerId || asset.owner)}`}
                className="text-sm font-medium hover:underline decoration-dotted underline-offset-2"
              >
                {asset.owner.trim()}
              </Link>
            </div>
          )}

          {/* Area */}
          {typeof asset.areaSqm === "number" && (
            <div className="rounded-xl border border-foreground/10 p-4">
              <div className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-1">
                Suprafață
              </div>
              <div className="text-sm font-medium tabular-nums">
                {asset.areaSqm.toLocaleString("ro-RO")} mp
              </div>
            </div>
          )}
        </div>

        {/* Scans / files */}
        <div className="rounded-xl border border-foreground/10 p-4">
          <div className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-3">
            Fișiere ({asset.scans.length})
          </div>
          {asset.scans.length === 0 ? (
            <p className="text-sm text-foreground/40">
              Niciun fișier atașat.{" "}
              <Link
                href={`/admin/assets/${asset.id}/edit`}
                className="underline hover:text-foreground"
              >
                Adaugă din editare.
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {asset.scans.map((scan, i) => (
                <div
                  key={`${scan.url}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-foreground/8 bg-foreground/[0.02] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0">{scanIcon(scan.url)}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {scanLabel(scan.url, scan.title)}
                      </div>
                      <div className="text-xs text-foreground/40 font-mono truncate">
                        {scan.url}
                      </div>
                    </div>
                  </div>
                  <PdfModal
                    url={scan.url}
                    title={scan.title || scanLabel(scan.url, scan.title)}
                    buttonLabel="Deschide"
                    className="shrink-0 !text-xs !px-2.5 !py-1"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contracts */}
        {contracts.length > 0 && (
          <div className="rounded-xl border border-foreground/10 p-4">
            <div className="text-xs font-medium text-foreground/50 uppercase tracking-wide mb-3">
              Contracte ({contracts.length})
            </div>
            <div className="space-y-2">
              {activeContracts.length > 0 && (
                <>
                  <div className="text-xs text-foreground/40 mb-1">Active</div>
                  {activeContracts.map((c: ContractType) => (
                    <ContractRow key={c.id} contract={c} active />
                  ))}
                </>
              )}
              {endedContracts.length > 0 && (
                <>
                  <div className="text-xs text-foreground/40 mt-3 mb-1">Încheiate</div>
                  {endedContracts.map((c: ContractType) => (
                    <ContractRow key={c.id} contract={c} active={false} />
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ContractRow({
  contract,
  active,
}: {
  contract: ContractType;
  active: boolean;
}) {
  return (
    <Link
      href={`/contracts/${contract.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-foreground/8 bg-foreground/[0.02] px-3 py-2.5 hover:bg-foreground/5 transition-colors"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{contract.name}</div>
        {contract.partner && (
          <div className="text-xs text-foreground/50 truncate">{contract.partner}</div>
        )}
      </div>
      <span
        className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          active
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
            : "bg-foreground/5 text-foreground/40 border border-foreground/10"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-foreground/30"}`} />
        {active ? "Activ" : "Încheiat"}
      </span>
    </Link>
  );
}
