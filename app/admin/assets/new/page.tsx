"use client";
import { useActionState } from "react";
import { createAssetAction, type FormState } from "./actions";
import Link from "next/link";
import OwnerSelect from "@/app/components/owner-select";

export default function NewAssetPage() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createAssetAction,
    { ok: false, values: {} }
  );
  // Navigate on success to avoid surfacing NEXT_REDIRECT in UI
  if (state?.ok && state.redirectTo) {
    window.location.href = state.redirectTo;
  }
  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Adaugă asset</h1>
          <Link
            href="/admin/assets"
            className="text-sm text-foreground/70 hover:underline"
          >
            Înapoi
          </Link>
        </div>
        <form action={formAction} className="mt-6 space-y-4">
          {state.message ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {state.message}
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium">
              ID (generat din nume)
            </label>
            <input
              name="id"
              readOnly
              value={(state.values.id as string) || "(se generează din Nume)"}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Nume</label>
            <input
              name="name"
              required
              defaultValue={String(state.values.name ?? "")}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Adresă</label>
            <input
              name="address"
              required
              defaultValue={String(state.values.address ?? "")}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Suprafață (mp)</label>
            <input
              name="areaSqm"
              type="number"
              step="0.01"
              min="0"
              defaultValue={String(state.values.areaSqm ?? "")}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Proprietar</label>
            <OwnerSelect idName="ownerId" nameName="owner" required />
          </div>
          <fieldset className="rounded-md border border-foreground/10 p-3">
            <legend className="px-1 text-xs text-foreground/60">
              Scan-uri
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
                  defaultValue={String(state.values.scanUrls ?? "")}
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
