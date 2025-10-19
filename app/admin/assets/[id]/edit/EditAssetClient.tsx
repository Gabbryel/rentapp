"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateAssetAction, type FormState } from "./actions";
import OwnerSelect from "@/app/components/owner-select";

export default function EditAssetClient({
  asset,
}: {
  asset: {
    id: string;
    name: string;
    address: string;
    scans: { url: string; title?: string }[];
    areaSqm?: number;
    ownerId?: string;
    owner?: string;
  };
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateAssetAction,
    {
      ok: false,
      values: {},
    }
  );
  if (state?.ok && state.redirectTo) {
    window.location.href = state.redirectTo;
  }
  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Editează asset</h1>
          <Link
            href={`/admin/assets/${asset.id}`}
            className="text-sm text-foreground/70 hover:underline"
          >
            Înapoi
          </Link>
        </div>
        <form action={formAction} className="space-y-4">
          {state.message ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {state.message}
            </div>
          ) : null}
          <input type="hidden" name="id" defaultValue={asset.id} />
          <div>
            <label className="block text-sm font-medium">Nume</label>
            <input
              name="name"
              defaultValue={asset.name}
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Adresă</label>
            <input
              name="address"
              defaultValue={asset.address}
              required
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Proprietar</label>
            <OwnerSelect idName="ownerId" nameName="owner" defaultId={asset.ownerId} defaultName={asset.owner} required />
          </div>
          <div>
            <label className="block text-sm font-medium">Suprafață (mp)</label>
            <input
              name="areaSqm"
              type="number"
              step="0.01"
              min="0"
              defaultValue={asset.areaSqm ?? ""}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <fieldset className="rounded-md border border-foreground/10 p-3">
            <legend className="px-1 text-xs text-foreground/60">
              Scan-uri existente
            </legend>
            <div className="space-y-2">
              {asset.scans.length === 0 ? (
                <div className="text-sm text-foreground/60">Niciun fișier</div>
              ) : (
                asset.scans.map((s, i) => (
                  <div
                    key={`${s.url}-${i}`}
                    className="rounded-md border border-foreground/10 p-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                      <div className="sm:col-span-2 min-w-0">
                        <label className="block text-xs text-foreground/60">
                          Titlu
                        </label>
                        <input
                          name="existingTitle"
                          defaultValue={s.title || ""}
                          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                        />
                        <input type="hidden" name="existingUrl" value={s.url} />
                        <div
                          className="mt-1 truncate text-xs text-foreground/60"
                          title={s.url}
                        >
                          {s.url}
                        </div>
                      </div>
                      <div className="sm:text-right">
                        <label className="inline-flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            name="existingRemoveIdx"
                            value={String(i)}
                            className="rounded border-foreground/20"
                          />
                          Elimină
                        </label>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </fieldset>
          <fieldset className="rounded-md border border-foreground/10 p-3">
            <legend className="px-1 text-xs text-foreground/60">
              Adaugă scan-uri
            </legend>
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium">
                  Încărcă fișiere
                </label>
                <input
                  name="scanFiles"
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  className="mt-1 block w-full text-sm"
                />
                <p className="mt-1 text-xs text-foreground/60">
                  Poți selecta mai multe fișiere. Max 10MB per fișier.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium">
                  sau URL-uri (câte unul pe rând)
                </label>
                <input
                  name="scanUrls"
                  placeholder="/uploads/doc1.pdf"
                  className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
                <input
                  name="scanTitles"
                  placeholder="Titlu pentru doc1 (opțional)"
                  className="mt-2 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
                <input
                  name="scanUrls"
                  placeholder="https://exemplu.com/doc2.png"
                  className="mt-2 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
                <input
                  name="scanTitles"
                  placeholder="Titlu pentru doc2 (opțional)"
                  className="mt-2 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
          </fieldset>
          <div className="pt-2 flex justify-center">
            <button className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90">
              Salvează
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
