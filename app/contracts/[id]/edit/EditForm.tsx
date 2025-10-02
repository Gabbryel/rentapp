"use client";
import { useActionState, useMemo, useState } from "react";
import MultiDateInput from "@/app/components/multi-date-input";
import ExchangeRateField from "@/app/components/exchange-rate-field";
import Link from "next/link";
import { updateContractAction, type EditFormState } from "./actions";
import PartnerSelect from "@/app/components/partner-select";
import AssetSelect from "@/app/components/asset-select";
import OwnerSelect from "@/app/components/owner-select";

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
        {/* deprecated single scan hidden field removed; multi-scan editor below */}
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
            step="0.01"
            min="0"
            max="100"
            inputMode="decimal"
            defaultValue={String(
              state.values.correctionPercent ??
                (typeof contract.correctionPercent === "number"
                  ? contract.correctionPercent
                  : "")
            )}
            placeholder="ex: 10.5"
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium">Asset</label>
        <AssetSelect
          idName="assetId"
          nameName="asset"
          required
          defaultId={(() => {
            const v = state.values.assetId as unknown;
            if (typeof v === "string") return v;
            return (contract as any).assetId ?? "";
          })()}
          defaultName={String(
            (state.values.asset as string) ?? (contract as any).asset ?? ""
          )}
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
        <label className="block text-sm font-medium">Nume (generat)</label>
        <input
          name="name"
          readOnly
          value={String(state.values.name ?? contract.name)}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Proprietar</label>
        <OwnerSelect
          idName="ownerId"
          nameName="owner"
          required
          defaultId={(() => {
            const v = state.values.ownerId as unknown;
            if (typeof v === "string") return v;
            return (contract as any).ownerId ?? "";
          })()}
          defaultName={String(
            (state.values.owner as string) ?? (contract as any).owner ?? ""
          )}
        />
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
              defaultValue={String(
                (state.values.indexingScheduleDay as string) ??
                  (contract as any).indexingScheduleDay ??
                  ""
              )}
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
                (state.values.indexingScheduleMonth as string) ??
                  (contract as any).indexingScheduleMonth ??
                  ""
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
              defaultValue={String(
                (state.values.indexingEveryMonths as string) ??
                  (contract as any).indexingEveryMonths ??
                  ""
              )}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-foreground/60">
          Dacă completezi câmpurile de mai sus, datele generate vor fi combinate
          cu cele introduse manual.
        </p>
      </fieldset>
      <fieldset className="rounded-md border border-foreground/10 p-3">
        <legend className="px-1 text-xs text-foreground/60">
          Documente (scan-uri)
        </legend>
        <div className="space-y-3">
          {/* Existing scans list */}
          {Array.isArray(contract.scans) && contract.scans.length > 0 ? (
            <div className="space-y-2">
              {contract.scans.map((s, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center"
                >
                  <div className="sm:col-span-3">
                    <label className="block text-xs text-foreground/60">
                      URL existent
                    </label>
                    <input
                      name="existingUrl"
                      readOnly
                      defaultValue={s.url}
                      className="mt-1 w-full rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-foreground/60">
                      Titlu (opțional)
                    </label>
                    <input
                      name="existingTitle"
                      defaultValue={s.title ?? ""}
                      placeholder="ex: Contract semnat"
                      className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-1 flex items-end">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        name="existingRemoveIdx"
                        value={String(i)}
                        className="rounded border-foreground/30"
                      />
                      <span>Șterge</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-foreground/60">
              Nu există scan-uri salvate.
            </p>
          )}
          {/* New uploads */}
          <div>
            <label className="block text-sm font-medium">
              Încarcă fișiere noi
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
          {/* New URLs */}
          <div>
            <label className="block text-sm font-medium">
              sau adaugă URL-uri
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
