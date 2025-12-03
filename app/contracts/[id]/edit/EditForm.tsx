"use client";
import { useActionState, useRef } from "react";
// indexing UI removed
import Link from "next/link";
import { updateContractAction, type EditFormState } from "./actions";
import PartnerSelect from "@/app/components/partner-select"; // legacy single select (unused now)
import PartnerMultiSelect from "@/app/components/partner-multi-select";
import AssetSelect from "@/app/components/asset-select";
import OwnerSelect from "@/app/components/owner-select";
import ExtensionsField from "@/app/components/extensions-field";
import { useRouter } from "next/navigation";

import type { Contract } from "@/lib/schemas/contract";

const MONTH_OPTIONS = [
  { value: 1, label: "Ianuarie" },
  { value: 2, label: "Februarie" },
  { value: 3, label: "Martie" },
  { value: 4, label: "Aprilie" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Iunie" },
  { value: 7, label: "Iulie" },
  { value: 8, label: "August" },
  { value: 9, label: "Septembrie" },
  { value: 10, label: "Octombrie" },
  { value: 11, label: "Noiembrie" },
  { value: 12, label: "Decembrie" },
] as const;

type Props = {
  contract: Contract;
  mongoConfigured: boolean;
  indexingDefaults?: { indexingDay?: number; indexingMonth?: number };
};

export default function EditForm({
  contract,
  mongoConfigured,
  indexingDefaults,
}: Props) {
  const [state, formAction] = useActionState<EditFormState, FormData>(
    updateContractAction,
    { ok: false, values: {} }
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  const router = useRouter();
  const rentType = String(
    (state.values.rentType as string) ?? contract.rentType ?? "monthly"
  ) as "monthly" | "yearly";
  const yearlyInvoices = Array.isArray((contract as any).irregularInvoices)
    ? ((contract as any).irregularInvoices as any[])
    : [];
  // indexing dates removed
  const indexingDayValue = String(
    (state.values as any).indexingDay ??
      (contract as any).indexingDay ??
      indexingDefaults?.indexingDay ??
      ""
  );
  const indexingMonthValue = String(
    (state.values as any).indexingMonth ??
      (contract as any).indexingMonth ??
      indexingDefaults?.indexingMonth ??
      ""
  );
  const indexingFreqValue = String(
    (state.values as any).howOftenIsIndexing ??
      (contract as any).howOftenIsIndexing ??
      ""
  );

  const handleGenerateWrittenContract = () => {
    if (typeof window === "undefined") return;
    const formEl = formRef.current;
    if (!formEl) return;
    const fd = new FormData(formEl);
    const payload: Record<string, unknown> = { contractId: contract.id };
    fd.forEach((value, key) => {
      if (value instanceof File) return;
      const textValue = typeof value === "string" ? value : String(value ?? "");
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const current = payload[key];
        if (Array.isArray(current)) {
          current.push(textValue);
        } else {
          payload[key] = [current, textValue];
        }
      } else {
        payload[key] = textValue;
      }
    });
    try {
      window.sessionStorage.setItem(
        "written-contract-prefill",
        JSON.stringify(payload)
      );
    } catch (error) {
      console.warn("Nu am putut salva draftul pentru contract scris", error);
    }
    router.push(
      `/contracts/written-contract?contractId=${encodeURIComponent(
        contract.id
      )}`
    );
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-8 mt-6">
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
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Asset</label>
          <AssetSelect
            idName="assetId"
            nameName="asset"
            required
            defaultId={String(
              (state.values.assetId as string) ??
                (contract as any).assetId ??
                ""
            )}
            defaultName={String(
              (state.values.asset as string) ?? (contract as any).asset ?? ""
            )}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Proprietar</label>
          <OwnerSelect
            idName="ownerId"
            nameName="owner"
            required
            defaultId={String(
              (state.values.ownerId as string) ??
                (contract as any).ownerId ??
                ""
            )}
            defaultName={String(
              (state.values.owner as string) ?? (contract as any).owner ?? ""
            )}
          />
        </div>
      </section>
      <section className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Parteneri</label>
          <p className="text-[11px] text-foreground/60 mb-2">
            Gestionează lista partenerilor. Primul este considerat partener
            principal.
          </p>
          <PartnerMultiSelect
            defaultPartners={(() => {
              const arr = (contract as any).partners as
                | { id?: string; name: string }[]
                | undefined;
              if (Array.isArray(arr) && arr.length > 0) return arr;
              return [{ id: contract.partnerId, name: contract.partner }];
            })()}
          />
        </div>
      </section>
      <div>
        <label className="block text-sm font-medium">Nume (generat)</label>
        <input
          name="name"
          readOnly
          value={String(state.values.name ?? contract.name)}
          className="mt-1 w-full rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
      <fieldset className="rounded-md border border-foreground/10 p-4 space-y-3">
        <legend className="px-1 text-xs text-foreground/60">
          Prelungiri multiple
        </legend>
        <ExtensionsField
          name="contractExtensions"
          initial={
            Array.isArray((contract as any).contractExtensions)
              ? ((contract as any).contractExtensions as any[]).map((r) => ({
                  docDate: String(r.docDate || ""),
                  document: String(r.document || ""),
                  extendedUntil: String(r.extendedUntil || ""),
                }))
              : []
          }
        />
      </fieldset>
      <div className="grid grid-cols-1 gap-6">
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
      <fieldset className="rounded-md border border-foreground/10 p-5 space-y-6">
        <legend className="px-1 text-xs text-foreground/60">
          Structură chirie
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
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
              {/* Secțiunea de indexare a fost mutată mai jos */}
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
                    name={`irregularInvoices[${i}][month]`}
                    defaultValue={String(yi.month)}
                    readOnly
                    className="rounded-md border border-foreground/20 bg-foreground/5 px-2 py-1.5 text-sm"
                  />
                  <input
                    name={`irregularInvoices[${i}][day]`}
                    defaultValue={String(yi.day)}
                    readOnly
                    className="rounded-md border border-foreground/20 bg-foreground/5 px-2 py-1.5 text-sm"
                  />
                  <input
                    name={`irregularInvoices[${i}][amountEUR]`}
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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium">Suma EUR</label>
            <input
              name="amountEUR"
              type="number"
              step="0.01"
              min={0}
              inputMode="decimal"
              defaultValue={(() => {
                const fromState = (state.values as any).amountEUR;
                if (typeof fromState === "string" && fromState.trim() !== "")
                  return fromState;
                const arr = Array.isArray((contract as any).indexingDates)
                  ? ((contract as any).indexingDates as Array<{
                      forecastDate?: string;
                      actualDate?: string;
                      newRentAmount?: number;
                    }>)
                  : [];
                if (arr.length === 0)
                  return String((contract as any).amountEUR ?? "");
                const sorted = arr
                  .slice()
                  .map((r) => ({
                    eff: String(r.actualDate || r.forecastDate || ""),
                    val: r.newRentAmount,
                  }))
                  .filter((r) => r.eff)
                  .sort((a, b) => a.eff.localeCompare(b.eff));
                const first = sorted[0];
                return typeof first?.val === "number"
                  ? String(first.val)
                  : String((contract as any).amountEUR ?? "");
              })()}
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
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Tip TVA</label>
            <input
              name="tvaType"
              defaultValue={String(
                state.values.tvaType ?? contract.tvaType ?? ""
              )}
              placeholder="ex: fără drept de deducere (f.d.d.)"
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
      {/* Indexare - setări pe Contract */}
      <fieldset className="rounded-md border border-foreground/10 p-5 space-y-4">
        <legend className="px-1 text-xs text-foreground/60">Indexare</legend>
        <p className="text-xs text-foreground/60">
          Configurează luna și ziua în care se aplică indexarea, precum și
          frecvența (în luni). Datele exacte vor fi generate automat la salvare
          până la expirarea contractului.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium">Zi (1-31)</label>
            <input
              name="indexingDay"
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              defaultValue={indexingDayValue}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              placeholder="ex: 10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Luna</label>
            <select
              name="indexingMonth"
              defaultValue={indexingMonthValue}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            >
              <option value="">Selectează luna</option>
              {MONTH_OPTIONS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">
              Frecvență (luni)
            </label>
            <input
              name="howOftenIsIndexing"
              type="number"
              min={1}
              max={12}
              inputMode="numeric"
              defaultValue={indexingFreqValue}
              className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              placeholder="ex: 12"
            />
          </div>
          <div className="rounded-md border border-dashed border-foreground/20 p-3 text-[11px] text-foreground/60">
            Indexările generate vor putea fi marcate drept aplicate din pagina
            contractului, unde poți încărca documentul și valoarea actualizată.
          </div>
        </div>
      </fieldset>
      <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleGenerateWrittenContract}
          className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground/5"
        >
          Generează contract
        </button>
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
