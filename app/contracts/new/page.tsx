"use client";
import { useActionState, useState } from "react";
import { createContractAction, type FormState } from "./actions";
import ExchangeRateField from "@/app/components/exchange-rate-field";
import PartnerSelect from "@/app/components/partner-select";
import AssetSelect from "@/app/components/asset-select";
import OwnerSelect from "@/app/components/owner-select";
import MultiDateInput from "@/app/components/multi-date-input";

export default function NewContractPage() {
  const [state, formAction] = useActionState<FormState, FormData>(
    createContractAction,
    { ok: false, values: {} }
  );
  const [rentType, setRentType] = useState<"monthly" | "yearly">(
    (state.values.rentType as string) === "yearly" ? "yearly" : "monthly"
  );
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold mb-4">Contract nou</h1>
      {state.message ? (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {state.message}
        </div>
      ) : null}
      <form action={formAction} className="space-y-5">
        {/* Asset / Partner / Owner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </div>
        <div>
          <label className="block text-sm font-medium">Nume (generat)</label>
          <input
            name="name"
            readOnly
            value={(state.values.name as string) || "(asset + partener)"}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm"
          />
        </div>
        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        {/* Rent + pricing */}
        <fieldset className="rounded-md border border-foreground/10 p-4 space-y-4">
          <legend className="px-1 text-xs text-foreground/60">
            Structură chirie
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium">Tip chirie</label>
              <select
                name="rentType"
                value={rentType}
                onChange={(e) =>
                  setRentType(
                    (e.target.value as "monthly" | "yearly") ?? "monthly"
                  )
                }
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              >
                <option value="monthly">Lunar</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
            {rentType === "monthly" && (
              <>
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
                    defaultValue={String(
                      state.values["monthlyInvoiceDay"] ?? ""
                    )}
                    className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Luna facturată
                  </label>
                  <select
                    name="invoiceMonthMode"
                    defaultValue={String(
                      state.values["invoiceMonthMode"] ?? "current"
                    )}
                    className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="current">Luna curentă</option>
                    <option value="next">Luna următoare (în avans)</option>
                  </select>
                </div>
              </>
            )}
            {rentType === "yearly" && (
              <div className="sm:col-span-3">
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
                <p className="mt-2 text-xs text-foreground/60">
                  Poți adăuga mai multe intrări după salvare.
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium">Suma EUR</label>
              <input
                name="amountEUR"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="ex: 1000"
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
        </fieldset>
        {/* Manual indexing dates */}
        <fieldset className="rounded-md border border-foreground/10 p-4">
          <legend className="px-1 text-xs text-foreground/60">
            Date indexare manuală (opțional)
          </legend>
          <MultiDateInput
            name="indexingDates"
            initial={(state.values.indexingDates as string[]) ?? []}
          />
          <p className="mt-2 text-xs text-foreground/60">
            Poți adăuga manual date de indexare specifice. Se vor uni cu cele
            generate periodic.
          </p>
        </fieldset>
        {/* Periodic indexing schedule */}
        <fieldset className="rounded-md border border-foreground/10 p-4">
          <legend className="px-1 text-xs text-foreground/60">
            Program indexare periodică (opțional)
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                defaultValue={String(state.values.indexingScheduleMonth ?? "")}
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
        <div className="pt-2 flex justify-center">
          <button className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90">
            Salvează
          </button>
        </div>
      </form>
    </main>
  );
}
