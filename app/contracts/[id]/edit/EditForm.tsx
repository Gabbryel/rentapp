"use client";
import { useActionState, useMemo, useState } from "react";
import MultiDateInput from "@/app/components/multi-date-input";
import ExchangeRateField from "@/app/components/exchange-rate-field";
import Link from "next/link";
import { updateContractAction, type EditFormState } from "./actions";
import PartnerSelect from "@/app/components/partner-select";

import type { Contract } from "@/lib/schemas/contract";

type Props = {
  contract: Contract;
  mongoConfigured: boolean;
};

export default function EditForm({ contract, mongoConfigured }: Props) {
  const [state, formAction] = useActionState<EditFormState, FormData>(
    updateContractAction,
    { ok: false, values: {} }
  );
  // Local UI state to toggle monthly/yearly sections and manage yearly rows
  const initialRentType = String(
    (state.values.rentType as string) ?? contract.rentType ?? "monthly"
  ) as "monthly" | "yearly";
  const [rentType, setRentType] = useState<"monthly" | "yearly">(
    initialRentType
  );
  const initialYearlyRows = useMemo(() => {
    const n = Array.isArray(contract.yearlyInvoices)
      ? contract.yearlyInvoices.length
      : 0;
    return Math.max(1, n);
  }, [contract.yearlyInvoices]);
  const [yearlyRows, setYearlyRows] = useState<number>(initialYearlyRows);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state.message ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {state.message}
        </div>
      ) : null}
      <div>
        <label className="block text-sm font-medium">ID</label>
        <input
          name="id"
          defaultValue={String(state.values.id ?? contract.id)}
          readOnly
          className="mt-1 w-full rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm"
        />
        <input
          type="hidden"
          name="existingScanUrl"
          defaultValue={String(
            state.values.existingScanUrl ?? contract.scanUrl ?? ""
          )}
        />
      </div>
      {/* Rent structure */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-sm font-medium">Tip chirie</label>
          <select
            name="rentType"
            value={rentType}
            onChange={(e) =>
              setRentType((e.target.value as "monthly" | "yearly") ?? "monthly")
            }
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          >
            <option value="monthly">Lunar</option>
            <option value="yearly">Anual</option>
          </select>
        </div>
        {rentType === "monthly" ? (
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
                defaultValue={String(
                  (state.values.monthlyInvoiceDay as string) ??
                    contract.monthlyInvoiceDay ??
                    ""
                )}
                className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : (
          <fieldset className="rounded-md border border-foreground/10 p-3">
            <legend className="px-1 text-xs text-foreground/60">
              Facturi anuale
            </legend>
            <div className="space-y-2">
              {Array.from({ length: yearlyRows }).map((_, i) => {
                const row = Array.isArray(contract.yearlyInvoices)
                  ? contract.yearlyInvoices?.[i]
                  : undefined;
                return (
                  <div className="grid grid-cols-3 gap-2" key={i}>
                    <input
                      name={`yearlyInvoices[${i}][month]`}
                      placeholder="Luna (1-12)"
                      inputMode="numeric"
                      min={1}
                      max={12}
                      type="number"
                      className="rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-sm"
                      defaultValue={String(
                        (state.values[
                          `yearlyInvoices[${i}][month]`
                        ] as string) ??
                          row?.month ??
                          ""
                      )}
                    />
                    <input
                      name={`yearlyInvoices[${i}][day]`}
                      placeholder="Zi (1-31)"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      type="number"
                      className="rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-sm"
                      defaultValue={String(
                        (state.values[`yearlyInvoices[${i}][day]`] as string) ??
                          row?.day ??
                          ""
                      )}
                    />
                    <input
                      name={`yearlyInvoices[${i}][amountEUR]`}
                      placeholder="Suma EUR"
                      inputMode="decimal"
                      step="0.01"
                      type="number"
                      className="rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-sm"
                      defaultValue={String(
                        (state.values[
                          `yearlyInvoices[${i}][amountEUR]`
                        ] as string) ??
                          row?.amountEUR ??
                          ""
                      )}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="text-xs rounded border border-foreground/20 px-2 py-1 hover:bg-foreground/5"
                onClick={() => setYearlyRows((n) => Math.min(24, n + 1))}
              >
                Adaugă rând
              </button>
              {yearlyRows > 1 && (
                <button
                  type="button"
                  className="text-xs rounded border border-foreground/20 px-2 py-1 hover:bg-foreground/5"
                  onClick={() => setYearlyRows((n) => Math.max(1, n - 1))}
                >
                  Șterge ultimul
                </button>
              )}
            </div>
          </fieldset>
        )}
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
            defaultValue={String(
              state.values.amountEUR ??
                (typeof contract.amountEUR === "number"
                  ? contract.amountEUR
                  : "")
            )}
            placeholder="ex: 1200"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <ExchangeRateField
          name="exchangeRateRON"
          defaultValue={String(
            state.values.exchangeRateRON ??
              (typeof contract.exchangeRateRON === "number"
                ? contract.exchangeRateRON
                : "")
          )}
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
            defaultValue={String(
              state.values.tvaPercent ??
                (typeof contract.tvaPercent === "number"
                  ? contract.tvaPercent
                  : "")
            )}
            placeholder="ex: 19"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Corecție (%)</label>
          <input
            name="correctionPercent"
            type="number"
            step="1"
            min="0"
            max="100"
            inputMode="numeric"
            defaultValue={String(
              state.values.correctionPercent ??
                (typeof contract.correctionPercent === "number"
                  ? contract.correctionPercent
                  : "")
            )}
            placeholder="ex: 10"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium">Nume</label>
        <input
          name="name"
          defaultValue={String(state.values.name ?? contract.name)}
          required
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Partener</label>
        <PartnerSelect
          idName="partnerId"
          nameName="partner"
          required
          defaultId={(() => {
            const v = state.values.partnerId as unknown;
            if (typeof v === "string") return v;
            return contract.partnerId ?? "";
          })()}
          defaultName={String(
            (state.values.partner as string) ?? contract.partner
          )}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Proprietar</label>
        <select
          name="owner"
          defaultValue={String(
            state.values.owner ?? contract.owner ?? "Markov Services s.r.l."
          )}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
        >
          <option value="Markov Services s.r.l.">Markov Services s.r.l.</option>
          <option value="MKS Properties s.r.l.">MKS Properties s.r.l.</option>
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium">Semnat</label>
          <input
            type="date"
            name="signedAt"
            defaultValue={String(state.values.signedAt ?? contract.signedAt)}
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Început</label>
          <input
            type="date"
            name="startDate"
            defaultValue={String(state.values.startDate ?? contract.startDate)}
            required
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Expiră</label>
          <input
            type="date"
            name="endDate"
            defaultValue={String(state.values.endDate ?? contract.endDate)}
            required
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
            defaultValue={String(
              state.values.extensionDate ?? contract.extensionDate ?? ""
            )}
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
            defaultValue={String(
              (state.values.paymentDueDays as string) ??
                contract.paymentDueDays ??
                ""
            )}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </div>
      <MultiDateInput
        name="indexingDates"
        initial={
          (state.values.indexingDates as string[]) ??
          contract.indexingDates ??
          []
        }
      />
      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium">
            Încarcă scan (PDF sau imagine)
          </label>
          <input
            type="file"
            name="scanFile"
            accept="application/pdf,image/*"
            className="mt-1 block w-full text-sm"
          />
          <p className="mt-1 text-xs text-foreground/60">
            Max 10MB. Tipuri permise: PDF, PNG, JPG/JPEG, GIF, WEBP, SVG.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium">sau introdu URL</label>
          <input
            name="scanUrl"
            placeholder="/uploads/contract.pdf sau https://exemplu.com/contract.pdf"
            pattern={".*\\.(pdf|png|jpe?g|gif|webp|svg)(?:$|[?#]).*"}
            title="Acceptat: PDF sau imagine (png, jpg, jpeg, gif, webp, svg)"
            defaultValue={String(state.values.scanUrl ?? "")}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-foreground/60">
            Dacă nu alegi nimic, rămâne scan-ul actual.
          </p>
          {contract.scanUrl ? (
            <p className="mt-1 text-xs text-foreground/60">
              Scan curent: {contract.scanUrl}
            </p>
          ) : null}
        </div>
      </div>
      <div className="pt-2 flex items-center justify-center gap-3">
        <button
          disabled={!mongoConfigured}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          Salvează modificările
        </button>
        <Link
          href={`/contracts/${contract.id}`}
          className="text-sm text-foreground/70 hover:underline"
        >
          Anulează
        </Link>
      </div>
    </form>
  );
}
