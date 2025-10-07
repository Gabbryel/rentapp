"use client";
import { useActionState, useEffect, useState } from "react";
import { createContractAction, type FormState } from "./actions";
import MultiDateInput from "@/app/components/multi-date-input";
import ExchangeRateField from "@/app/components/exchange-rate-field";
import PartnerSelect from "@/app/components/partner-select";
import AssetSelect from "@/app/components/asset-select";
import OwnerSelect from "@/app/components/owner-select";
export default function NewContractPage() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createContractAction,
    { ok: false, values: {} }
  );
  // Fetch DB status on client to avoid reading server-only env in a client component
  const [mongoConfigured, setMongoConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/db/status", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (aborted) return;
        if (res.ok) {
          const data = await res.json();
          setMongoConfigured(Boolean(data?.connected));
        } else {
          setMongoConfigured(false);
        }
      } catch {
        if (!aborted) setMongoConfigured(false);
      }
    })();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, []);
  return (
    <main className="min-h-screen px-4 sm:px-6 py-10 flex items-start sm:items-center justify-center">
      <div className="w-full max-w-xl">
        <h1 className="text-center text-2xl sm:text-3xl font-bold">
          Adaugă contract
        </h1>
        {mongoConfigured === false && (
          <p className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
            MongoDB nu este configurat. Completați variabila MONGODB_URI în .env
            pentru a salva.
          </p>
        )}

        <form action={formAction} className="mt-6 space-y-4">
          {state.message ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {state.message}
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium">
              ID (va fi generat)
            </label>
            <input
              name="id"
              readOnly
              value={
                (state.values.id as string) || "(generat din asset + partener)"
              }
              className="mt-1 w-full rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium">Sumă (EUR)</label>
              <input
                name="amountEUR"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="ex: 1200"
                defaultValue={(state.values.amountEUR as string) || ""}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <ExchangeRateField
              name="exchangeRateRON"
              defaultValue={(state.values.exchangeRateRON as string) || ""}
            />
            <div>
              <label className="block text-sm font-medium">TVA (%)</label>
              <input
                name="tvaPercent"
                type="number"
                step="1"
                min="0"
                max="100"
                inputMode="numeric"
                placeholder="ex: 19"
                defaultValue={(state.values.tvaPercent as string) || ""}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Corecție (%)</label>
              <input
                name="correctionPercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                inputMode="decimal"
                placeholder="ex: 10.5"
                defaultValue={(state.values.correctionPercent as string) || ""}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>
          {/* Rent structure */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium">Tip chirie</label>
              <select
                name="rentType"
                defaultValue={String(state.values["rentType"] ?? "monthly")}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              >
                <option value="monthly">Lunar</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
            {/* Monthly config */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">
                  Zi facturare (1-31)
                </label>
                <input
                  name="monthlyInvoiceDay"
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  defaultValue={String(state.values["monthlyInvoiceDay"] ?? "")}
                  className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            {/* Yearly schedule: start with one row; can add more later */}
            <fieldset className="rounded-md border border-foreground/10 p-3">
              <legend className="px-1 text-xs text-foreground/60">
                Facturi anuale
              </legend>
              <div className="space-y-2" id="yearly-invoices">
                <div className="grid grid-cols-3 gap-2">
                  <input
                    name={`yearlyInvoices[0][month]`}
                    placeholder="Luna (1-12)"
                    inputMode="numeric"
                    min={1}
                    max={12}
                    type="number"
                    className="rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-sm"
                    defaultValue={String(
                      (state.values[`yearlyInvoices[0][month]`] as string) ?? ""
                    )}
                  />
                  <input
                    name={`yearlyInvoices[0][day]`}
                    placeholder="Zi (1-31)"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    type="number"
                    className="rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-sm"
                    defaultValue={String(
                      (state.values[`yearlyInvoices[0][day]`] as string) ?? ""
                    )}
                  />
                  <input
                    name={`yearlyInvoices[0][amountEUR]`}
                    placeholder="Suma EUR"
                    inputMode="decimal"
                    step="0.01"
                    type="number"
                    className="rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-sm"
                    defaultValue={String(
                      (state.values[
                        `yearlyInvoices[0][amountEUR]`
                      ] as string) ?? ""
                    )}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-foreground/60">
                Poți adăuga mai multe intrări după salvare.
              </p>
            </fieldset>
          </div>
          <div>
            <label className="block text-sm font-medium">Proprietar</label>
            <OwnerSelect
              idName="ownerId"
              nameName="owner"
              required
              defaultId={(state.values.ownerId as string) || ""}
              defaultName={(state.values.owner as string) || ""}
            />
          </div>
          {/* Asset + Partner -> contract name/id are computed server-side */}
          <div>
            <label className="block text-sm font-medium">Asset</label>
            <AssetSelect
              idName="assetId"
              nameName="asset"
              required
              defaultId={(state.values.assetId as string) || ""}
              defaultName={(state.values.asset as string) || ""}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Partener</label>
            <PartnerSelect
              idName="partnerId"
              nameName="partner"
              required
              defaultName={(state.values.partner as string) || ""}
            />
          </div>
          {/* Optional preview name field (read-only) to hint the final name pattern */}
          <div>
            <label className="block text-sm font-medium">
              Nume (va fi generat)
            </label>
            <input
              name="name"
              readOnly
              value={(state.values.name as string) || "(asset + partener)"}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium">Semnat</label>
              <input
                type="date"
                name="signedAt"
                required
                defaultValue={(state.values.signedAt as string) || ""}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Început</label>
              <input
                type="date"
                name="startDate"
                required
                defaultValue={(state.values.startDate as string) || ""}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Expiră</label>
              <input
                type="date"
                name="endDate"
                required
                defaultValue={(state.values.endDate as string) || ""}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium">
                Prelungire (opțional)
              </label>
              <input
                type="date"
                name="extensionDate"
                defaultValue={(state.values.extensionDate as string) || ""}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Data actului de prelungire (opțional)
              </label>
              <input
                type="date"
                name="extendedAt"
                defaultValue={(state.values as any).extendedAt || ""}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Zile până la scadență
              </label>
              <input
                type="number"
                name="paymentDueDays"
                inputMode="numeric"
                min={0}
                max={120}
                placeholder="ex: 15"
                defaultValue={(state.values.paymentDueDays as string) || ""}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>
          {/* Manual indexing dates removed; use periodic schedule below */}
          {/* Periodic indexing schedule */}
          <fieldset className="rounded-md border border-foreground/10 p-3">
            <legend className="px-1 text-xs text-foreground/60">
              Program indexare periodică (opțional)
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium">Zi (1-31)</label>
                <input
                  name="indexingScheduleDay"
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  defaultValue={String(state.values.indexingScheduleDay ?? "")}
                  className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Luna start (1-12)
                </label>
                <input
                  name="indexingScheduleMonth"
                  type="number"
                  min={1}
                  max={12}
                  inputMode="numeric"
                  defaultValue={String(
                    state.values.indexingScheduleMonth ?? ""
                  )}
                  className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  La fiecare (luni)
                </label>
                <input
                  name="indexingEveryMonths"
                  type="number"
                  min={1}
                  max={120}
                  inputMode="numeric"
                  placeholder="ex: 12 (anual)"
                  defaultValue={String(state.values.indexingEveryMonths ?? "")}
                  className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-foreground/60">
              Dacă completezi câmpurile de mai sus, datele generate vor fi
              combinate cu cele introduse manual.
            </p>
          </fieldset>
          <fieldset className="rounded-md border border-foreground/10 p-3">
            <legend className="px-1 text-xs text-foreground/60">
              Documente (scan-uri)
            </legend>
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium">
                  Încarcă fișiere
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
                  placeholder="Titlu doc1 (opțional)"
                  className="mt-2 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
                <input
                  name="scanUrls"
                  placeholder="https://exemplu.com/doc2.png"
                  className="mt-2 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
                <input
                  name="scanTitles"
                  placeholder="Titlu doc2 (opțional)"
                  className="mt-2 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
          </fieldset>
          <div className="pt-2 flex justify-center">
            <button
              disabled={!mongoConfigured}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              Salvează
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
