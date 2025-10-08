"use client";
import { useActionState } from "react";
// indexing UI removed
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
  const rentType = String(
    (state.values.rentType as string) ?? contract.rentType ?? "monthly"
  ) as "monthly" | "yearly";
  const yearlyInvoices = Array.isArray(contract.yearlyInvoices)
    ? contract.yearlyInvoices
    : [];
  // indexing dates removed

  return (
    <form action={formAction} className="space-y-5 mt-6">
      {state.message && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {state.message}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium">ID</label>
        <input
          name="id"
          readOnly
          defaultValue={String(state.values.id ?? contract.id)}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm"
        />
      </div>
      {/* Parties */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Asset</label>
          <AssetSelect
            idName="assetId"
            nameName="asset"
            required
            defaultId={String(
              (state.values.assetId as string) ?? (contract as any).assetId ?? ""
            )}
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
            defaultId={String(
              (state.values.partnerId as string) ?? contract.partnerId ?? ""
            )}
            defaultName={String(
              (state.values.partner as string) ?? contract.partner
            )}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Proprietar</label>
          <OwnerSelect
            idName="ownerId"
            nameName="owner"
            required
            defaultId={String(
              (state.values.ownerId as string) ?? (contract as any).ownerId ?? ""
            )}
            defaultName={String(
              (state.values.owner as string) ?? (contract as any).owner ?? ""
            )}
          />
        </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Semnat</label>
          <input
            type="date"
            name="signedAt"
            required
            defaultValue={String(state.values.signedAt ?? contract.signedAt)}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Început</label>
          <input
            type="date"
            name="startDate"
            required
            defaultValue={String(state.values.startDate ?? contract.startDate)}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Expiră</label>
          <input
            type="date"
            name="endDate"
            required
            defaultValue={String(state.values.endDate ?? contract.endDate)}
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
            defaultValue={String(
              state.values.extensionDate ?? contract.extensionDate ?? ""
            )}
            className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">
            Act prelungire (data)
          </label>
          <input
            type="date"
            name="extendedAt"
            defaultValue={String(
              (state.values as any).extendedAt ??
                (contract as any).extendedAt ??
                ""
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
            min={0}
            max={120}
            inputMode="numeric"
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
      {/* Rent structure */}
      <fieldset className="rounded-md border border-foreground/10 p-4 space-y-4">
        <legend className="px-1 text-xs text-foreground/60">
          Structură chirie
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium">Tip chirie</label>
            <select
              name="rentType"
              defaultValue={rentType}
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
                    (state.values.monthlyInvoiceDay as string) ??
                      contract.monthlyInvoiceDay ??
                      ""
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
                    (state.values as any).invoiceMonthMode ??
                      (contract as any).invoiceMonthMode ??
                      "current"
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
            <div className="sm:col-span-3 space-y-2">
              {yearlyInvoices.length === 0 && (
                <p className="text-xs text-foreground/60">
                  Nu există facturi anuale definite.
                </p>
              )}
              {yearlyInvoices.map((yi, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <input
                    name={`yearlyInvoices[${i}][month]`}
                    defaultValue={String(yi.month)}
                    readOnly
                    className="rounded-md border border-foreground/20 bg-foreground/5 px-2 py-1.5 text-sm"
                  />
                  <input
                    name={`yearlyInvoices[${i}][day]`}
                    defaultValue={String(yi.day)}
                    readOnly
                    className="rounded-md border border-foreground/20 bg-foreground/5 px-2 py-1.5 text-sm"
                  />
                  <input
                    name={`yearlyInvoices[${i}][amountEUR]`}
                    defaultValue={String(yi.amountEUR)}
                    readOnly
                    className="rounded-md border border-foreground/20 bg-foreground/5 px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
              <p className="text-xs text-foreground/60">
                Pentru a adăuga/modifica rânduri, utilizează o operațiune
                separată (nu implementat aici).
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
              min={0}
              inputMode="decimal"
              defaultValue={String(
                state.values.amountEUR ?? (contract as any).amountEUR ?? ""
              )}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              placeholder="ex: 1000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Curs RON</label>
            <input
              name="exchangeRateRON"
              type="number"
              step="0.0001"
              min={0}
              inputMode="decimal"
              defaultValue={String(
                state.values.exchangeRateRON ??
                  (contract as any).exchangeRateRON ??
                  ""
              )}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              placeholder="ex: 4.97"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">TVA (%)</label>
            <input
              name="tvaPercent"
              type="number"
              step="1"
              min={0}
              max={100}
              inputMode="numeric"
              defaultValue={String(
                state.values.tvaPercent ?? contract.tvaPercent ?? ""
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
              min={0}
              max={100}
              inputMode="decimal"
              defaultValue={String(
                state.values.correctionPercent ??
                  contract.correctionPercent ??
                  ""
              )}
              placeholder="ex: 10.5"
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
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
